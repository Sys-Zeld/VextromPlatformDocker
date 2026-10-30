const { ACTIONS, EDITABLE_STATUSES, STATUS } = require("../constants");
const { forbidden, notFound, conflict, badRequest } = require("../lib/errors");

// Autorização e transições centralizadas. Toda rota/serviço passa por aqui —
// a UI só esconde botões; quem decide é este módulo.
//
// actor = { userId, username, canSubmit, canApprove, canPay, canManage,
//           canManageUsers, allowSelfApproval }
//   canManage = vê todos os relatórios (Aprovador ou Financeiro).

function isOwner(actor, report) {
  return Boolean(actor && report && actor.userId && report.user_id === actor.userId);
}

function canView(actor, report) {
  return isOwner(actor, report) || Boolean(actor && actor.canManage);
}

// Para quem não pode ver, responde 404 (não revela que o relatório existe).
function assertCanView(actor, report) {
  if (!report || !canView(actor, report)) throw notFound("Relatório não encontrado", "EX_REPORT_NOT_FOUND");
}

// Visão de gestão (todos os relatórios, dashboards, auditoria).
function assertManager(actor) {
  if (!actor || !actor.canManage) throw forbidden("Operação restrita à gestão de despesas.", "EX_MANAGER_REQUIRED");
}

function assertApprover(actor) {
  if (!actor || !actor.canApprove) throw forbidden("Operação restrita a aprovadores.", "EX_APPROVER_REQUIRED");
}

function assertFinance(actor) {
  if (!actor || !actor.canPay) throw forbidden("Operação restrita ao financeiro.", "EX_FINANCE_REQUIRED");
}

function assertUserAdmin(actor) {
  if (!actor || !actor.canManageUsers) {
    throw forbidden("Gestão de usuários restrita ao administrador da plataforma.", "EX_USER_ADMIN_REQUIRED");
  }
}

function isEditable(report) {
  return Boolean(report) && EDITABLE_STATUSES.includes(report.status);
}

// Alterar dados, lançamentos e comprovantes: só o dono, só em estado editável.
// Nem a gestão altera a solicitação de outro usuário.
function assertCanEdit(actor, report) {
  assertCanView(actor, report);
  if (!isOwner(actor, report)) {
    throw forbidden("Somente o solicitante pode alterar o relatório.", "EX_NOT_OWNER");
  }
  if (!isEditable(report)) {
    throw conflict("EX_REPORT_LOCKED", `Relatório bloqueado para edição (status ${report.status}).`);
  }
}

// Exclusão: rascunho nunca enviado (preserva histórico de quem já tramitou).
function assertCanDelete(actor, report) {
  assertCanEdit(actor, report);
  if (report.status !== STATUS.RASCUNHO || report.submitted_at) {
    throw conflict("EX_REPORT_NOT_DELETABLE", "Somente rascunhos que nunca foram enviados podem ser excluídos.");
  }
}

// Valida uma ação do workflow. Retorna a definição da ação (com `to`).
function assertTransition(actor, report, actionKey, { reason = "" } = {}) {
  const action = ACTIONS[actionKey];
  if (!action) throw badRequest("EX_INVALID_ACTION", "Ação inválida.");
  assertCanView(actor, report);

  if (action.actor === "owner" && !isOwner(actor, report)) {
    throw forbidden("Somente o solicitante pode executar esta ação.", "EX_NOT_OWNER");
  }
  if (action.actor === "approver") assertApprover(actor);
  if (action.actor === "finance") assertFinance(actor);
  if (action.selfRestricted && isOwner(actor, report) && !actor.allowSelfApproval) {
    throw forbidden("Não é permitido decidir sobre o próprio relatório.", "EX_SELF_APPROVAL_FORBIDDEN");
  }
  if (!action.from.includes(report.status)) {
    throw conflict(
      "EX_INVALID_TRANSITION",
      `Ação não permitida: o relatório está ${report.status}.`,
      { currentStatus: report.status, action: actionKey }
    );
  }
  if (action.requiresReason && !String(reason || "").trim()) {
    throw badRequest("EX_REASON_REQUIRED", "Informe a justificativa.");
  }
  return action;
}

// Ações disponíveis para o ator no estado atual (a UI usa para mostrar botões).
function availableActions(actor, report) {
  return Object.keys(ACTIONS).filter((key) => {
    try {
      assertTransition(actor, report, key, { reason: "x" });
      return true;
    } catch (_err) {
      return false;
    }
  });
}

module.exports = {
  isOwner,
  canView,
  isEditable,
  assertCanView,
  assertManager,
  assertApprover,
  assertFinance,
  assertUserAdmin,
  assertCanEdit,
  assertCanDelete,
  assertTransition,
  availableActions
};
