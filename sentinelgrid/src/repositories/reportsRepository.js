const pool = require("../db");

// Relatórios gerenciais — leitura agregada das OMs. Nunca escreve.
//
// Data de referência de uma OM no cronograma: COALESCE(scheduled_date::date, planned_date),
// ocupando execution_days a partir dela — a MESMA regra da agenda técnica
// (techniciansRepository.listTechnicianAgenda), para que cronograma e agenda não divirjam.

const ORDER_FROM = `FROM sg_maintenance_orders o
  JOIN sg_equipment e ON e.id = o.equipment_id
  JOIN sg_clients c ON c.id = o.client_id
  JOIN sg_sites s ON s.id = o.site_id
  JOIN sg_areas a ON a.id = o.area_id
  LEFT JOIN sg_equipment_plans p ON p.id = o.plan_id
  LEFT JOIN sg_plan_items pi ON pi.id = o.plan_item_id`;

const ORDER_COLS = `o.id AS order_id, o.order_number, o.status, o.priority,
  o.maintenance_type, o.execution_days, o.scope,
  to_char(COALESCE(o.scheduled_date::date, o.planned_date), 'YYYY-MM-DD') AS start_date,
  to_char(COALESCE(o.scheduled_date::date, o.planned_date) + (o.execution_days - 1), 'YYYY-MM-DD') AS end_date,
  to_char(o.planned_date, 'YYYY-MM-DD') AS planned_date,
  to_char(o.executed_date::date, 'YYYY-MM-DD') AS executed_date,
  e.id AS equipment_id, e.tag AS equipment_tag, e.criticality,
  c.id AS client_id, c.name AS client_name,
  s.id AS site_id, s.name AS site_name,
  a.name AS area_name,
  p.name AS plan_name, pi.title AS plan_item_title`;

// Recorte temporal: sobreposição do intervalo de execução da OM com [from, to].
const RANGE_WHERE = `o.deleted_at IS NULL
  AND COALESCE(o.scheduled_date::date, o.planned_date) IS NOT NULL
  AND COALESCE(o.scheduled_date::date, o.planned_date) <= $2::date
  AND COALESCE(o.scheduled_date::date, o.planned_date) + (o.execution_days - 1) >= $1::date`;

// Filtros opcionais compartilhados pelos três relatórios. $1/$2 já são from/to.
function applyFilters(filters, params) {
  const clauses = [];
  // Acrescenta o valor e devolve a cláusula já com o placeholder posicional certo.
  const push = (column, value) => {
    params.push(value);
    clauses.push(`${column} = $${params.length}`);
  };
  if (filters.clientId) push("o.client_id", filters.clientId);
  if (filters.siteId) push("o.site_id", filters.siteId);
  if (filters.equipmentId) push("o.equipment_id", filters.equipmentId);
  if (filters.maintenanceType) push("o.maintenance_type", filters.maintenanceType);
  if (filters.status) push("o.status", filters.status);
  // Cancelada polui cronograma gerencial; só aparece quando pedida explicitamente.
  if (!filters.status && !filters.includeCancelled) clauses.push("o.status <> 'cancelada'");
  return clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
}

// OMs do período — base dos cronogramas por equipamento e por cliente.
async function listOrdersInRange(filters) {
  const params = [filters.from, filters.to];
  const where = applyFilters(filters, params);
  return (await pool.query(
    `SELECT ${ORDER_COLS} ${ORDER_FROM} WHERE ${RANGE_WHERE}${where}
      ORDER BY c.name, s.name, e.tag, start_date, o.order_number`,
    params
  )).rows;
}

// Mesma janela, mas explodida por técnico vinculado (N:N via sg_order_technicians).
// Uma OM com dois técnicos vira duas linhas — é o que o relatório por técnico precisa.
async function listOrdersByTechnician(filters) {
  const params = [filters.from, filters.to];
  let where = applyFilters(filters, params);
  if (filters.technicianId) {
    params.push(filters.technicianId);
    where += ` AND t.id = $${params.length}`;
  }
  return (await pool.query(
    `SELECT ${ORDER_COLS}, t.id AS technician_id, t.name AS technician_name,
            t.role AS technician_role, t.company AS technician_company
       ${ORDER_FROM}
       JOIN sg_order_technicians ot ON ot.order_id = o.id
       JOIN sg_technicians t ON t.id = ot.technician_id AND t.deleted_at IS NULL
      WHERE ${RANGE_WHERE}${where}
      ORDER BY t.name, start_date, o.order_number`,
    params
  )).rows;
}

// OMs do período SEM técnico vinculado — linha "Não atribuídas" do relatório por técnico.
// Sem isso o total por técnico não fecha com o total de OMs do período.
async function listOrdersWithoutTechnician(filters) {
  const params = [filters.from, filters.to];
  const where = applyFilters(filters, params);
  return (await pool.query(
    `SELECT ${ORDER_COLS} ${ORDER_FROM}
      WHERE ${RANGE_WHERE}${where}
        AND NOT EXISTS (
          SELECT 1 FROM sg_order_technicians ot
           JOIN sg_technicians t ON t.id = ot.technician_id AND t.deleted_at IS NULL
          WHERE ot.order_id = o.id)
      ORDER BY start_date, o.order_number`,
    params
  )).rows;
}

module.exports = { listOrdersInRange, listOrdersByTechnician, listOrdersWithoutTechnician };
