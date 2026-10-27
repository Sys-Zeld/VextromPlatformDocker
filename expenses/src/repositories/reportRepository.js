// Relatórios, lançamentos, comprovantes e histórico de aprovação.
// Todas as funções recebem `db` (pool ou cliente de transação).

const SORT_COLUMNS = {
  created_at: "r.created_at",
  submitted_at: "r.submitted_at",
  total_amount: "r.total_amount",
  report_number: "r.report_number",
  status: "r.status"
};

/* -------------------------------- Relatórios ------------------------------- */

// Próximo número do ano, atômico (linha travada até o fim da transação).
async function nextReportNumber(db, year) {
  const { rows } = await db.query(
    `INSERT INTO ex_report_sequences (year, last_value) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_value = ex_report_sequences.last_value + 1
     RETURNING last_value`,
    [year]
  );
  return `RD-${year}-${String(rows[0].last_value).padStart(6, "0")}`;
}

async function insertReport(db, data) {
  const { rows } = await db.query(
    `INSERT INTO ex_reports (report_number, user_id, requester_username, requester_name, title, description,
                             project_name, cost_center, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [data.reportNumber, data.userId, data.username, data.requesterName, data.title, data.description,
      data.projectName, data.costCenter, data.startDate, data.endDate]
  );
  return rows[0];
}

async function getReport(db, id, { forUpdate = false } = {}) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) return null;
  const { rows } = await db.query(
    `SELECT * FROM ex_reports WHERE id = $1 AND deleted_at IS NULL${forUpdate ? " FOR UPDATE" : ""}`,
    [Number(id)]
  );
  return rows[0] || null;
}

async function updateReportFields(db, id, input) {
  const { rows } = await db.query(
    `UPDATE ex_reports
        SET title = $2, description = $3, project_name = $4, cost_center = $5,
            start_date = $6, end_date = $7, version = version + 1, updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, input.title, input.description, input.projectName, input.costCenter, input.startDate, input.endDate]
  );
  return rows[0];
}

async function softDeleteReport(db, id) {
  await db.query("UPDATE ex_reports SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1", [id]);
}

// Marcador para "carimbar com o relógio do banco" em updateStatus.
const NOW = Symbol("now");

// Atualiza status + colunas de carimbo (submitted_at, approved_by_id...). As
// chaves de `fields` vêm só do código de serviço (nunca do cliente).
async function updateStatus(db, id, status, fields = {}) {
  const sets = ["status = $2", "version = version + 1", "updated_at = NOW()"];
  const params = [id, status];
  for (const [column, value] of Object.entries(fields)) {
    if (!/^[a-z_]+$/.test(column)) throw new Error(`Coluna inválida: ${column}`);
    if (value === NOW) {
      sets.push(`${column} = NOW()`);
    } else {
      params.push(value);
      sets.push(`${column} = $${params.length}`);
    }
  }
  const { rows } = await db.query(`UPDATE ex_reports SET ${sets.join(", ")} WHERE id = $1 RETURNING *`, params);
  return rows[0];
}

// O total é SEMPRE derivado dos lançamentos ativos, no banco.
async function recalcTotal(db, reportId) {
  const { rows } = await db.query(
    `UPDATE ex_reports
        SET total_amount = (SELECT COALESCE(SUM(amount), 0) FROM ex_items WHERE report_id = $1 AND deleted_at IS NULL),
            version = version + 1, updated_at = NOW()
      WHERE id = $1 RETURNING total_amount`,
    [reportId]
  );
  return rows[0] ? rows[0].total_amount : "0.00";
}

function buildListWhere(filters) {
  const params = [];
  const where = ["r.deleted_at IS NULL"];
  const add = (value) => { params.push(value); return `$${params.length}`; };

  if (filters.userId) where.push(`r.user_id = ${add(filters.userId)}`);
  if (filters.statuses && filters.statuses.length) where.push(`r.status = ANY(${add(filters.statuses)})`);
  if (filters.excludeStatuses && filters.excludeStatuses.length) {
    where.push(`NOT (r.status = ANY(${add(filters.excludeStatuses)}))`);
  }
  if (filters.search) {
    const p = add(`%${filters.search.toLowerCase()}%`);
    where.push(`(LOWER(r.report_number) LIKE ${p} OR LOWER(r.title) LIKE ${p}
                 OR LOWER(r.requester_username) LIKE ${p} OR LOWER(r.requester_name) LIKE ${p})`);
  }
  if (filters.project) where.push(`LOWER(r.project_name) LIKE ${add(`%${filters.project.toLowerCase()}%`)}`);
  // Período: relatórios cujo intervalo de despesas cruza [from, to].
  if (filters.from) where.push(`r.end_date >= ${add(filters.from)}`);
  if (filters.to) where.push(`r.start_date <= ${add(filters.to)}`);
  if (filters.categoryId) {
    where.push(`EXISTS (SELECT 1 FROM ex_items fi WHERE fi.report_id = r.id AND fi.deleted_at IS NULL
                        AND fi.category_id = ${add(filters.categoryId)})`);
  }
  return { where: where.join(" AND "), params };
}

