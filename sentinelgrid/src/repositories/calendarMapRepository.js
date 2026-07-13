const pool = require("../db");
const { classifyEvent, eventGeneralStatus, worstStatus } = require("../services/calendarClassifier");
const { GENERAL_STATUS } = require("../constants");
const { validateTechnicianSchedule } = require("../services/technicianScheduleValidator");

// Fase 10 · Fatia 10.1 — Motor de agregação do Mapa Calendário de Manutenção.
// READ-ONLY: não cria tabela de eventos; apenas agrega/normaliza o que já existe
// (calendar entries, OMs, recomendações, relatórios, eventos, status do equipamento).
// A classificação de prioridade/cor/status geral entra na Fatia 10.3; aqui já
// derivamos `is_overdue` e `days_to_due`.

// Junção-base equipamento → cliente/site/área, reusada pelas fontes derivadas do ativo.
const EQUIP_JOIN = `
  JOIN sg_equipment e ON e.id = SRC_EQUIP
  JOIN sg_clients c ON c.id = e.client_id AND c.deleted_at IS NULL
  LEFT JOIN sg_sites s ON s.id = e.site_id
  LEFT JOIN sg_areas ar ON ar.id = e.area_id`;

// Colunas normalizadas comuns a todas as fontes (contrato A.3 do planner).
// Ordem fixa — todos os SELECTs do UNION devem casar exatamente.
function source(equipExpr, body) {
  return body.replace(/SRC_EQUIP/g, equipExpr);
}

// UNION ALL das 10 fontes. Sem parâmetros aqui — os filtros são aplicados na
// query externa (mantém a lista de params simples e previsível).
const EVENTS_UNION = `
-- 1) Manutenção planejada (calendar entries ainda sem OM gerada)
${source("ce.equipment_id", `
SELECT 'calendar_entry' AS source_kind, 'sg_calendar_entries' AS ref_table, ce.id AS ref_id,
  CASE WHEN ce.maintenance_type = 'preventiva_com_parada' THEN 'planejada_com_parada' ELSE 'planejada_sem_parada' END AS event_kind,
  'Manutenção planejada' AS title,
  e.client_id, c.name AS client_name, e.site_id, s.name AS site_name, e.area_id, ar.name AS area_name,
  e.id AS equipment_id, e.tag AS equipment_tag, e.equipment_type_id,
  ce.maintenance_type, ce.planned_date::date AS event_date, ce.status, e.criticality,
  e.internal_technician AS responsible, 'Executar manutenção planejada' AS action_needed
FROM sg_calendar_entries ce ${EQUIP_JOIN}
WHERE ce.deleted_at IS NULL AND e.deleted_at IS NULL
  AND ce.generated_order_id IS NULL
  AND ce.status NOT IN ('concluida','cancelada')`)}

UNION ALL
-- 2) OM preventiva planejada/agendada/em execução (exclui corretiva e aprovação pendente)
${source("o.equipment_id", `
SELECT 'maintenance_order' AS source_kind, 'sg_maintenance_orders' AS ref_table, o.id AS ref_id,
  'om_manutencao' AS event_kind,
  ('OM ' || o.order_number) AS title,
  e.client_id, c.name, e.site_id, s.name, e.area_id, ar.name,
  e.id, e.tag, e.equipment_type_id,
  o.maintenance_type, COALESCE(o.scheduled_date::date, o.planned_date) AS event_date, o.status, e.criticality,
  o.technician_id AS responsible, 'Acompanhar ordem de manutenção' AS action_needed
