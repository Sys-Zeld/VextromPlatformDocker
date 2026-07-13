const pool = require("../db");

const PRE_SCHEDULE_STATUSES = [
  "planejada", "aguardando_aprovacao", "aprovada", "reprogramada", "emergencial"
];
const RESERVED_SCHEDULE_STATUSES = [...PRE_SCHEDULE_STATUSES, "agendada", "em_execucao"];

function validationError(message) {
  const error = new Error(message);
  error.code = "SG_PRE_SCHEDULE_INVALID";
  return error;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function overlaps(left, right) {
  return left.startDate <= right.endDate && left.endDate >= right.startDate;
}

function sameLocation(left, right) {
  return Number(left.clientId) === Number(right.clientId) &&
    (left.siteId == null ? null : Number(left.siteId)) === (right.siteId == null ? null : Number(right.siteId));
}

function normalizedFilters(filters = {}) {
  return {
    search: String(filters.search || "").trim(),
    clientId: Number(filters.clientId) || null,
    status: String(filters.status || "").trim(),
    maintenanceType: String(filters.maintenanceType || "").trim()
  };
}

async function loadTechnicians(client, technicianIds) {
  const result = await client.query(
    `SELECT id, name, role, company
       FROM sg_technicians
      WHERE id=ANY($1::bigint[]) AND active=TRUE AND deleted_at IS NULL
      ORDER BY name, id`, [technicianIds]
  );
  if (result.rows.length !== technicianIds.length) {
    throw validationError("Selecione somente técnicos ativos e cadastrados no SentinelGrid.");
  }
  return result.rows.map((row) => ({ ...row, id: Number(row.id) }));
}

async function loadCandidateOrders(client, filters) {
  const params = [PRE_SCHEDULE_STATUSES];
  let where = `o.deleted_at IS NULL
    AND o.status=ANY($1::text[])
    AND COALESCE(o.scheduled_date::date, o.planned_date) IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sg_order_technicians linked WHERE linked.order_id=o.id)`;
  const add = (condition, value) => {
    params.push(value);
    where += ` AND ${condition.replace("$?", `$${params.length}`)}`;
  };
  if (filters.clientId) add("o.client_id=$?", filters.clientId);
  if (filters.status) add("o.status=$?", filters.status);
  if (filters.maintenanceType) add("o.maintenance_type=$?", filters.maintenanceType);
  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    where += ` AND (LOWER(o.order_number) LIKE $${params.length} OR LOWER(e.tag) LIKE $${params.length} OR LOWER(o.scope) LIKE $${params.length})`;
  }
  const rows = (await client.query(
    `SELECT o.id, o.order_number, o.status, o.equipment_id, o.execution_days,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date), 'YYYY-MM-DD') AS start_date,
            e.tag AS equipment_tag, o.client_id, c.name AS client_name,
            o.site_id, s.name AS site_name
       FROM sg_maintenance_orders o
       JOIN sg_equipment e ON e.id=o.equipment_id
       JOIN sg_clients c ON c.id=o.client_id
       LEFT JOIN sg_sites s ON s.id=o.site_id
      WHERE ${where}
      ORDER BY start_date, o.client_id, o.site_id NULLS FIRST, o.equipment_id, o.id`, params
  )).rows;
  return rows.map((row) => ({
    orderId: Number(row.id), orderNumber: row.order_number, status: row.status,
    equipmentId: Number(row.equipment_id), equipmentTag: row.equipment_tag || `#${row.equipment_id}`,
    startDate: row.start_date, endDate: addDays(row.start_date, Math.max(1, Number(row.execution_days) || 1) - 1),
    clientId: Number(row.client_id), clientName: row.client_name,
    siteId: row.site_id == null ? null : Number(row.site_id), siteName: row.site_name || "Sem site"
  }));
}