async function listReports(db, filters) {
  const { where, params } = buildListWhere(filters);
  const total = await db.query(`SELECT COUNT(*)::int AS c FROM ex_reports r WHERE ${where}`, params);
  const order = `${SORT_COLUMNS[filters.sort] || "r.created_at"} ${filters.dir === "asc" ? "ASC" : "DESC"} NULLS LAST, r.id DESC`;
  const { rows } = await db.query(
    `SELECT r.id, r.report_number, r.user_id, r.requester_username, r.requester_name, r.title,
            r.project_name, r.cost_center, r.start_date, r.end_date, r.total_amount, r.approved_amount,
            r.paid_amount, r.status, r.submitted_at, r.approved_at, r.paid_at, r.created_at, r.updated_at,
            (SELECT COUNT(*)::int FROM ex_items i WHERE i.report_id = r.id AND i.deleted_at IS NULL) AS items_count
       FROM ex_reports r
      WHERE ${where}
      ORDER BY ${order}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, filters.offset]
  );
  return { reports: rows, total: total.rows[0].c };
}

/* -------------------------------- Lançamentos ------------------------------ */

async function listItems(db, reportId) {
  const { rows } = await db.query(
    `SELECT i.*, c.name AS category_name
       FROM ex_items i JOIN ex_categories c ON c.id = i.category_id
      WHERE i.report_id = $1 AND i.deleted_at IS NULL
      ORDER BY i.expense_date, i.id`,
    [reportId]
  );
  return rows;
}

async function getItem(db, itemId) {
  if (!Number.isSafeInteger(Number(itemId)) || Number(itemId) <= 0) return null;
  const { rows } = await db.query("SELECT * FROM ex_items WHERE id = $1 AND deleted_at IS NULL", [Number(itemId)]);
  return rows[0] || null;
}

async function insertItem(db, reportId, input, createdBy) {
  const { rows } = await db.query(
    `INSERT INTO ex_items (report_id, category_id, expense_date, description, justification, amount, merchant, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [reportId, input.categoryId, input.expenseDate, input.description, input.justification,
      input.amount, input.merchant, input.notes, createdBy]
  );
  return rows[0];
}

async function updateItem(db, itemId, input) {
  const { rows } = await db.query(
    `UPDATE ex_items
        SET category_id = $2, expense_date = $3, description = $4, justification = $5,
            amount = $6, merchant = $7, notes = $8, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
    [itemId, input.categoryId, input.expenseDate, input.description, input.justification,
      input.amount, input.merchant, input.notes]
  );
  return rows[0] || null;
}

async function softDeleteItem(db, itemId) {
  await db.query("UPDATE ex_items SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1", [itemId]);
  await db.query("UPDATE ex_attachments SET deleted_at = NOW() WHERE item_id = $1 AND deleted_at IS NULL", [itemId]);
}

// Na aprovação integral, cada lançamento é aprovado pelo próprio valor.
async function approveAllItems(db, reportId) {
  await db.query(
    "UPDATE ex_items SET approved_amount = amount, updated_at = NOW() WHERE report_id = $1 AND deleted_at IS NULL",
    [reportId]
  );
}

/* -------------------------------- Comprovantes ----------------------------- */

const ATTACHMENT_COLUMNS = `a.id, a.item_id, a.report_id, a.original_name, a.mime_type, a.file_size,
                            a.file_hash, a.uploaded_by, a.created_at`;

async function listAttachments(db, reportId) {
  const { rows } = await db.query(
    `SELECT ${ATTACHMENT_COLUMNS} FROM ex_attachments a
      WHERE a.report_id = $1 AND a.deleted_at IS NULL ORDER BY a.id`,
    [reportId]
  );
  return rows;
}

// Caminhos internos dos comprovantes ativos (exportação ZIP). Uso interno.
async function listAttachmentPaths(db, reportId) {
  const { rows } = await db.query(
    "SELECT id, storage_path FROM ex_attachments WHERE report_id = $1 AND deleted_at IS NULL",
    [reportId]
  );
  return new Map(rows.map((r) => [String(r.id), r.storage_path]));
}

// Inclui storage_path: uso interno (download), nunca serializado para o cliente.
async function getAttachment(db, attachmentId) {
  if (!Number.isSafeInteger(Number(attachmentId)) || Number(attachmentId) <= 0) return null;
  const { rows } = await db.query("SELECT * FROM ex_attachments WHERE id = $1 AND deleted_at IS NULL", [Number(attachmentId)]);
  return rows[0] || null;
}

async function insertAttachment(db, data) {
  const { rows } = await db.query(
    `INSERT INTO ex_attachments (item_id, report_id, original_name, stored_name, mime_type, file_size,
                                 storage_path, file_hash, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, item_id, report_id, original_name, mime_type, file_size, file_hash, uploaded_by, created_at`,
    [data.itemId, data.reportId, data.originalName, data.storedName, data.mimeType, data.fileSize,
      data.storagePath, data.fileHash, data.uploadedBy]
  );
  return rows[0];
}

async function softDeleteAttachment(db, attachmentId) {
  await db.query("UPDATE ex_attachments SET deleted_at = NOW() WHERE id = $1", [attachmentId]);
}

// Outros comprovantes ativos com o mesmo hash (possível duplicidade).
async function findByHash(db, hashes, excludeReportItemIds = []) {
  if (!hashes.length) return [];
  const { rows } = await db.query(
    `SELECT a.id, a.item_id, a.report_id, a.file_hash, r.report_number, r.user_id, r.status
       FROM ex_attachments a JOIN ex_reports r ON r.id = a.report_id
      WHERE a.deleted_at IS NULL AND r.deleted_at IS NULL AND a.file_hash = ANY($1)
        AND NOT (a.id = ANY($2))`,
    [hashes, excludeReportItemIds]
  );
  return rows;
}

// Lançamentos sem comprovante (bloqueia o envio).
async function itemsWithoutAttachment(db, reportId) {
  const { rows } = await db.query(
    `SELECT i.id, i.description FROM ex_items i
      WHERE i.report_id = $1 AND i.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM ex_attachments a WHERE a.item_id = i.id AND a.deleted_at IS NULL)
      ORDER BY i.expense_date, i.id`,
    [reportId]
  );
  return rows;
}

/* --------------------------------- Histórico ------------------------------- */

async function insertHistory(db, data) {
  await db.query(
    `INSERT INTO ex_approval_history (report_id, previous_status, new_status, action, performed_by, performed_by_name, reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [data.reportId, data.previousStatus, data.newStatus, data.action, data.performedBy, data.performedByName, data.reason || ""]
  );
}

async function listHistory(db, reportId) {
  const { rows } = await db.query(
    "SELECT * FROM ex_approval_history WHERE report_id = $1 ORDER BY created_at, id",
    [reportId]
  );
  return rows;
}

// Histórico consolidado de decisões (tela "Histórico de Aprovações").
async function listDecisions(db, { limit, offset, userId }) {
  const params = [];
  let where = "1=1";
  if (userId) { params.push(userId); where = `r.user_id = $${params.length}`; }
  const total = await db.query(
    `SELECT COUNT(*)::int AS c FROM ex_approval_history h JOIN ex_reports r ON r.id = h.report_id WHERE ${where}`,
    params
  );
  const { rows } = await db.query(
    `SELECT h.*, r.report_number, r.title, r.requester_username, r.requester_name
       FROM ex_approval_history h JOIN ex_reports r ON r.id = h.report_id
      WHERE ${where}
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );
  return { history: rows, total: total.rows[0].c };
}

module.exports = {
  NOW,
  nextReportNumber,
  insertReport,
  getReport,
  updateReportFields,
  softDeleteReport,
  updateStatus,
  recalcTotal,
  listReports,
  listItems,
  getItem,
  insertItem,
  updateItem,
  softDeleteItem,
  approveAllItems,
  listAttachments,
  listAttachmentPaths,
  getAttachment,
  insertAttachment,
  softDeleteAttachment,
  findByHash,
  itemsWithoutAttachment,
  insertHistory,
  listHistory,
  listDecisions
};
