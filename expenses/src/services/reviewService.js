const pool = require("../db");
const { withTransaction } = require("../db");
const repo = require("../repositories/reportRepository");
const profileService = require("./profileService");
const audit = require("./auditService");
const policy = require("../policies/expensePolicy");
const { NOTIFICATION_EVENTS: EV } = require("../constants");
const { unprocessable } = require("../lib/errors");
const { decimalToCents } = require("../lib/money");

// Transições do workflow (envio, análise, decisão). Cada uma roda numa
// transação com o relatório travado (FOR UPDATE): duas ações simultâneas são
// serializadas e a segunda encontra o status já alterado → 409.

const EVENT_BY_ACTION = {
  SUBMIT: EV.SUBMITTED,
  RESUBMIT: EV.RESUBMITTED,
  START_REVIEW: EV.REVIEW_STARTED,
  APPROVE: EV.APPROVED,
  REJECT: EV.REJECTED,
  RETURN: EV.RETURNED
};

// Regras de envio. Devolve a lista de problemas (vazia = pode enviar).
async function submissionIssues(db, report) {
  const issues = [];
  const items = await repo.listItems(db, report.id);
  if (!items.length) issues.push("Inclua pelo menos uma despesa.");
  for (const item of items) {
    if (decimalToCents(item.amount) <= 0n) issues.push(`Valor inválido: ${item.description}`);
    if (!String(item.justification || "").trim()) issues.push(`Justificativa ausente: ${item.description}`);
  }
  const withoutProof = await repo.itemsWithoutAttachment(db, report.id);
  for (const item of withoutProof) issues.push(`Comprovante ausente: ${item.description}`);
  const profile = await profileService.loadProfile(db, report.user_id);
  const readiness = profileService.reimbursementReadiness(profile);
  for (const missing of readiness.missing) issues.push(`Cadastro de reembolso: ${missing}`);
  return { issues, profile };
}

function createReviewService({ notifications }) {
  async function transition(actor, reportId, actionKey, { reason = "" } = {}) {
    const cleanReason = String(reason || "").trim();
    let emails = [];

    const updated = await withTransaction(async (db) => {
      const report = await repo.getReport(db, reportId, { forUpdate: true });
      const action = policy.assertTransition(actor, report, actionKey, { reason: cleanReason });
      const fields = {};

      if (actionKey === "SUBMIT" || actionKey === "RESUBMIT") {
        const { issues, profile } = await submissionIssues(db, report);
        if (issues.length) {
          throw unprocessable("EX_SUBMIT_BLOCKED", "O relatório não pode ser enviado.", { issues });
        }
        fields.submitted_at = repo.NOW;
        fields.requester_name = profile.fullName;
      } else if (actionKey === "START_REVIEW") {
        fields.review_started_at = repo.NOW;
        fields.reviewer_id = actor.userId;
        fields.reviewer_name = actor.username;
      } else if (actionKey === "APPROVE") {
        // v1: aprovação integral — aprovado = solicitado.
        await repo.approveAllItems(db, report.id);
        fields.approved_amount = report.total_amount;
        fields.approved_at = repo.NOW;
        fields.approved_by_id = actor.userId;
        fields.approved_by_name = actor.username;
        fields.last_decision_reason = cleanReason;
      } else if (actionKey === "REJECT") {
        fields.rejected_at = repo.NOW;
        fields.last_decision_reason = cleanReason;
      } else if (actionKey === "RETURN") {
        fields.returned_at = repo.NOW;
        fields.last_decision_reason = cleanReason;
      }

      const next = await repo.updateStatus(db, report.id, action.to, fields);
      await repo.insertHistory(db, {
        reportId: report.id,
        previousStatus: report.status,
        newStatus: action.to,
        action: actionKey,
        performedBy: actor.userId,
        performedByName: actor.username,
        reason: cleanReason
      });
      await audit.record(db, actor, {
        reportId: report.id,
        action: `REPORT_${actionKey}`,
        entityType: "report",
        entityId: report.id,
        previousStatus: report.status,
        newStatus: action.to,
        reason: cleanReason,
        metadata: { totalAmount: next.total_amount }
      });
      emails = await notifications.notify(db, EVENT_BY_ACTION[actionKey], next, actor, cleanReason);
      return next;
    });

    notifications.dispatch(emails);
    return updated;
  }

  // Pré-checagem para a UI (mesma regra do envio, sem alterar nada).
  async function checkSubmission(actor, reportId) {
    const report = await repo.getReport(pool, reportId);
    policy.assertCanView(actor, report);
    const { issues } = await submissionIssues(pool, report);
    return { canSubmit: issues.length === 0, issues };
  }

  return { transition, checkSubmission };
}

module.exports = { createReviewService, submissionIssues };
