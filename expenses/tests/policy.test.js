const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../src/policies/expensePolicy");
const { ACTIONS, STATUS } = require("../src/constants");

// Atores e relatório de referência.
const owner = { userId: "u-1", username: "ana", canSubmit: true, canManage: false };
const other = { userId: "u-2", username: "bia", canSubmit: true, canManage: false };
const manager = { userId: "m-1", username: "chefe", canSubmit: true, canManage: true, canApprove: true, canPay: true };
const approver = { userId: "a-1", username: "aprov", canSubmit: true, canManage: true, canApprove: true, canPay: false };
const finance = { userId: "f-1", username: "fin", canSubmit: true, canManage: true, canApprove: false, canPay: true };
const managerOwner = { ...manager, userId: "u-1" };
const report = (status, extra = {}) => ({ id: 1, user_id: "u-1", status, submitted_at: null, ...extra });

const code = (fn) => {
  try { fn(); return "OK"; } catch (e) { return e.errorCode || e.message; }
};

test("visibilidade: dono e gestão veem; terceiro recebe 404", () => {
  assert.equal(code(() => policy.assertCanView(owner, report("RASCUNHO"))), "OK");
  assert.equal(code(() => policy.assertCanView(manager, report("ENVIADO"))), "OK");
  assert.equal(code(() => policy.assertCanView(other, report("ENVIADO"))), "EX_REPORT_NOT_FOUND");
  assert.equal(code(() => policy.assertCanView(owner, null)), "EX_REPORT_NOT_FOUND");
});

test("edição: só dono, só RASCUNHO/DEVOLVIDO; gestão não altera solicitação alheia", () => {
  assert.equal(code(() => policy.assertCanEdit(owner, report("RASCUNHO"))), "OK");
  assert.equal(code(() => policy.assertCanEdit(owner, report("DEVOLVIDO"))), "OK");
  for (const s of ["ENVIADO", "EM_ANALISE", "APROVADO", "REJEITADO", "PAGO"]) {
    assert.equal(code(() => policy.assertCanEdit(owner, report(s))), "EX_REPORT_LOCKED", s);
  }
  assert.equal(code(() => policy.assertCanEdit(manager, report("RASCUNHO"))), "EX_NOT_OWNER");
});

test("exclusão: só rascunho nunca enviado", () => {
  assert.equal(code(() => policy.assertCanDelete(owner, report("RASCUNHO"))), "OK");
  assert.equal(code(() => policy.assertCanDelete(owner, report("DEVOLVIDO", { submitted_at: new Date() }))), "EX_REPORT_NOT_DELETABLE");
});

test("workflow: matriz completa de transições válidas", () => {
  const valid = {
    SUBMIT: ["RASCUNHO"],
    RESUBMIT: ["DEVOLVIDO"],
    START_REVIEW: ["ENVIADO"],
    APPROVE: ["EM_ANALISE"],
    REJECT: ["EM_ANALISE"],
    RETURN: ["EM_ANALISE"],
    PAY: ["APROVADO"]
  };
  for (const [action, def] of Object.entries(ACTIONS)) {
    const actor = def.actor === "owner" ? owner : manager;
    for (const status of Object.keys(STATUS)) {
      const result = code(() => policy.assertTransition(actor, report(status), action, { reason: "motivo" }));
      const expected = valid[action].includes(status) ? "OK" : "EX_INVALID_TRANSITION";
      assert.equal(result, expected, `${action} a partir de ${status}`);
    }
  }
});

test("workflow: destinos corretos", () => {
  assert.equal(ACTIONS.SUBMIT.to, "ENVIADO");
  assert.equal(ACTIONS.RESUBMIT.to, "ENVIADO");
  assert.equal(ACTIONS.START_REVIEW.to, "EM_ANALISE");
  assert.equal(ACTIONS.APPROVE.to, "APROVADO");
  assert.equal(ACTIONS.REJECT.to, "REJEITADO");
  assert.equal(ACTIONS.RETURN.to, "DEVOLVIDO");
  assert.equal(ACTIONS.PAY.to, "PAGO");
});

