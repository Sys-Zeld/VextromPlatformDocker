const crypto = require("crypto");
const path = require("path");
const pool = require("../db");
const { withTransaction } = require("../db");
const repo = require("../repositories/reportRepository");
const categoryRepo = require("../repositories/categoryRepository");
const paymentRepo = require("../repositories/paymentRepository");
const profileService = require("./profileService");
const audit = require("./auditService");
const policy = require("../policies/expensePolicy");
const { STATUS } = require("../constants");
const { sha256 } = require("../lib/crypto");
const { validateUpload, sanitizeFileName } = require("../lib/fileSignature");
const { notFound, badRequest, DomainError } = require("../lib/errors");

// Relatórios, lançamentos e comprovantes. Toda alteração: transação + trava
// do relatório (FOR UPDATE) + política + auditoria; o total é recalculado no
// banco na mesma transação.

function createReportService({ storage, maxFileBytes }) {
  /* ------------------------------ Relatórios ------------------------------ */

  async function createReport(actor, input) {
    return withTransaction(async (db) => {
      const profile = await profileService.loadProfile(db, actor.userId);
      const reportNumber = await repo.nextReportNumber(db, new Date().getFullYear());
      const report = await repo.insertReport(db, {
        ...input,
        reportNumber,
        userId: actor.userId,
        username: actor.username,
        requesterName: (profile && profile.fullName) || ""
      });
      await audit.record(db, actor, {
        reportId: report.id,
        action: "REPORT_CREATED",
        entityType: "report",
        entityId: report.id,
        newStatus: report.status,
        metadata: { reportNumber }
      });
      return report;
    });
  }

  async function listReports(actor, query, { scope }) {
    if (scope === "all") policy.assertManager(actor);
    const statuses = query.status ? query.status.split(",").map((s) => s.trim()).filter((s) => STATUS[s]) : [];
    return repo.listReports(pool, {
      userId: scope === "all" ? null : actor.userId,
      statuses,
      // Rascunhos alheios não interessam à gestão (não foram submetidos).
      excludeStatuses: scope === "all" && !statuses.length ? [STATUS.RASCUNHO] : [],
      search: query.search,
      project: query.project,
      categoryId: query.categoryId,
      from: query.from,
      to: query.to,
      sort: query.sort,
      dir: query.dir,
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize
    });
  }

  // Alerta de comprovante repetido. Para o solicitante, não revela relatórios
  // de terceiros; para a gestão, mostra o número.
  function duplicateWarnings(actor, attachments, matches) {
    const byHash = new Map();
    for (const m of matches) {
      if (!byHash.has(m.file_hash)) byHash.set(m.file_hash, []);
      byHash.get(m.file_hash).push(m);
    }
    const result = {};
    for (const a of attachments) {
      const others = (byHash.get(a.file_hash) || []).filter((m) => m.id !== a.id);
      if (!others.length) continue;
      result[a.id] = others.map((m) => (actor.canManage || m.user_id === actor.userId
        ? { reportId: m.report_id, reportNumber: m.report_number, sameReport: m.report_id === a.report_id }
        : { reportId: null, reportNumber: "outro relatório", sameReport: false }));
    }
    return result;
  }

  async function getReportDetail(actor, reportId) {
    const report = await repo.getReport(pool, reportId);
    policy.assertCanView(actor, report);

    const [items, attachments, history, payments] = await Promise.all([
      repo.listItems(pool, report.id),
      repo.listAttachments(pool, report.id),
      repo.listHistory(pool, report.id),
      paymentRepo.listByReport(pool, report.id)
    ]);
    const matches = await repo.findByHash(pool, [...new Set(attachments.map((a) => a.file_hash))], attachments.map((a) => a.id));
    const isOwner = policy.isOwner(actor, report);
    const requester = isOwner || actor.canManage ? await profileService.getMaskedProfile(pool, report.user_id) : null;

    return {
      report,
      items,
      attachments,
      duplicates: duplicateWarnings(actor, attachments, matches),
      history,
      payments,
      requester,
      permissions: {
        isOwner,
        canEdit: isOwner && policy.isEditable(report),
        canDelete: isOwner && report.status === STATUS.RASCUNHO && !report.submitted_at,
        actions: policy.availableActions(actor, report)
      }
    };
  }

  async function updateReport(actor, reportId, input) {
    return withTransaction(async (db) => {
      const report = await repo.getReport(db, reportId, { forUpdate: true });
      policy.assertCanEdit(actor, report);
      const updated = await repo.updateReportFields(db, report.id, input);
      await audit.record(db, actor, {
        reportId: report.id,
        action: "REPORT_UPDATED",
        entityType: "report",
        entityId: report.id
      });
      return updated;
    });
  }

  async function deleteReport(actor, reportId) {
    return withTransaction(async (db) => {
      const report = await repo.getReport(db, reportId, { forUpdate: true });
      policy.assertCanDelete(actor, report);
      await repo.softDeleteReport(db, report.id);
      await audit.record(db, actor, {
        reportId: report.id,
        action: "REPORT_DELETED",
        entityType: "report",
        entityId: report.id,
        previousStatus: report.status,
        metadata: { reportNumber: report.report_number }
      });
    });
  }

  /* ------------------------------ Lançamentos ----------------------------- */

  async function assertCategoryUsable(db, categoryId, currentCategoryId = null) {
    const category = await categoryRepo.get(db, categoryId);
    // Categoria desativada continua válida para o lançamento que já a usava.
    if (!category || (!category.active && category.id !== currentCategoryId)) {
      throw badRequest("EX_INVALID_CATEGORY", "Categoria inválida ou inativa.");
    }
  }

  async function addItem(actor, reportId, input) {
    return withTransaction(async (db) => {
      const report = await repo.getReport(db, reportId, { forUpdate: true });
      policy.assertCanEdit(actor, report);
      await assertCategoryUsable(db, input.categoryId);
      const item = await repo.insertItem(db, report.id, input, actor.userId);
      const total = await repo.recalcTotal(db, report.id);
      await audit.record(db, actor, {
        reportId: report.id,
        action: "ITEM_CREATED",
        entityType: "item",
        entityId: item.id,
        metadata: { amount: item.amount, total }
      });
      return { item, totalAmount: total };
    });
  }

  // Carrega lançamento + relatório (travado) validando pertinência e edição.
  async function lockItemForEdit(db, actor, reportId, itemId) {
    const report = await repo.getReport(db, reportId, { forUpdate: true });
    policy.assertCanEdit(actor, report);
    const item = await repo.getItem(db, itemId);
    if (!item || String(item.report_id) !== String(report.id)) throw notFound("Lançamento não encontrado", "EX_ITEM_NOT_FOUND");
    return { report, item };
  }

  async function updateItem(actor, reportId, itemId, input) {
    return withTransaction(async (db) => {
      const { report, item } = await lockItemForEdit(db, actor, reportId, itemId);
      await assertCategoryUsable(db, input.categoryId, item.category_id);
      const updated = await repo.updateItem(db, item.id, input);
      const total = await repo.recalcTotal(db, report.id);
      await audit.record(db, actor, {
        reportId: report.id,
        action: "ITEM_UPDATED",
        entityType: "item",
        entityId: item.id,
        metadata: { previousAmount: item.amount, amount: updated.amount, total }
      });
      return { item: updated, totalAmount: total };
    });
  }

  async function deleteItem(actor, reportId, itemId) {
    return withTransaction(async (db) => {
      const { report, item } = await lockItemForEdit(db, actor, reportId, itemId);
      await repo.softDeleteItem(db, item.id);
      const total = await repo.recalcTotal(db, report.id);
      await audit.record(db, actor, {
        reportId: report.id,
        action: "ITEM_DELETED",
        entityType: "item",
        entityId: item.id,
        metadata: { amount: item.amount, total }
      });
      return { totalAmount: total };
    });
  }

  /* ------------------------------ Comprovantes ---------------------------- */

  async function uploadAttachment(actor, reportId, itemId, buffer, rawName) {
    const originalName = sanitizeFileName(rawName);
    const check = validateUpload(buffer, originalName, maxFileBytes);
    if (check.error) throw new DomainError(check.status || 400, "EX_INVALID_FILE", check.error);
    const fileHash = sha256(buffer);

    const attachment = await withTransaction(async (db) => {
      const { report, item } = await lockItemForEdit(db, actor, reportId, itemId);
      // Nome interno gerado; o nome original é só metadado de exibição.
      const storedName = `${crypto.randomUUID()}.${check.ext}`;
      const storagePath = path.posix.join("dados", "expenses", String(report.id), String(item.id), storedName);
      try {
        await storage.putObject(storagePath, buffer, { contentType: check.mime });
      } catch (err) {
        throw new DomainError(502, "EX_STORAGE_FAILURE", "Falha ao armazenar o arquivo. Tente novamente.");
      }
      try {
        const created = await repo.insertAttachment(db, {
          itemId: item.id,
          reportId: report.id,
          originalName,
          storedName,
          mimeType: check.mime,
          fileSize: buffer.length,
          storagePath,
          fileHash,
          uploadedBy: actor.userId
        });
        await audit.record(db, actor, {
          reportId: report.id,
          action: "ATTACHMENT_UPLOADED",
          entityType: "attachment",
          entityId: created.id,
          metadata: { itemId: item.id, mimeType: check.mime, fileSize: buffer.length, fileHash }
        });
        return created;
      } catch (err) {
        // Compensação: não deixa arquivo órfão no storage.
        await storage.deleteObject(storagePath).catch(() => {});
        throw err;
      }
    });

    const matches = await repo.findByHash(pool, [fileHash], [attachment.id]);
    const warnings = duplicateWarnings(actor, [attachment], matches)[attachment.id] || [];
    return { attachment, duplicateWarnings: warnings };
  }

  async function deleteAttachment(actor, reportId, attachmentId) {
    return withTransaction(async (db) => {
      const report = await repo.getReport(db, reportId, { forUpdate: true });
      policy.assertCanEdit(actor, report);
      const attachment = await repo.getAttachment(db, attachmentId);
      if (!attachment || String(attachment.report_id) !== String(report.id)) {
        throw notFound("Comprovante não encontrado", "EX_ATTACHMENT_NOT_FOUND");
      }
      // Exclusão lógica: o arquivo permanece no storage para rastreabilidade.
      await repo.softDeleteAttachment(db, attachment.id);
      await audit.record(db, actor, {
        reportId: report.id,
        action: "ATTACHMENT_DELETED",
        entityType: "attachment",
        entityId: attachment.id,
        metadata: { itemId: attachment.item_id, fileHash: attachment.file_hash }
      });
    });
  }

  // Valida acesso e devolve metadados + caminho interno para o stream.
  async function getAttachmentForDownload(actor, attachmentId) {
    const attachment = await repo.getAttachment(pool, attachmentId);
    if (!attachment) throw notFound("Comprovante não encontrado", "EX_ATTACHMENT_NOT_FOUND");
    const report = await repo.getReport(pool, attachment.report_id);
    policy.assertCanView(actor, report);
    return attachment;
  }

  return {
    createReport,
    listReports,
    getReportDetail,
    updateReport,
    deleteReport,
    addItem,
    updateItem,
    deleteItem,
    uploadAttachment,
    deleteAttachment,
    getAttachmentForDownload
  };
}

module.exports = { createReportService };