FROM sg_maintenance_orders o ${EQUIP_JOIN}
WHERE o.deleted_at IS NULL AND e.deleted_at IS NULL
  AND o.maintenance_type <> 'corretiva'
  AND o.status IN ('planejada','agendada','aprovada','em_execucao','reprogramada')`)}

UNION ALL
-- 3) Corretiva aberta
${source("o.equipment_id", `
SELECT 'maintenance_order' AS source_kind, 'sg_maintenance_orders' AS ref_table, o.id AS ref_id,
  'corretiva_aberta' AS event_kind,
  ('Corretiva ' || o.order_number) AS title,
  e.client_id, c.name, e.site_id, s.name, e.area_id, ar.name,
  e.id, e.tag, e.equipment_type_id,
  o.maintenance_type, COALESCE(o.planned_date, o.created_at::date) AS event_date, o.status, e.criticality,
  o.technician_id AS responsible, 'Tratar manutenção corretiva' AS action_needed
FROM sg_maintenance_orders o ${EQUIP_JOIN}
WHERE o.deleted_at IS NULL AND e.deleted_at IS NULL
  AND o.maintenance_type = 'corretiva'
  AND o.status NOT IN ('concluida','concluida_com_pendencias','cancelada')`)}

UNION ALL
-- 4) Aprovação de parada pendente
${source("o.equipment_id", `
SELECT 'maintenance_order' AS source_kind, 'sg_maintenance_orders' AS ref_table, o.id AS ref_id,
  'aprovacao_pendente' AS event_kind,
  ('Aprovação pendente ' || o.order_number) AS title,
  e.client_id, c.name, e.site_id, s.name, e.area_id, ar.name,
  e.id, e.tag, e.equipment_type_id,
  o.maintenance_type, COALESCE(o.planned_date, o.created_at::date) AS event_date, o.status, e.criticality,
  o.technician_id AS responsible, 'Obter aprovação do cliente para parada' AS action_needed
FROM sg_maintenance_orders o ${EQUIP_JOIN}
WHERE o.deleted_at IS NULL AND e.deleted_at IS NULL
  AND o.status = 'aguardando_aprovacao'`)}

UNION ALL
-- 5) Recomendação técnica (crítica ou com prazo) ainda aberta
${source("r.equipment_id", `
SELECT 'recommendation' AS source_kind, 'sg_recommendations' AS ref_table, r.id AS ref_id,
  CASE WHEN r.criticality IN ('alta','missao_critica') THEN 'recomendacao_critica' ELSE 'recomendacao_prazo' END AS event_kind,
  ('Recomendação: ' || LEFT(r.description, 80)) AS title,
  e.client_id, c.name, e.site_id, s.name, e.area_id, ar.name,
  e.id, e.tag, e.equipment_type_id,
  '' AS maintenance_type, COALESCE(r.due_date, r.created_at::date) AS event_date, r.status, r.criticality,
  r.responsible, 'Analisar/executar recomendação' AS action_needed
FROM sg_recommendations r ${EQUIP_JOIN}
WHERE r.deleted_at IS NULL AND e.deleted_at IS NULL
  AND r.status IN ('aberta','em_analise','aprovada','vencida')
  AND (r.criticality IN ('alta','missao_critica') OR r.due_date IS NOT NULL)`)}

UNION ALL
-- 6) Relatório obrigatório pendente (OM concluída, contrato exige, sem relatório associado)
${source("o.equipment_id", `
SELECT 'pending_report' AS source_kind, 'sg_maintenance_orders' AS ref_table, o.id AS ref_id,
  'relatorio_pendente' AS event_kind,
  ('Relatório pendente ' || o.order_number) AS title,
  e.client_id, c.name, e.site_id, s.name, e.area_id, ar.name,
  e.id, e.tag, e.equipment_type_id,
  o.maintenance_type, COALESCE(o.executed_date::date, o.updated_at::date) AS event_date, o.status, e.criticality,
  o.technician_id AS responsible, 'Associar relatório técnico obrigatório' AS action_needed
