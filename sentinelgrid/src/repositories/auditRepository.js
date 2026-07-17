const pool = require("../db");
const { buildEquipmentAudit } = require("../services/auditService");

const today = () => new Date().toISOString().slice(0, 10);

// Itens de plano ATIVO do(s) equipamento(s) — a fonte da cadência esperada.
async function fetchPlanItems(equipmentIds) {
  return (await pool.query(
    `SELECT ep.equipment_id, pi.id, pi.plan_id, pi.title, pi.maintenance_type, pi.periodicity,
            to_char(pi.next_due_date, 'YYYY-MM-DD') AS next_due_date,
            ep.name AS plan_name, mp.name AS program_name
       FROM sg_plan_items pi
       JOIN sg_equipment_plans ep ON ep.id = pi.plan_id AND ep.deleted_at IS NULL AND ep.active = TRUE
       LEFT JOIN sg_maintenance_programs mp ON mp.id = ep.program_id
      WHERE pi.deleted_at IS NULL AND ep.equipment_id = ANY($1::bigint[])
      ORDER BY ep.name, pi.order_index, pi.id`,
    [equipmentIds]
  )).rows;
}

// OMs do(s) equipamento(s), com data de execução efetiva (COALESCE(executed_date, updated_at)).
async function fetchOrders(equipmentIds) {
  return (await pool.query(
    `SELECT o.equipment_id, o.id, o.order_number, o.plan_id, o.plan_item_id,
            o.maintenance_type, o.status,
            to_char(o.planned_date, 'YYYY-MM-DD') AS planned_date,
            to_char(COALESCE(o.executed_date, o.updated_at)::date, 'YYYY-MM-DD') AS exec_effective,
            ep.name AS plan_name
       FROM sg_maintenance_orders o
       LEFT JOIN sg_equipment_plans ep ON ep.id = o.plan_id
      WHERE o.deleted_at IS NULL AND o.equipment_id = ANY($1::bigint[])`,
    [equipmentIds]
  )).rows;
}

function groupByEquipment(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = Number(row.equipment_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

async function getEquipmentBrief(equipmentId) {
  return (await pool.query(
    `SELECT e.id, e.tag, e.criticality, e.operational_status,
            c.id AS client_id, c.name AS client_name,
            s.id AS site_id, s.name AS site_name,
            a.name AS area_name
       FROM sg_equipment e
       JOIN sg_clients c ON c.id = e.client_id
       JOIN sg_sites s ON s.id = e.site_id
       JOIN sg_areas a ON a.id = e.area_id
      WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [equipmentId]
  )).rows[0] || null;
}

// Auditoria de UM equipamento: retorna o cabeçalho + resumo + ocorrências (cadência × OMs).
async function auditEquipment({ equipmentId, from, to }) {
  const equipment = await getEquipmentBrief(equipmentId);
  if (!equipment) return null;

  const [planItems, orders] = await Promise.all([
    fetchPlanItems([equipmentId]),
    fetchOrders([equipmentId])
  ]);

  const { occurrences, summary } = buildEquipmentAudit({
    planItems,
    orders,
    from,
    to,
    today: today()
  });

  return { equipment, from, to, summary, occurrences };
}

// Auditoria POR CLIENTE (+ site opcional): apenas um filtro que roda a auditoria de cada
// equipamento e devolve o RESUMO de cada um, mais o agregado do conjunto.
async function auditClient({ clientId, siteId = null, from, to }) {
  const params = [clientId];
  let where = "e.deleted_at IS NULL AND e.client_id = $1";
  if (siteId) {
    params.push(siteId);
    where += ` AND e.site_id = $${params.length}`;
  }
  const equipments = (await pool.query(
    `SELECT e.id, e.tag, e.criticality, e.operational_status,
            s.id AS site_id, s.name AS site_name, a.name AS area_name
       FROM sg_equipment e
       JOIN sg_sites s ON s.id = e.site_id
       JOIN sg_areas a ON a.id = e.area_id
      WHERE ${where}
      ORDER BY s.name, e.tag`,
    params
  )).rows;

  if (!equipments.length) {
    return { clientId, siteId, from, to, equipments: [], aggregate: emptyAggregate() };
  }

  const ids = equipments.map((e) => Number(e.id));
  const [planItems, orders] = await Promise.all([fetchPlanItems(ids), fetchOrders(ids)]);
  const planItemsByEq = groupByEquipment(planItems);
  const ordersByEq = groupByEquipment(orders);
  const stamp = today();

  const rows = equipments.map((equipment) => {
    const { summary } = buildEquipmentAudit({
      planItems: planItemsByEq.get(Number(equipment.id)) || [],
      orders: ordersByEq.get(Number(equipment.id)) || [],
      from,
      to,
      today: stamp
    });
    return { equipment, summary };
  });

  return { clientId, siteId, from, to, equipments: rows, aggregate: aggregate(rows) };
}

function emptyAggregate() {
  return {
    equipamentos: 0,
    esperadasPassado: 0,
    cumpridas: 0,
    noPrazo: 0,
    aproximado: 0,
    foraPrazo: 0,
    comPendencias: 0,
    emAberto: 0,
    lacunas: 0,
    adherenceRate: null,
    executionRate: null
  };
}

// Soma os resumos de cada equipamento num total do cliente/site.
function aggregate(rows) {
  const acc = emptyAggregate();
  acc.equipamentos = rows.length;
  for (const { summary } of rows) {
    acc.esperadasPassado += summary.esperadasPassado;
    acc.cumpridas += summary.cumpridas;
    acc.noPrazo += summary.noPrazo;
    acc.aproximado += summary.aproximado;
    acc.foraPrazo += summary.foraPrazo;
    acc.comPendencias += summary.comPendencias;
    acc.emAberto += summary.emAberto;
    acc.lacunas += summary.lacunas;
  }
  const aderentes = acc.noPrazo + acc.aproximado;
  acc.adherenceRate = acc.esperadasPassado ? Math.round((aderentes / acc.esperadasPassado) * 100) : null;
  acc.executionRate = acc.esperadasPassado ? Math.round((acc.cumpridas / acc.esperadasPassado) * 100) : null;
  return acc;
}

module.exports = { auditEquipment, auditClient };
