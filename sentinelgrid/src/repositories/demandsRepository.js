const pool = require("../db");

// A demanda é DERIVADA das OMs (§28.9 — como o calendário, nunca digitada à mão). Não existe
// tabela de grupo: o grupo é (cliente, site, dia de início) e some sozinho se a OM mudar de data.
// A persistência do fato é a própria OS — sg_maintenance_orders.rs_service_order_id, que não é
// único e portanto já representa N OMs → 1 OS.

const DEMAND_STATUS = "agendada";

function groupKeyOf(row) {
  return `${row.client_id}:${row.site_id}:${row.group_date}`;
}

// pendente = nenhuma OM enviada · gerada = todas · parcial = algumas (a OS existe e faltam OMs).
function groupStatus(orders) {
  const sent = orders.filter((order) => order.rsServiceOrderId).length;
  if (!sent) return "pendente";
  return sent === orders.length ? "gerada" : "parcial";
}

async function listScheduledDemands({ from, to, clientId = null, siteId = null, search = "" } = {}) {
  const params = [DEMAND_STATUS, from, to];
  let where = `o.deleted_at IS NULL
    AND o.status = $1
    AND COALESCE(o.scheduled_date::date, o.planned_date) BETWEEN $2::date AND $3::date`;
  if (clientId) {
    params.push(clientId);
    where += ` AND o.client_id = $${params.length}`;
  }
  if (siteId) {
    params.push(siteId);
    where += ` AND o.site_id = $${params.length}`;
  }
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where += ` AND (LOWER(o.order_number) LIKE $${params.length}
                 OR LOWER(e.tag) LIKE $${params.length}
                 OR LOWER(o.scope) LIKE $${params.length})`;
  }

  const rows = (await pool.query(
    `SELECT o.id, o.order_number, o.maintenance_type, o.priority, o.scope,
            GREATEST(1, o.execution_days) AS execution_days,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date), 'YYYY-MM-DD') AS group_date,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date)
                    + (GREATEST(1, o.execution_days) - 1), 'YYYY-MM-DD') AS end_date,
            o.rs_service_order_id, o.rs_service_order_code,
            o.equipment_id, e.tag AS equipment_tag,
            o.client_id, c.name AS client_name,
            o.site_id, s.name AS site_name,
            COALESCE(
              (SELECT json_agg(json_build_object('id', t.id, 'name', t.name) ORDER BY t.name, t.id)
                 FROM sg_order_technicians ot
                 JOIN sg_technicians t ON t.id = ot.technician_id AND t.deleted_at IS NULL
                WHERE ot.order_id = o.id),
              '[]'::json
            ) AS technicians
       FROM sg_maintenance_orders o
       JOIN sg_equipment e ON e.id = o.equipment_id
       JOIN sg_clients c ON c.id = o.client_id
       JOIN sg_sites s ON s.id = o.site_id
      WHERE ${where}
      ORDER BY group_date, c.name, s.name, o.order_number`,
    params
  )).rows;

  const groups = new Map();
  for (const row of rows) {
    const key = groupKeyOf(row);
    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        clientId: Number(row.client_id),
        clientName: row.client_name,
        siteId: Number(row.site_id),
        siteName: row.site_name,
        date: row.group_date,
        endDate: row.end_date,
        status: "pendente",
        rsServiceOrderId: null,
        rsServiceOrderCode: "",
        technicians: [],
        orders: []
      });
    }
    const group = groups.get(key);
    const technicians = row.technicians || [];
    group.orders.push({
      orderId: Number(row.id),
      orderNumber: row.order_number,
      equipmentId: Number(row.equipment_id),
      equipmentTag: row.equipment_tag || `#${row.equipment_id}`,
      maintenanceType: row.maintenance_type,
      priority: row.priority,
      scope: row.scope || "",
      executionDays: Number(row.execution_days),
      endDate: row.end_date,
      technicians,
      rsServiceOrderId: row.rs_service_order_id ? Number(row.rs_service_order_id) : null,
      rsServiceOrderCode: row.rs_service_order_code || ""
    });
    // O fim do grupo é o da OM mais longa; os técnicos, a união (o mesmo técnico em duas OMs
    // entra uma vez só — é a mesma mobilização de campo).
    if (row.end_date > group.endDate) group.endDate = row.end_date;
    for (const technician of technicians) {
      if (!group.technicians.some((known) => known.id === technician.id)) group.technicians.push(technician);
    }
  }

  return [...groups.values()].map((group) => {
    const sent = group.orders.find((order) => order.rsServiceOrderId);
    group.technicians.sort((left, right) => left.name.localeCompare(right.name));
    return {
      ...group,
      status: groupStatus(group.orders),
      rsServiceOrderId: sent ? sent.rsServiceOrderId : null,
      rsServiceOrderCode: sent ? sent.rsServiceOrderCode : ""
    };
  });
}

module.exports = { listScheduledDemands, DEMAND_STATUS };