FROM sg_maintenance_orders o ${EQUIP_JOIN}
WHERE o.deleted_at IS NULL AND e.deleted_at IS NULL
  AND o.status IN ('concluida','concluida_com_pendencias')
  AND EXISTS (SELECT 1 FROM sg_contracts ct WHERE ct.client_id = e.client_id AND ct.deleted_at IS NULL AND ct.requires_report = TRUE)
  AND NOT EXISTS (SELECT 1 FROM sg_associated_reports arp WHERE arp.order_id = o.id AND arp.deleted_at IS NULL)`)}

UNION ALL
-- 7) Evento crítico/alarme relevante
${source("ev.equipment_id", `
SELECT 'event' AS source_kind, 'sg_events' AS ref_table, ev.id AS ref_id,
  'evento_critico' AS event_kind,
  (ev.event_type || ': ' || LEFT(ev.description, 80)) AS title,
  e.client_id, c.name, e.site_id, s.name, e.area_id, ar.name,
  e.id, e.tag, e.equipment_type_id,
  '' AS maintenance_type, ev.occurred_at::date AS event_date, ev.severity AS status, e.criticality,
  '' AS responsible, 'Avaliar evento/alarme' AS action_needed
FROM sg_events ev ${EQUIP_JOIN}
WHERE ev.deleted_at IS NULL AND e.deleted_at IS NULL
  AND ev.severity IN ('alta','critica')`)}

UNION ALL
-- 8) Equipamento em condição restrita (marcador corrente)
${source("e.id", `
SELECT 'equipment_status' AS source_kind, 'sg_equipment' AS ref_table, e.id AS ref_id,
  'equip_restrito' AS event_kind,
  ('Equipamento em restrição: ' || e.tag) AS title,
  e.client_id, c.name, e.site_id, s.name, e.area_id, ar.name,
  e.id, e.tag, e.equipment_type_id,
  '' AS maintenance_type, CURRENT_DATE AS event_date, e.operational_status AS status, e.criticality,
  e.internal_technician AS responsible, 'Verificar condição operacional do equipamento' AS action_needed
FROM sg_equipment e
  JOIN sg_clients c ON c.id = e.client_id AND c.deleted_at IS NULL
  LEFT JOIN sg_sites s ON s.id = e.site_id
  LEFT JOIN sg_areas ar ON ar.id = e.area_id
WHERE e.deleted_at IS NULL
  AND e.operational_status IN ('operacional_restricao','em_observacao','indisponivel')`)}
`;

// event_kinds que representam manutenção sujeita a vencimento (para is_overdue).
const OVERDUE_KINDS = "('planejada_sem_parada','planejada_com_parada','om_manutencao','corretiva_aberta','aprovacao_pendente')";

function buildFilters(f, params) {
  const clauses = [];
  const add = (val, sql) => { params.push(val); clauses.push(sql.replace("$$", `$${params.length}`)); };
  if (f.from) add(f.from, "ev.event_date >= $$");
  if (f.to) add(f.to, "ev.event_date <= $$");
  if (f.clientId) add(f.clientId, "ev.client_id = $$");
  if (f.siteId) add(f.siteId, "ev.site_id = $$");
  if (f.areaId) add(f.areaId, "ev.area_id = $$");
  if (f.equipmentId) add(f.equipmentId, "ev.equipment_id = $$");
  if (f.equipmentTypeId) add(f.equipmentTypeId, "ev.equipment_type_id = $$");
  if (f.criticality) add(f.criticality, "ev.criticality = $$");
  if (f.maintenanceType) add(f.maintenanceType, "ev.maintenance_type = $$");
  if (f.status) add(f.status, "ev.status = $$");
  if (f.responsible) add(`%${String(f.responsible).toLowerCase()}%`, "LOWER(ev.responsible) LIKE $$");
  if (f.onlyCriticalRec) clauses.push("ev.event_kind = 'recomendacao_critica'");
  if (f.onlyPendingApproval) clauses.push("ev.event_kind = 'aprovacao_pendente'");
  if (f.onlyPendingReport) clauses.push("ev.event_kind = 'relatorio_pendente'");
  return clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
}

