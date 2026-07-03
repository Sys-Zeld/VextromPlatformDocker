const pool = require("../db");

function invalidOrder() {
  const err = new Error("Ordem invalida ou inexistente");
  err.code = "SG_ORDER_INVALID";
  return err;
}

function invalidEquipment() {
  const err = new Error("Equipamento invalido ou inexistente");
  err.code = "SG_EQUIPMENT_INVALID";
  return err;
}

async function resolveOrder(orderId) {
  const order = (await pool.query(
    "SELECT id, equipment_id, order_number FROM sg_maintenance_orders WHERE id = $1 AND deleted_at IS NULL",
    [orderId]
  )).rows[0] || null;
  if (!order) throw invalidOrder();
  return order;
}

async function resolveEquipment(equipmentId) {
  const equipment = (await pool.query(
    "SELECT id FROM sg_equipment WHERE id = $1 AND deleted_at IS NULL",
    [equipmentId]
  )).rows[0] || null;
  if (!equipment) throw invalidEquipment();
  return equipment;
}

async function listMeasurements({ orderId = null, equipmentId = null, limit = 100 } = {}) {
  const params = [];
  let where = "m.deleted_at IS NULL";
  if (orderId) { params.push(orderId); where += ` AND m.order_id = $${params.length}`; }
  if (equipmentId) { params.push(equipmentId); where += ` AND m.equipment_id = $${params.length}`; }
  params.push(limit);
  return (await pool.query(
    `SELECT m.*, o.order_number, e.tag AS equipment_tag
       FROM sg_measurements m
       JOIN sg_maintenance_orders o ON o.id = m.order_id
       JOIN sg_equipment e ON e.id = m.equipment_id
      WHERE ${where}
      ORDER BY m.measured_at DESC, m.id DESC
      LIMIT $${params.length}`,
    params
  )).rows;
}

async function createMeasurement(input, actor = "") {
  const order = await resolveOrder(input.orderId);
  const res = await pool.query(
    `INSERT INTO sg_measurements
      (order_id, equipment_id, technician_id, measured_at, metric, value, unit, notes, created_by, updated_by)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()), $5, $6, $7, $8, $9, $9)
     RETURNING *`,
    [input.orderId, order.equipment_id, input.technicianId, input.measuredAt, input.metric, input.value, input.unit, input.notes, actor]
  );
  await addHistory(order.equipment_id, "medicao", "sg_measurements", res.rows[0].id, `Medição ${input.metric}: ${input.value} ${input.unit}`.trim(), actor);
  return res.rows[0];
}

async function listParts({ orderId = null, equipmentId = null, limit = 100 } = {}) {
  const params = [];
  let where = "p.deleted_at IS NULL";
  if (orderId) { params.push(orderId); where += ` AND p.order_id = $${params.length}`; }
  if (equipmentId) { params.push(equipmentId); where += ` AND p.equipment_id = $${params.length}`; }
  params.push(limit);
  return (await pool.query(
    `SELECT p.*, o.order_number, e.tag AS equipment_tag
       FROM sg_replaced_parts p
       JOIN sg_maintenance_orders o ON o.id = p.order_id
       JOIN sg_equipment e ON e.id = p.equipment_id
      WHERE ${where}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${params.length}`,
    params
  )).rows;
}

async function createPart(input, actor = "") {
  const order = await resolveOrder(input.orderId);
  const res = await pool.query(
    `INSERT INTO sg_replaced_parts
      (order_id, equipment_id, part_description, part_code, manufacturer, quantity, reason,
       removed_condition, new_part_installed, evidence, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
     RETURNING *`,
    [input.orderId, order.equipment_id, input.partDescription, input.partCode, input.manufacturer, input.quantity, input.reason, input.removedCondition, input.newPartInstalled, input.evidence, actor]
  );
  await addHistory(order.equipment_id, "peca", "sg_replaced_parts", res.rows[0].id, `Peça substituída: ${input.partDescription}`, actor);
  return res.rows[0];
}

