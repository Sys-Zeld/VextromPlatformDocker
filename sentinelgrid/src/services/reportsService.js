const repo = require("../repositories/reportsRepository");

// Relatórios gerenciais do SentinelGrid.
//
// Os três relatórios (equipamento, técnico, cliente) produzem o MESMO formato de
// documento — mudam apenas a fonte das linhas e o critério de agrupamento. Isso
// permite um único exportador XLSX, um único template PDF e um único componente
// de tela, em vez de três de cada.
//
//   { key, title, subtitle, period, columns, rows[{ key, title, subtitle, tasks, summary }],
//     totals, generatedAt }

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MONTHS_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const DONE_STATUSES = new Set(["concluida", "concluida_com_pendencias"]);
const CLOSED_STATUSES = new Set([...DONE_STATUSES, "cancelada"]);

const STATUS_LABEL = {
  planejada: "Planejada",
  agendada: "Agendada",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  em_execucao: "Em execução",
  concluida: "Concluída",
  concluida_com_pendencias: "Concluída c/ pendências",
  reprogramada: "Reprogramada",
  cancelada: "Cancelada",
  emergencial: "Emergencial"
};

const TYPE_LABEL = {
  preventiva: "Preventiva",
  preventiva_com_parada: "Preventiva c/ parada",
  preditiva: "Preditiva",
  corretiva: "Corretiva",
  inspecao: "Inspeção"
};

const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const today = () => new Date().toISOString().slice(0, 10);

// Janela do relatório. Com mês → visão diária daquele mês; sem mês → visão mensal do ano.
function resolvePeriod({ year, month }) {
  const y = Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : new Date().getFullYear();
  const m = Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
  return m
    ? { year: y, month: m, granularity: "day", from: iso(y, m, 1), to: iso(y, m, lastDay(y, m)),
        label: `${MONTHS_FULL[m - 1]} / ${y}` }
    : { year: y, month: null, granularity: "month", from: iso(y, 1, 1), to: iso(y, 12, 31),
        label: String(y) };
}

// Colunas do cronograma: 12 meses do ano, ou os dias do mês selecionado.
function buildColumns(period) {
  if (period.granularity === "month") {
    return MONTHS.map((label, index) => {
      const m = index + 1;
      return { key: `m${m}`, label, from: iso(period.year, m, 1), to: iso(period.year, m, lastDay(period.year, m)) };
    });
  }
  return Array.from({ length: lastDay(period.year, period.month) }, (_, index) => {
    const date = iso(period.year, period.month, index + 1);
    return { key: `d${index + 1}`, label: String(index + 1).padStart(2, "0"), from: date, to: date };
  });
}

function emptySummary() {
  return { total: 0, concluidas: 0, pendentes: 0, atrasadas: 0, canceladas: 0, dias: 0 };
}

// Uma OM é "atrasada" quando a janela de execução já passou e ela não foi concluída
// nem cancelada. Cancelada nunca conta como atraso.
function accumulate(summary, order, stamp) {
  summary.total += 1;
  summary.dias += Number(order.execution_days) || 1;
  if (DONE_STATUSES.has(order.status)) summary.concluidas += 1;
  else if (order.status === "cancelada") summary.canceladas += 1;
  else {
    summary.pendentes += 1;
    if (order.end_date && order.end_date < stamp) summary.atrasadas += 1;
  }
  return summary;
}

// % de conclusão sobre o que não foi cancelado (cancelada não é falha de execução).
function withRates(summary) {
  const base = summary.total - summary.canceladas;
  summary.conclusaoRate = base ? Math.round((summary.concluidas / base) * 100) : null;
  return summary;
}

function toTask(order) {
  return {
    key: `om-${order.order_id}`,
    orderId: Number(order.order_id),
    orderNumber: order.order_number,
    startDate: order.start_date,
    endDate: order.end_date,
    status: order.status,
    statusLabel: STATUS_LABEL[order.status] || order.status,
    priority: order.priority || "informativo",
    maintenanceType: order.maintenance_type,
    maintenanceTypeLabel: TYPE_LABEL[order.maintenance_type] || order.maintenance_type,
    executionDays: Number(order.execution_days) || 1,
    equipmentTag: order.equipment_tag,
    clientName: order.client_name,
    siteName: order.site_name,
    technicianName: order.technician_name || null,
    planName: order.plan_name || null,
    label: order.plan_item_title || order.scope || order.order_number
  };
}