async function listMapEvents(filters = {}) {
  const params = [];
  const where = buildFilters(filters, params);
  const limit = Math.min(5000, Math.max(1, Number(filters.limit) || 2000));
  params.push(limit);
  const sql = `
    WITH ev AS (${EVENTS_UNION})
    SELECT ev.source_kind, ev.ref_table, ev.ref_id, ev.event_kind, ev.title,
      ev.client_id, ev.client_name, ev.site_id, ev.site_name, ev.area_id, ev.area_name,
      ev.equipment_id, ev.equipment_tag, ev.equipment_type_id,
      ev.maintenance_type, to_char(ev.event_date, 'YYYY-MM-DD') AS event_date,
      ev.status, ev.criticality, ev.responsible, ev.action_needed,
      (ev.event_date < CURRENT_DATE AND ev.event_kind IN ${OVERDUE_KINDS}) AS is_overdue,
      (ev.event_date - CURRENT_DATE) AS days_to_due,
      -- Classificação por regra de vencimento (§8/A.9). Só para manutenções.
      CASE
        WHEN ev.event_kind NOT IN ${OVERDUE_KINDS} THEN NULL
        WHEN ev.event_date < CURRENT_DATE THEN 'vencida'
        WHEN NOT COALESCE(r.critical_after_due, FALSE)
             AND (ev.event_date - CURRENT_DATE) <= COALESCE(r.critical_alert_days, 7) THEN 'critica'
        WHEN (ev.event_date - CURRENT_DATE) <= COALESCE(r.first_alert_days, 30) THEN 'proxima'
        ELSE 'planejada'
      END AS alert_level
    FROM ev
    LEFT JOIN sg_calendar_alert_rules r ON r.criticality = ev.criticality
    ${where}
    ORDER BY ev.event_date ASC,
      CASE ev.criticality WHEN 'missao_critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      ev.equipment_tag ASC
    LIMIT $${params.length}`;
  // Classificação (10.3): anexa cor (A.7) e prioridade (A.8) a cada evento.
  return (await pool.query(sql, params)).rows.map(classifyEvent);
}