async function loadReservations(client, technicianIds, from, to) {
  if (!from || !to) return [];
  const rows = (await client.query(
    `SELECT ot.technician_id, o.id AS order_id, o.client_id, o.site_id,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date), 'YYYY-MM-DD') AS start_date,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date) + (GREATEST(1, o.execution_days) - 1), 'YYYY-MM-DD') AS end_date
       FROM sg_order_technicians ot
       JOIN sg_maintenance_orders o ON o.id=ot.order_id AND o.deleted_at IS NULL
      WHERE ot.technician_id=ANY($1::bigint[])
        AND o.status=ANY($2::text[])
        AND COALESCE(o.scheduled_date::date, o.planned_date) <= $4::date
        AND COALESCE(o.scheduled_date::date, o.planned_date) + (GREATEST(1, o.execution_days) - 1) >= $3::date`,
    [technicianIds, RESERVED_SCHEDULE_STATUSES, from, to]
  )).rows;
  return rows.map((row) => ({
    technicianId: Number(row.technician_id), orderId: Number(row.order_id),
    clientId: Number(row.client_id), siteId: row.site_id == null ? null : Number(row.site_id),
    startDate: row.start_date, endDate: row.end_date
  }));
}

async function buildPlan(client, technicianIds, filters) {
  const technicians = await loadTechnicians(client, technicianIds);
  const orders = await loadCandidateOrders(client, normalizedFilters(filters));
  const from = orders[0]?.startDate;
  const to = orders.reduce((latest, order) => !latest || order.endDate > latest ? order.endDate : latest, "");
  const reservations = await loadReservations(client, technicianIds, from, to);
  const schedules = new Map(technicians.map((technician) => [technician.id, []]));
  const loads = new Map(technicians.map((technician) => [technician.id, 0]));
  reservations.forEach((reservation) => {
    schedules.get(reservation.technicianId)?.push(reservation);
    loads.set(reservation.technicianId, (loads.get(reservation.technicianId) || 0) + 1);
  });

  const assignments = [];
  const unassigned = [];
  for (const order of orders) {
    const eligible = technicians
      .filter((technician) => !(schedules.get(technician.id) || []).some((reserved) => overlaps(order, reserved) && !sameLocation(order, reserved)))
      .sort((left, right) => (loads.get(left.id) || 0) - (loads.get(right.id) || 0) || left.name.localeCompare(right.name) || left.id - right.id);
    const technician = eligible[0];
    if (!technician) {
      unassigned.push({ ...order, reason: "Todos os técnicos selecionados possuem outro cliente/site no período." });
      continue;
    }
    const assignment = { ...order, technicianId: technician.id, technicianName: technician.name };
    assignments.push(assignment);
    schedules.get(technician.id).push(assignment);
    loads.set(technician.id, (loads.get(technician.id) || 0) + 1);
  }

  const workload = technicians.map((technician) => {
    const assigned = assignments.filter((item) => item.technicianId === technician.id).length;
    const existing = reservations.filter((item) => item.technicianId === technician.id).length;
    return { technicianId: technician.id, technicianName: technician.name, existing, assigned, total: existing + assigned };
  });
  return { assignments, unassigned, workload, eligibleOrders: orders.length };
}

async function preScheduleOrders({ technicianIds, filters = {}, apply = false }, actor = "") {
  const ids = [...new Set((technicianIds || []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
  if (!ids.length) throw validationError("Selecione pelo menos um técnico para gerar o pré-agendamento.");
  const client = apply ? await pool.connect() : pool;
  try {
    if (apply) {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(72002, 1)");
      for (const id of ids) await client.query("SELECT pg_advisory_xact_lock(72001, $1)", [id]);
    }
    const plan = await buildPlan(client, ids, filters);
    if (apply) {
      for (const item of plan.assignments) {
        await client.query(
          `INSERT INTO sg_order_technicians (order_id, technician_id, created_by)
           VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [item.orderId, item.technicianId, actor]
        );
      }
      await client.query("COMMIT");
    }
    return { ...plan, applied: apply, appliedCount: apply ? plan.assignments.length : 0 };
  } catch (error) {
    if (apply) await client.query("ROLLBACK");
    throw error;
  } finally {
    if (apply) client.release();
  }
}

module.exports = { preScheduleOrders, PRE_SCHEDULE_STATUSES, RESERVED_SCHEDULE_STATUSES };
