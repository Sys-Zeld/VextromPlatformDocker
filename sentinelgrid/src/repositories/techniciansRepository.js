const pool = require("../db");
const { validateTechnicianSchedule } = require("../services/technicianScheduleValidator");

async function listTechnicians() {
  return (await pool.query(
    `SELECT t.*, l.rs_id
       FROM sg_technicians t
       LEFT JOIN sg_rs_links l ON l.entity_type = 'technician' AND l.sg_id = t.id
      WHERE t.deleted_at IS NULL
      ORDER BY t.name, t.id`
  )).rows;
}

async function createTechnician(input, actor = "") {
  const email = String(input.email || "").trim();
  try {
    return (await pool.query(
      `INSERT INTO sg_technicians (name, role, company, email, phone, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
      [input.name, input.role || "", input.company || "", email, input.phone || "", actor]
    )).rows[0];
  } catch (err) {
    // Cadastro repetido pelo mesmo e-mail é idempotente: devolve o técnico já existente.
    if (err?.code === "23505" && err?.constraint === "uq_sg_technicians_email" && email) {
      const existing = (await pool.query(
        "SELECT * FROM sg_technicians WHERE LOWER(email)=LOWER($1) AND deleted_at IS NULL LIMIT 1",
        [email]
      )).rows[0];
      if (existing) return existing;
    }
    throw err;
  }
}

async function listOrderTechnicians(orderId) {
  return (await pool.query(
    `SELECT t.*, l.rs_id
       FROM sg_order_technicians ot
       JOIN sg_technicians t ON t.id = ot.technician_id AND t.deleted_at IS NULL
       LEFT JOIN sg_rs_links l ON l.entity_type = 'technician' AND l.sg_id = t.id
      WHERE ot.order_id = $1 ORDER BY t.name`, [orderId]
  )).rows;
}

async function assertScheduled(orderId, client = pool) {
  const order = (await client.query(
    `SELECT id, status, rs_service_order_id FROM sg_maintenance_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [orderId]
  )).rows[0];
  if (!order) { const e = new Error("Ordem de manutenção inexistente."); e.code = "SG_ORDER_INVALID"; throw e; }
  if (order.status !== "agendada") { const e = new Error("Técnicos só podem ser alterados em ordens Agendadas."); e.code = "SG_ORDER_NOT_SCHEDULED"; throw e; }
  return order;
}

async function linkTechnician(orderId, technicianId, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assertScheduled(orderId, client);
    await validateTechnicianSchedule(client, orderId, { technicianIds: [technicianId] });
    const result = await client.query(
      `INSERT INTO sg_order_technicians (order_id, technician_id, created_by)
       SELECT $1, id, $3 FROM sg_technicians WHERE id=$2 AND deleted_at IS NULL
       ON CONFLICT DO NOTHING RETURNING *`, [orderId, technicianId, actor]
    );
    if (!result.rows[0]) {
      const exists = await client.query("SELECT 1 FROM sg_order_technicians WHERE order_id=$1 AND technician_id=$2", [orderId, technicianId]);
      if (!exists.rows[0]) { const e = new Error("Técnico inexistente."); e.code = "SG_TECHNICIAN_INVALID"; throw e; }
    }
    await client.query("COMMIT");
    return listOrderTechnicians(orderId);
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}

async function unlinkTechnician(orderId, technicianId) {
  await assertScheduled(orderId);
  await pool.query("DELETE FROM sg_order_technicians WHERE order_id=$1 AND technician_id=$2", [orderId, technicianId]);
  return listOrderTechnicians(orderId);
}

async function listTechnicianAgenda({ from, to, technicianId = null }) {
  const params = [from, to];
  let techFilter = "";
  if (technicianId) { params.push(technicianId); techFilter = `AND t.id=$${params.length}`; }
  return (await pool.query(
    `SELECT o.id AS order_id, o.order_number, o.status, o.priority, o.scope,
            o.execution_days,
            o.rs_service_order_id, o.rs_service_order_code,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date), 'YYYY-MM-DD') AS start_date,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date) + (o.execution_days - 1), 'YYYY-MM-DD') AS end_date,
            t.id AS technician_id, t.name AS technician_name,
            e.id AS equipment_id, e.tag AS equipment_tag,
            c.id AS client_id, c.name AS client_name, s.id AS site_id, s.name AS site_name
       FROM sg_order_technicians ot
       JOIN sg_technicians t ON t.id=ot.technician_id AND t.deleted_at IS NULL AND t.active=TRUE
       JOIN sg_maintenance_orders o ON o.id=ot.order_id AND o.deleted_at IS NULL
       JOIN sg_equipment e ON e.id=o.equipment_id
       JOIN sg_clients c ON c.id=o.client_id
       LEFT JOIN sg_sites s ON s.id=o.site_id
      WHERE COALESCE(o.scheduled_date::date, o.planned_date) IS NOT NULL
        AND COALESCE(o.scheduled_date::date, o.planned_date) <= $2::date
        AND COALESCE(o.scheduled_date::date, o.planned_date) + (o.execution_days - 1) >= $1::date
        ${techFilter}
      ORDER BY start_date, t.name, o.order_number`, params
  )).rows;
}

async function rescheduleOrder(orderId, { startDate, executionDays }, actor = "") {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const order = (await client.query(
      "SELECT id, status FROM sg_maintenance_orders WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [orderId]
    )).rows[0];
    if (!order) { const err = new Error("Ordem de manutenção inexistente."); err.code = "SG_ORDER_INVALID"; throw err; }
    if (order.status !== "agendada") { const err = new Error("Somente ordens Agendadas podem ser reagendadas."); err.code = "SG_ORDER_NOT_SCHEDULED"; throw err; }
    await validateTechnicianSchedule(client, orderId, { startDate, executionDays });
    const updated = (await client.query(
      `UPDATE sg_maintenance_orders
          SET planned_date=$2::date,
              scheduled_date=CASE WHEN scheduled_date IS NULL THEN NULL ELSE $2::date + scheduled_date::time END,
              execution_days=$3, updated_by=$4, updated_at=NOW()
        WHERE id=$1 RETURNING *`, [orderId, startDate, executionDays, actor]
    )).rows[0];
    await client.query("COMMIT");
    return updated;
  } catch (err) { await client.query("ROLLBACK"); throw err; }
  finally { client.release(); }
}

module.exports = {
  listTechnicians, createTechnician, listOrderTechnicians, linkTechnician, unlinkTechnician,
  listTechnicianAgenda, rescheduleOrder, assertScheduled
};