test("workflow: usuário comum não executa ações de gestão (escalada de privilégio)", () => {
  for (const action of ["START_REVIEW", "APPROVE", "REJECT", "RETURN"]) {
    const from = ACTIONS[action].from[0];
    assert.equal(code(() => policy.assertTransition(owner, report(from), action, { reason: "x" })), "EX_APPROVER_REQUIRED", action);
  }
  assert.equal(code(() => policy.assertTransition(owner, report("APROVADO"), "PAY")), "EX_FINANCE_REQUIRED");
});

test("papéis: Aprovador não paga; Financeiro não aprova", () => {
  assert.equal(code(() => policy.assertTransition(approver, report("EM_ANALISE"), "APPROVE")), "OK");
  assert.equal(code(() => policy.assertTransition(approver, report("APROVADO"), "PAY")), "EX_FINANCE_REQUIRED");
  assert.equal(code(() => policy.assertTransition(finance, report("APROVADO"), "PAY")), "OK");
  assert.equal(code(() => policy.assertTransition(finance, report("EM_ANALISE"), "APPROVE")), "EX_APPROVER_REQUIRED");
  assert.equal(code(() => policy.assertTransition(finance, report("ENVIADO"), "START_REVIEW")), "EX_APPROVER_REQUIRED");
  // Ambos enxergam todos os relatórios (gestão).
  assert.equal(code(() => policy.assertCanView(finance, report("APROVADO"))), "OK");
  assert.equal(code(() => policy.assertCanView(approver, report("ENVIADO"))), "OK");
});

test("papéis: gestão de usuários só para administrador da plataforma", () => {
  assert.equal(code(() => policy.assertUserAdmin(manager)), "EX_USER_ADMIN_REQUIRED");
  assert.equal(code(() => policy.assertUserAdmin({ ...manager, canManageUsers: true })), "OK");
});

test("workflow: gestão não envia relatório de outro usuário", () => {
  assert.equal(code(() => policy.assertTransition(manager, report("RASCUNHO"), "SUBMIT")), "EX_NOT_OWNER");
});

test("workflow: rejeição e devolução exigem justificativa", () => {
  assert.equal(code(() => policy.assertTransition(manager, report("EM_ANALISE"), "REJECT", { reason: " " })), "EX_REASON_REQUIRED");
  assert.equal(code(() => policy.assertTransition(manager, report("EM_ANALISE"), "RETURN")), "EX_REASON_REQUIRED");
  assert.equal(code(() => policy.assertTransition(manager, report("EM_ANALISE"), "APPROVE")), "OK");
});

test("workflow: autoaprovação/autopagamento bloqueados, salvo política explícita", () => {
  assert.equal(code(() => policy.assertTransition(managerOwner, report("EM_ANALISE"), "APPROVE")), "EX_SELF_APPROVAL_FORBIDDEN");
  assert.equal(code(() => policy.assertTransition(managerOwner, report("APROVADO"), "PAY")), "EX_SELF_APPROVAL_FORBIDDEN");
  const allowed = { ...managerOwner, allowSelfApproval: true };
  assert.equal(code(() => policy.assertTransition(allowed, report("EM_ANALISE"), "APPROVE")), "OK");
});

test("workflow: segunda decisão concorrente encontra status alterado (409)", () => {
  // Simula o que a 2ª transação vê após o FOR UPDATE liberar.
  assert.equal(code(() => policy.assertTransition(manager, report("APROVADO"), "REJECT", { reason: "x" })), "EX_INVALID_TRANSITION");
  assert.equal(code(() => policy.assertTransition(manager, report("PAGO"), "PAY")), "EX_INVALID_TRANSITION");
  assert.equal(code(() => policy.assertTransition(owner, report("ENVIADO"), "SUBMIT")), "EX_INVALID_TRANSITION");
});

test("ações disponíveis refletem papel e estado", () => {
  assert.deepEqual(policy.availableActions(owner, report("RASCUNHO")), ["SUBMIT"]);
  assert.deepEqual(policy.availableActions(owner, report("EM_ANALISE")), []);
  assert.deepEqual(policy.availableActions(manager, report("EM_ANALISE")), ["APPROVE", "REJECT", "RETURN"]);
  assert.deepEqual(policy.availableActions(other, report("EM_ANALISE")), []);
});
