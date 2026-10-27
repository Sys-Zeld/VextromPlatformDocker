const pool = require("../db");
const dashboardRepo = require("../repositories/dashboardRepository");
const reportRepo = require("../repositories/reportRepository");
const policy = require("../policies/expensePolicy");
const { STATUS } = require("../constants");
const { decimalToCents, centsToDecimal } = require("../lib/money");

// Indicadores calculados a partir dos registros persistidos.
function summarize(rows) {
  const counts = Object.fromEntries(Object.keys(STATUS).map((s) => [s, 0]));
  let requested = 0n;
  let approvedUnpaid = 0n;
  let reimbursed = 0n;
  let total = 0;
  for (const row of rows) {
    counts[row.status] = row.count;
    total += row.count;
    // Solicitado = tudo que já foi submetido (rascunho ainda não é solicitação).
    if (row.status !== STATUS.RASCUNHO) requested += decimalToCents(row.total_amount);
    if (row.status === STATUS.APROVADO) approvedUnpaid += decimalToCents(row.approved_amount);
    if (row.status === STATUS.PAGO) reimbursed += decimalToCents(row.paid_amount);
  }
  return {
    total,
    counts,
    requestedAmount: centsToDecimal(requested),
    approvedUnpaidAmount: centsToDecimal(approvedUnpaid),
    reimbursedAmount: centsToDecimal(reimbursed)
  };
}

async function userDashboard(actor, period) {
  const filters = { userId: actor.userId, from: period.from, to: period.to };
  const [summary, charts, recent] = await Promise.all([
    dashboardRepo.statusSummary(pool, filters),
    dashboardRepo.chartData(pool, filters),
    reportRepo.listReports(pool, { userId: actor.userId, sort: "created_at", dir: "desc", limit: 5, offset: 0 })
  ]);
  return { ...summarize(summary), charts: { monthly: charts.monthly, byCategory: charts.byCategory }, recent: recent.reports };
}

async function adminDashboard(actor, period) {
  policy.assertManager(actor);
  const filters = { from: period.from, to: period.to };
  // Rascunhos de terceiros não são solicitações: ficam fora da visão da gestão.
  const [summary, charts] = await Promise.all([
    dashboardRepo.statusSummary(pool, filters),
    dashboardRepo.chartData(pool, filters)
  ]);
  const result = summarize(summary.filter((r) => r.status !== STATUS.RASCUNHO));
  return {
    ...result,
    charts: {
      ...charts,
      byStatus: Object.entries(result.counts)
        .filter(([status, count]) => status !== STATUS.RASCUNHO && count > 0)
        .map(([status, count]) => ({ status, count }))
    }
  };
}

module.exports = { userDashboard, adminDashboard, summarize };
