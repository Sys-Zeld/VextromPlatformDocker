// Agregações dos dashboards — sempre sobre dados persistidos, escopo por userId
// quando informado. Poucas consultas agregadas (sem N+1).

// Despesas "em circulação" para os gráficos: exclui rascunho e rejeitado.
const CHART_STATUSES = ["ENVIADO", "EM_ANALISE", "DEVOLVIDO", "APROVADO", "PAGO"];

function scope({ userId, from, to }, alias = "r", dateColumn = "created_at") {
  const params = [];
  const where = [`${alias}.deleted_at IS NULL`];
  if (userId) { params.push(userId); where.push(`${alias}.user_id = $${params.length}`); }
  if (from) { params.push(from); where.push(`${alias}.${dateColumn}::date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`${alias}.${dateColumn}::date <= $${params.length}`); }
  return { params, where };
}

// Quantidade e somas por status. Período aplicado sobre a data de criação.
async function statusSummary(db, filters) {
  const { params, where } = scope(filters);
  const { rows } = await db.query(
    `SELECT r.status, COUNT(*)::int AS count,
            COALESCE(SUM(r.total_amount), 0)::numeric(14,2) AS total_amount,
            COALESCE(SUM(r.approved_amount), 0)::numeric(14,2) AS approved_amount,
            COALESCE(SUM(r.paid_amount), 0)::numeric(14,2) AS paid_amount
       FROM ex_reports r WHERE ${where.join(" AND ")}
      GROUP BY r.status`,
    params
  );
  return rows;
}

// Período dos gráficos aplicado sobre a data da despesa.
async function chartData(db, filters) {
  const { params, where } = scope({ userId: filters.userId }, "r");
  params.push(CHART_STATUSES);
  where.push(`r.status = ANY($${params.length})`);
  where.push("i.deleted_at IS NULL");
  if (filters.from) { params.push(filters.from); where.push(`i.expense_date >= $${params.length}`); }
  if (filters.to) { params.push(filters.to); where.push(`i.expense_date <= $${params.length}`); }
  const base = `FROM ex_items i JOIN ex_reports r ON r.id = i.report_id WHERE ${where.join(" AND ")}`;

  const [monthly, byCategory, byUser, byProject] = await Promise.all([
    db.query(
      `SELECT to_char(i.expense_date, 'YYYY-MM') AS month, SUM(i.amount)::numeric(14,2) AS amount
         ${base} GROUP BY 1 ORDER BY 1`,
      params
    ),
    db.query(
      `SELECT c.name AS label, SUM(i.amount)::numeric(14,2) AS amount
         FROM ex_items i JOIN ex_reports r ON r.id = i.report_id JOIN ex_categories c ON c.id = i.category_id
        WHERE ${where.join(" AND ")} GROUP BY c.name ORDER BY 2 DESC`,
      params
    ),
    filters.userId
      ? Promise.resolve({ rows: [] })
      : db.query(
        `SELECT COALESCE(NULLIF(r.requester_name, ''), r.requester_username) AS label, SUM(i.amount)::numeric(14,2) AS amount
           ${base} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
        params
      ),
    db.query(
      `SELECT COALESCE(NULLIF(r.project_name, ''), '(sem projeto)') AS label, SUM(i.amount)::numeric(14,2) AS amount
         ${base} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
      params
    )
  ]);

  return {
    monthly: monthly.rows,
    byCategory: byCategory.rows,
    byUser: byUser.rows,
    byProject: byProject.rows
  };
}

module.exports = { statusSummary, chartData, CHART_STATUSES };