async function listReports({ orderId = null, equipmentId = null, limit = 100 } = {}) {
  const params = [];
  let where = "r.deleted_at IS NULL";
  if (orderId) { params.push(orderId); where += ` AND r.order_id = $${params.length}`; }
  if (equipmentId) { params.push(equipmentId); where += ` AND r.equipment_id = $${params.length}`; }
  params.push(limit);
  return (await pool.query(
    `SELECT r.*, o.order_number, e.tag AS equipment_tag
       FROM sg_associated_reports r
       JOIN sg_maintenance_orders o ON o.id = r.order_id
       JOIN sg_equipment e ON e.id = r.equipment_id
      WHERE ${where}
      ORDER BY COALESCE(r.issued_at, r.created_at) DESC, r.id DESC
      LIMIT $${params.length}`,
    params
  )).rows;
}

async function createReport(input, actor = "") {
  const order = await resolveOrder(input.orderId);
  const res = await pool.query(
    `INSERT INTO sg_associated_reports
      (order_id, equipment_id, report_code, title, issued_at, technician, report_type,
       file_ref, external_link, external_id, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
     RETURNING *`,
    [input.orderId, order.equipment_id, input.reportCode, input.title, input.issuedAt, input.technician, input.reportType, input.fileRef, input.externalLink, input.externalId, input.notes, actor]
  );
  await addHistory(order.equipment_id, "relatorio", "sg_associated_reports", res.rows[0].id, `Relatório associado: ${input.title}`, actor);
  return res.rows[0];
}

async function createAttachment(input, actor = "") {
  const res = await pool.query(
    `INSERT INTO sg_attachments (entity_type, entity_id, file_ref, kind, label, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING *`,
    [input.entityType, input.entityId, input.fileRef, input.kind, input.label, input.notes, actor]
  );
  return res.rows[0];
}

async function listAttachments({ entityType = "", entityId = null } = {}) {
  const params = [];
  let where = "deleted_at IS NULL";
  if (entityType) { params.push(entityType); where += ` AND entity_type = $${params.length}`; }
  if (entityId) { params.push(entityId); where += ` AND entity_id = $${params.length}`; }
  return (await pool.query(`SELECT * FROM sg_attachments WHERE ${where} ORDER BY created_at DESC, id DESC`, params)).rows;
}

async function createEvent(input, actor = "") {
  const res = await pool.query(
    `INSERT INTO sg_events
      (equipment_id, generated_order_id, event_type, severity, occurred_at, description, action_taken, created_by, updated_by)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6, $7, $8, $8)
     RETURNING *`,
    [input.equipmentId, input.generatedOrderId, input.eventType, input.severity, input.occurredAt, input.description, input.actionTaken, actor]
  );
  await addHistory(input.equipmentId, "evento", "sg_events", res.rows[0].id, `${input.eventType}: ${input.description}`, actor);
  return res.rows[0];
}

async function listEvents({ equipmentId = null, limit = 100 } = {}) {
  const params = [];
  let where = "ev.deleted_at IS NULL";
  if (equipmentId) { params.push(equipmentId); where += ` AND ev.equipment_id = $${params.length}`; }
  params.push(limit);
  return (await pool.query(
    `SELECT ev.*, e.tag AS equipment_tag
       FROM sg_events ev JOIN sg_equipment e ON e.id = ev.equipment_id
      WHERE ${where}
      ORDER BY ev.occurred_at DESC, ev.id DESC
      LIMIT $${params.length}`,
    params
  )).rows;
}

async function listRecommendations({ equipmentId = null, orderId = null, status = "", limit = 100 } = {}) {
  const params = [];
  let where = "r.deleted_at IS NULL AND e.deleted_at IS NULL";
  if (equipmentId) { params.push(equipmentId); where += ` AND r.equipment_id = $${params.length}`; }
  if (orderId) { params.push(orderId); where += ` AND r.order_id = $${params.length}`; }
  if (status) { params.push(status); where += ` AND r.status = $${params.length}`; }
  params.push(limit);
  return (await pool.query(
    `SELECT r.*, e.tag AS equipment_tag, o.order_number, ar.report_code
       FROM sg_recommendations r
       JOIN sg_equipment e ON e.id = r.equipment_id
       LEFT JOIN sg_maintenance_orders o ON o.id = r.order_id
       LEFT JOIN sg_associated_reports ar ON ar.id = r.report_id
      WHERE ${where}
      ORDER BY
        CASE WHEN r.status IN ('aberta','em_analise','aprovada','vencida') THEN 0 ELSE 1 END,
        r.due_date NULLS LAST,
        r.id DESC
      LIMIT $${params.length}`,
    params
  )).rows;
}