async function moveCalendarEvents(items, sourceDate, targetDate, actor = "") {
  const unique = Array.from(new Map(items.map((item) => [`${item.refTable}:${item.refId}`, item])).values());
  const client = await pool.connect();
  let moved = 0;
  try {
    await client.query("BEGIN");
    for (const item of unique) {
      let result;
      if (item.refTable === "sg_calendar_entries") {
        result = await client.query(
          `UPDATE sg_calendar_entries SET planned_date=$3, updated_by=$4, updated_at=NOW()
            WHERE id=$1 AND planned_date::date=$2::date AND deleted_at IS NULL`,
          [item.refId, sourceDate, targetDate, actor]
        );
      } else if (item.refTable === "sg_maintenance_orders") {
        await validateTechnicianSchedule(client, item.refId, { startDate: targetDate });
        result = await client.query(
          `UPDATE sg_maintenance_orders
              SET planned_date=$3,
                  scheduled_date=CASE WHEN scheduled_date IS NULL THEN NULL ELSE $3::date END,
                  updated_by=$4, updated_at=NOW()
            WHERE id=$1
              AND (COALESCE(scheduled_date::date, planned_date, created_at::date)=$2::date
                   OR COALESCE(planned_date, created_at::date)=$2::date)
              AND deleted_at IS NULL`,
          [item.refId, sourceDate, targetDate, actor]
        );
      } else if (item.refTable === "sg_recommendations") {
        result = await client.query(
          `UPDATE sg_recommendations SET due_date=$3, updated_by=$4, updated_at=NOW()
            WHERE id=$1 AND COALESCE(due_date, created_at::date)=$2::date AND deleted_at IS NULL`,
          [item.refId, sourceDate, targetDate, actor]
        );
      } else {
        const err = new Error(`Origem não pode ser reagendada: ${item.refTable}`);
        err.code = "SG_CALENDAR_MOVE_UNSUPPORTED";
        throw err;
      }
      moved += result.rowCount;
    }
    if (moved !== unique.length) {
      const err = new Error("O calendário foi alterado por outro usuário. Atualize e tente novamente.");
      err.code = "SG_CALENDAR_MOVE_STALE";
      throw err;
    }
    await client.query("COMMIT");
    return { moved };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Rollup por cliente (contadores). Status geral (pior condição) fica na Fatia 10.3;
// aqui entregamos os contadores que não dependem das regras de vencimento.
async function mapSummary(filters = {}) {
  const events = await listMapEvents({ ...filters, limit: 5000 });
  const byClient = new Map();
  for (const ev of events) {
    const key = ev.client_id;
    if (!byClient.has(key)) {
      byClient.set(key, {
        client_id: ev.client_id, client_name: ev.client_name,
        total: 0, overdue: 0, upcoming: 0, corrective_open: 0, pending_approval: 0,
        critical_rec: 0, pending_report: 0, restricted_equip: 0, general_status: "normal"
      });
    }
    const row = byClient.get(key);
    // Status geral do cliente = pior condição entre seus eventos (A.10).
    const evStatus = eventGeneralStatus(ev);
    if (GENERAL_STATUS.indexOf(evStatus) > GENERAL_STATUS.indexOf(row.general_status)) row.general_status = evStatus;
    row.total += 1;
    if (ev.is_overdue) row.overdue += 1;
    if (ev.alert_level === "proxima" || ev.alert_level === "critica") row.upcoming += 1;
    if (ev.event_kind === "corretiva_aberta") row.corrective_open += 1;
    if (ev.event_kind === "aprovacao_pendente") row.pending_approval += 1;
    if (ev.event_kind === "recomendacao_critica") row.critical_rec += 1;
    if (ev.event_kind === "relatorio_pendente") row.pending_report += 1;
    if (ev.event_kind === "equip_restrito") row.restricted_equip += 1;
  }
  const clients = Array.from(byClient.values()).sort((a, b) => a.client_name.localeCompare(b.client_name));
  const totals = clients.reduce((acc, r) => ({
    total: acc.total + r.total, overdue: acc.overdue + r.overdue, upcoming: acc.upcoming + r.upcoming,
    corrective_open: acc.corrective_open + r.corrective_open, pending_approval: acc.pending_approval + r.pending_approval,
    critical_rec: acc.critical_rec + r.critical_rec, pending_report: acc.pending_report + r.pending_report,
    restricted_equip: acc.restricted_equip + r.restricted_equip
  }), { total: 0, overdue: 0, upcoming: 0, corrective_open: 0, pending_approval: 0, critical_rec: 0, pending_report: 0, restricted_equip: 0 });
  return { clients, totals, general_status: worstStatus(events), events: events.length };
}

// Alertas = eventos acionáveis (prioridade acima de "informativo"), ordenados por
// prioridade (desc) e depois por atraso/data. Base do popup e da tela de alertas.
const PRIORITY_RANK = { informativo: 0, atencao: 1, importante: 2, critico: 3, emergencial: 4 };

async function listAlerts(filters = {}) {
  const events = await listMapEvents({ ...filters, limit: 5000 });
  const alerts = events.filter((e) => e.priority && e.priority !== "informativo");
  alerts.sort((a, b) =>
    (PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]) ||
    (Number(b.is_overdue) - Number(a.is_overdue)) ||
    String(a.event_date).localeCompare(String(b.event_date))
  );
  const byPriority = alerts.reduce((acc, e) => { acc[e.priority] = (acc[e.priority] || 0) + 1; return acc; }, {});
  return { alerts, total: alerts.length, byPriority };
}

module.exports = { listMapEvents, moveCalendarEvents, mapSummary, listAlerts };
