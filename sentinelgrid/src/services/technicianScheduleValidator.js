// O vínculo criado pelo pré-agendamento já reserva o período antes da transição
// para Agendada; estados finais/cancelados deixam de ocupar a agenda.
const ACTIVE_SCHEDULE_STATUSES = [
  "planejada", "agendada", "aguardando_aprovacao", "aprovada",
  "em_execucao", "reprogramada", "emergencial"
];

function conflictError(row) {
  const err = new Error(
    `${row.technician_name} já está na ${row.order_number} em ${row.client_name} / ${row.site_name || "Sem site"} ` +
    `de ${row.start_date} até ${row.end_date}.`
  );
  err.code = "SG_TECHNICIAN_SCHEDULE_CONFLICT";
  err.conflict = row;
  return err;
}

async function validateTechnicianSchedule(client, orderId, overrides = {}) {
  const order = (await client.query(
    `SELECT id, client_id, site_id, status, execution_days,
            COALESCE(scheduled_date::date, planned_date) AS start_date
       FROM sg_maintenance_orders WHERE id=$1 AND deleted_at IS NULL`, [orderId]
  )).rows[0];
  if (!order) return;

  const startDate = overrides.startDate || order.start_date;
  const executionDays = Number(overrides.executionDays || order.execution_days || 1);
  const clientId = Number(overrides.clientId || order.client_id);
  const siteId = overrides.siteId !== undefined ? overrides.siteId : order.site_id;
  let technicianIds = overrides.technicianIds;
  if (!technicianIds) technicianIds = (await client.query(
    "SELECT technician_id FROM sg_order_technicians WHERE order_id=$1", [orderId]
  )).rows.map((row) => Number(row.technician_id));
  technicianIds = [...new Set((technicianIds || []).map(Number).filter(Boolean))].sort((a, b) => a - b);
  if (!startDate || !technicianIds.length) return;

  // Serializa alterações da agenda do mesmo técnico para evitar conflitos concorrentes.
  for (const technicianId of technicianIds) {
    await client.query("SELECT pg_advisory_xact_lock(72001, $1)", [technicianId]);
  }

  const conflict = (await client.query(
    `SELECT t.id AS technician_id, t.name AS technician_name,
            o.id AS order_id, o.order_number, c.name AS client_name, s.name AS site_name,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date), 'DD/MM/YYYY') AS start_date,
            to_char(COALESCE(o.scheduled_date::date, o.planned_date) + (o.execution_days - 1), 'DD/MM/YYYY') AS end_date
       FROM sg_order_technicians ot
       JOIN sg_technicians t ON t.id=ot.technician_id AND t.deleted_at IS NULL
       JOIN sg_maintenance_orders o ON o.id=ot.order_id AND o.deleted_at IS NULL
       JOIN sg_clients c ON c.id=o.client_id
       LEFT JOIN sg_sites s ON s.id=o.site_id
      WHERE ot.technician_id=ANY($1::bigint[])
        AND o.id<>$2
        AND o.status=ANY($3::text[])
        AND COALESCE(o.scheduled_date::date, o.planned_date) IS NOT NULL
        AND COALESCE(o.scheduled_date::date, o.planned_date) <= $4::date + ($5::int - 1)
        AND COALESCE(o.scheduled_date::date, o.planned_date) + (o.execution_days - 1) >= $4::date
        AND (o.client_id<>$6 OR o.site_id IS DISTINCT FROM $7::bigint)
      ORDER BY o.scheduled_date NULLS LAST, o.planned_date, o.id LIMIT 1`,
    [technicianIds, orderId, ACTIVE_SCHEDULE_STATUSES, startDate, executionDays, clientId, siteId]
  )).rows[0];
  if (conflict) throw conflictError(conflict);
}

module.exports = { validateTechnicianSchedule };