async function createRecommendation(input, actor = "") {
  let equipmentId = input.equipmentId;
  if (input.orderId) {
    const order = await resolveOrder(input.orderId);
    equipmentId = order.equipment_id;
  } else {
    await resolveEquipment(equipmentId);
  }
  const res = await pool.query(
    `INSERT INTO sg_recommendations
      (equipment_id, order_id, report_id, description, technical_reason, criticality,
       due_date, responsible, status, evidence, notes, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
     RETURNING *`,
    [
      equipmentId,
      input.orderId,
      input.reportId,
      input.description,
      input.technicalReason,
      input.criticality,
      input.dueDate,
      input.responsible,
      input.status,
      input.evidence,
      input.notes,
      actor
    ]
  );
  await addHistory(equipmentId, "recomendacao", "sg_recommendations", res.rows[0].id, `Recomendacao: ${input.description}`, actor);
  return res.rows[0];
}

async function updateRecommendationStatus(id, input, actor = "") {
  const res = await pool.query(
    `UPDATE sg_recommendations
        SET status = $2,
            notes = CASE WHEN $3::text <> '' THEN $3 ELSE notes END,
            updated_by = $4,
            updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id, input.status, input.notes, actor]
  );
  const recommendation = res.rows[0] || null;
  if (recommendation) {
    await addHistory(recommendation.equipment_id, "recomendacao_status", "sg_recommendations", recommendation.id, `Recomendacao alterada para ${input.status}`, actor);
  }
  return recommendation;
}

async function addHistory(equipmentId, eventKind, refTable, refId, summary, actor = "") {
  return (await pool.query(
    `INSERT INTO sg_equipment_history (equipment_id, event_kind, ref_table, ref_id, summary, actor)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [equipmentId, eventKind, refTable, refId, summary, actor]
  )).rows[0];
}

async function listHistory({ equipmentId = null, limit = 100 } = {}) {
  const params = [];
  let where = "TRUE";
  if (equipmentId) { params.push(equipmentId); where += ` AND h.equipment_id = $${params.length}`; }
  params.push(limit);
  return (await pool.query(
    `SELECT h.*, e.tag AS equipment_tag, c.name AS client_name
       FROM sg_equipment_history h
      JOIN sg_equipment e ON e.id = h.equipment_id
      JOIN sg_clients c ON c.id = e.client_id
      WHERE ${where} AND e.deleted_at IS NULL AND c.deleted_at IS NULL
      ORDER BY h.occurred_at DESC, h.id DESC
      LIMIT $${params.length}`,
    params
  )).rows;
}

async function generateCalendar({ year, equipmentId = null }, actor = "") {
  const params = [];
  let where = "ep.deleted_at IS NULL AND ep.active = TRUE AND pi.deleted_at IS NULL AND pi.next_due_date IS NOT NULL";
  if (equipmentId) { params.push(equipmentId); where += ` AND ep.equipment_id = $${params.length}`; }
  const rows = (await pool.query(
    `SELECT ep.equipment_id, pi.id AS plan_item_id, pi.maintenance_type, pi.next_due_date
       FROM sg_plan_items pi
       JOIN sg_equipment_plans ep ON ep.id = pi.plan_id
      WHERE ${where}`,
    params
  )).rows;
  let inserted = 0;
  for (const row of rows) {
    const base = new Date(row.next_due_date);
    const planned = new Date(Date.UTC(year, base.getUTCMonth(), base.getUTCDate()));
    const res = await pool.query(
      `INSERT INTO sg_calendar_entries
        (equipment_id, plan_item_id, year, month, maintenance_type, planned_date, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (equipment_id, plan_item_id, planned_date) DO NOTHING
       RETURNING id`,
      [row.equipment_id, row.plan_item_id, year, planned.getUTCMonth() + 1, row.maintenance_type, planned.toISOString().slice(0, 10), actor]
    );
    inserted += res.rowCount;
  }
  return { inserted, scanned: rows.length };
}