// Agrupa as OMs em linhas do relatório segundo a chave/título fornecidos.
function groupRows(orders, keyOf, headerOf) {
  const stamp = today();
  const map = new Map();
  for (const order of orders) {
    const key = keyOf(order);
    if (!map.has(key)) map.set(key, { key, ...headerOf(order), tasks: [], summary: emptySummary() });
    const row = map.get(key);
    row.tasks.push(toTask(order));
    accumulate(row.summary, order, stamp);
  }
  return [...map.values()]
    .map((row) => ({ ...row, summary: withRates(row.summary) }))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

// Total do relatório. Recalculado sobre as OMs distintas: no relatório por técnico
// a mesma OM aparece em várias linhas, e somar as linhas inflaria o total.
function buildTotals(rows) {
  const stamp = today();
  const seen = new Map();
  for (const row of rows) {
    for (const task of row.tasks) if (!seen.has(task.orderId)) seen.set(task.orderId, task);
  }
  const summary = emptySummary();
  for (const task of seen.values()) {
    // accumulate() consome o formato da linha SQL (snake_case), não o da task.
    accumulate(summary, { status: task.status, end_date: task.endDate, execution_days: task.executionDays }, stamp);
  }
  return { ...withRates(summary), linhas: rows.length };
}

function describeFilters(filters, rows) {
  const parts = [];
  const first = rows[0]?.tasks?.[0];
  if (filters.clientId && first?.clientName) parts.push(`Cliente: ${first.clientName}`);
  if (filters.siteId && first?.siteName) parts.push(`Site: ${first.siteName}`);
  if (filters.equipmentId && first?.equipmentTag) parts.push(`Equipamento: ${first.equipmentTag}`);
  if (filters.maintenanceType) parts.push(`Tipo: ${TYPE_LABEL[filters.maintenanceType] || filters.maintenanceType}`);
  if (filters.status) parts.push(`Status: ${STATUS_LABEL[filters.status] || filters.status}`);
  return parts.join(" · ");
}

function assemble({ key, title, groupLabel, period, rows, filters }) {
  const scope = describeFilters(filters, rows);
  return {
    key,
    title,
    groupLabel,
    subtitle: scope ? `${period.label} · ${scope}` : period.label,
    period,
    columns: buildColumns(period),
    rows,
    totals: buildTotals(rows),
    generatedAt: new Date().toISOString()
  };
}

// 1) Cronograma por equipamento — uma linha por equipamento, OMs planejadas no período.
async function equipmentSchedule(filters) {
  const period = resolvePeriod(filters);
  const orders = await repo.listOrdersInRange({ ...filters, ...period });
  const rows = groupRows(orders, (o) => `eq-${o.equipment_id}`, (o) => ({
    title: o.equipment_tag || `Equipamento #${o.equipment_id}`,
    subtitle: [o.client_name, o.site_name, o.area_name].filter(Boolean).join(" / ")
  }));
  return assemble({ key: "equipment-schedule", title: "Cronograma por equipamento",
    groupLabel: "Equipamento", period, rows, filters });
}

// 2) OM por técnico — uma linha por técnico (OM com N técnicos conta para cada um),
//    mais a linha das OMs sem técnico atribuído.
async function technicianOrders(filters) {
  const period = resolvePeriod(filters);
  const scoped = { ...filters, ...period };
  const [assigned, orphans] = await Promise.all([
    repo.listOrdersByTechnician(scoped),
    filters.technicianId ? Promise.resolve([]) : repo.listOrdersWithoutTechnician(scoped)
  ]);
  const rows = groupRows(assigned, (o) => `tec-${o.technician_id}`, (o) => ({
    title: o.technician_name,
    subtitle: [o.technician_role, o.technician_company].filter(Boolean).join(" · ") || "Técnico"
  }));
  if (orphans.length) {
    rows.push(...groupRows(orphans, () => "tec-none", () => ({
      title: "Não atribuídas",
      subtitle: "OMs sem técnico vinculado"
    })));
  }
  return assemble({ key: "technician-orders", title: "Ordens de manutenção por técnico",
    groupLabel: "Técnico", period, rows, filters });
}

// 3) Cronograma por cliente — agrupado por cliente + site.
async function clientSchedule(filters) {
  const period = resolvePeriod(filters);
  const orders = await repo.listOrdersInRange({ ...filters, ...period });
  const rows = groupRows(orders, (o) => `cl-${o.client_id}-${o.site_id}`, (o) => ({
    title: o.client_name,
    subtitle: o.site_name || "Sem site"
  }));
  return assemble({ key: "client-schedule", title: "Cronograma por cliente",
    groupLabel: "Cliente / Site", period, rows, filters });
}

const BUILDERS = {
  "equipment-schedule": equipmentSchedule,
  "technician-orders": technicianOrders,
  "client-schedule": clientSchedule
};

function buildReport(kind, filters) {
  const builder = BUILDERS[kind];
  if (!builder) {
    const err = new Error("Relatório desconhecido.");
    err.code = "SG_REPORT_UNKNOWN";
    throw err;
  }
  return builder(filters);
}

module.exports = {
  buildReport, equipmentSchedule, technicianOrders, clientSchedule,
  STATUS_LABEL, TYPE_LABEL, MONTHS, REPORT_KINDS: Object.keys(BUILDERS)
};