async function listCalendar({ year = new Date().getFullYear(), month = null, equipmentId = null } = {}) {
  const params = [year];
  let where = "ce.deleted_at IS NULL AND ce.year = $1";
  if (month) { params.push(month); where += ` AND ce.month = $${params.length}`; }
  if (equipmentId) { params.push(equipmentId); where += ` AND ce.equipment_id = $${params.length}`; }
  return (await pool.query(
    `SELECT ce.*, e.tag AS equipment_tag, c.name AS client_name, s.name AS site_name
       FROM sg_calendar_entries ce
      JOIN sg_equipment e ON e.id = ce.equipment_id
      JOIN sg_clients c ON c.id = e.client_id
      JOIN sg_sites s ON s.id = e.site_id
      WHERE ${where} AND e.deleted_at IS NULL AND c.deleted_at IS NULL AND s.deleted_at IS NULL
      ORDER BY ce.planned_date ASC, e.tag ASC`,
    params
  )).rows;
}

async function dashboard({ clientId = null } = {}) {
  const clientFilter = clientId ? " AND e.client_id = $1" : "";
  const params = clientId ? [clientId] : [];
  const one = async (sql) => (await pool.query(sql, params)).rows[0];
  const equipment = await one(`SELECT COUNT(*)::int AS total FROM sg_equipment e WHERE e.deleted_at IS NULL${clientFilter}`);
  const orders = await one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE o.status IN ('concluida','concluida_com_pendencias'))::int AS done, COUNT(*) FILTER (WHERE o.maintenance_type='corretiva')::int AS corrective FROM sg_maintenance_orders o JOIN sg_equipment e ON e.id=o.equipment_id WHERE o.deleted_at IS NULL${clientFilter}`);
  const overdue = await one(`SELECT COUNT(*)::int AS total FROM sg_calendar_entries ce JOIN sg_equipment e ON e.id=ce.equipment_id WHERE ce.deleted_at IS NULL AND e.deleted_at IS NULL AND ce.status='planejada' AND ce.planned_date < CURRENT_DATE${clientFilter}`);
  const noPlan = await one(`SELECT COUNT(*)::int AS total FROM sg_equipment e WHERE e.deleted_at IS NULL${clientFilter} AND NOT EXISTS (SELECT 1 FROM sg_equipment_plans p WHERE p.equipment_id=e.id AND p.deleted_at IS NULL AND p.active=TRUE)`);
  const events = await one(`SELECT COUNT(*)::int AS total FROM sg_events ev JOIN sg_equipment e ON e.id=ev.equipment_id WHERE ev.deleted_at IS NULL AND e.deleted_at IS NULL${clientFilter}`);
  const reports = await one(`SELECT COUNT(*)::int AS total FROM sg_associated_reports r JOIN sg_equipment e ON e.id=r.equipment_id WHERE r.deleted_at IS NULL AND e.deleted_at IS NULL${clientFilter}`);
  const recommendations = await one(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE r.status IN ('aberta','em_analise','aprovada','vencida'))::int AS open, COUNT(*) FILTER (WHERE r.criticality IN ('alta','critica','missao_critica'))::int AS critical FROM sg_recommendations r JOIN sg_equipment e ON e.id=r.equipment_id WHERE r.deleted_at IS NULL AND e.deleted_at IS NULL${clientFilter}`);
  return { equipment: equipment.total, orders, overdue: overdue.total, equipmentWithoutPlan: noPlan.total, events: events.total, associatedReports: reports.total, recommendations };
}

module.exports = {
  listMeasurements, createMeasurement,
  listParts, createPart,
  listReports, createReport,
  listAttachments, createAttachment,
  listEvents, createEvent,
  listRecommendations, createRecommendation, updateRecommendationStatus,
  listHistory, addHistory,
  generateCalendar, listCalendar,
  dashboard
};
