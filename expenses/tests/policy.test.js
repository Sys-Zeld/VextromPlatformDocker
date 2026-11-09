const test = require("node:test");
const assert = require("node:assert/strict");
const policy = require("../src/policies/expensePolicy");
const { ACTIONS, STATUS } = require("../src/constants");

// Atores e relatório de referência.
const owner = { userId: "u-1", username: "ana", canSubmit: true, canManage: false };
const other = { userId: "u-2", username: "bia", canSubmit: true, canManage: false };
// manager = Aprovador + Financeiro e um dos aprovadores de "u-1" nos relatórios padrão.
const manager = { userId: "m-1", username: "chefe", canSubmit: true, canManage: true, canApprove: true, canPay: true, seesAllReports: true };
const approver = { userId: "a-1", username: "aprov", canSubmit: true, canManage: true, canApprove: true, canPay: false, seesAllReports: false };
const finance = { userId: "f-1", username: "fin", canSubmit: true, canManage: true, canApprove: false, canPay: true, seesAllReports: true };
const admin = { userId: "ad-1", username: "admin", canSubmit: true, canManage: true, canManageUsers: true, seesAllReports: true };
const managerOwner = { ...manager, userId: "u-1" };
// owner_approver_ids = aprovadores atuais do solicitante (vem do getReport).
const report = (status, extra = {}) => ({ id: 1, user_id: "u-1", owner_approver_ids: ["m-1"], status, submitted_at: null, ...extra });

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
    PAY: ["APROVADO"],
    FINANCE_REJECT: ["APROVADO"],
    FINANCE_RETURN: ["APROVADO"]
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
  assert.equal(ACTIONS.FINANCE_REJECT.to, "REJEITADO");
  assert.equal(ACTIONS.FINANCE_RETURN.to, "DEVOLVIDO");
});

test("workflow: usuário comum não executa ações de gestão (escalada de privilégio)", () => {
  for (const action of ["START_REVIEW", "APPROVE", "REJECT", "RETURN"]) {
    const from = ACTIONS[action].from[0];
    assert.equal(code(() => policy.assertTransition(owner, report(from), action, { reason: "x" })), "EX_APPROVER_REQUIRED", action);
  }
  assert.equal(code(() => policy.assertTransition(owner, report("APROVADO"), "PAY")), "EX_FINANCE_REQUIRED");
});

test("papéis: Aprovador não paga; Financeiro não aprova", () => {
  const ofApprover = (status) => report(status, { owner_approver_ids: ["a-1"] });
  assert.equal(code(() => policy.assertTransition(approver, ofApprover("EM_ANALISE"), "APPROVE")), "OK");
  assert.equal(code(() => policy.assertTransition(approver, ofApprover("APROVADO"), "PAY")), "EX_FINANCE_REQUIRED");
  assert.equal(code(() => policy.assertTransition(finance, report("APROVADO"), "PAY")), "OK");
  assert.equal(code(() => policy.assertTransition(finance, report("EM_ANALISE"), "APPROVE")), "EX_APPROVER_REQUIRED");
  assert.equal(code(() => policy.assertTransition(finance, report("ENVIADO"), "START_REVIEW")), "EX_APPROVER_REQUIRED");
  // Financeiro vê todos; o Aprovador, só os de quem ele aprova.
  assert.equal(code(() => policy.assertCanView(finance, report("APROVADO"))), "OK");
  assert.equal(code(() => policy.assertCanView(approver, ofApprover("ENVIADO"))), "OK");
  assert.equal(code(() => policy.assertCanView(approver, report("ENVIADO"))), "EX_REPORT_NOT_FOUND");
});

test("aprovador definido: só ele decide; outro aprovador não", () => {
  const otherApprover = { ...manager, userId: "m-2" }; // vê tudo (Financeiro), mas não é o definido
  for (const action of ["START_REVIEW", "APPROVE", "REJECT", "RETURN"]) {
    const from = ACTIONS[action].from[0];
    assert.equal(code(() => policy.assertTransition(manager, report(from), action, { reason: "x" })), "OK", action);
    assert.equal(code(() => policy.assertTransition(otherApprover, report(from), action, { reason: "x" })), "EX_NOT_DESIGNATED_APPROVER", action);
    // Aprovador "puro" de outra equipe nem enxerga o relatório.
    assert.equal(code(() => policy.assertTransition(approver, report(from), action, { reason: "x" })), "EX_REPORT_NOT_FOUND", action);
  }
});

test("vários aprovadores: qualquer um deles decide e enxerga", () => {
  const team = (status) => report(status, { owner_approver_ids: ["a-1", "m-1"] });
  assert.equal(code(() => policy.assertTransition(approver, team("ENVIADO"), "START_REVIEW")), "OK");
  assert.equal(code(() => policy.assertTransition(manager, team("EM_ANALISE"), "APPROVE")), "OK");
  assert.equal(code(() => policy.assertCanView(approver, team("APROVADO"))), "OK");
  // Fora da lista: não decide (e o aprovador "puro" nem enxerga).
  assert.equal(code(() => policy.assertTransition({ ...manager, userId: "m-9" }, team("EM_ANALISE"), "APPROVE")), "EX_NOT_DESIGNATED_APPROVER");
  assert.equal(code(() => policy.assertCanView({ ...approver, userId: "a-9" }, team("ENVIADO"))), "EX_REPORT_NOT_FOUND");
});

test("aprovador definido: Administrador decide como substituto, inclusive sem aprovador definido", () => {
  assert.equal(code(() => policy.assertTransition(admin, report("EM_ANALISE"), "APPROVE")), "OK");
  assert.equal(code(() => policy.assertTransition(admin, report("ENVIADO", { owner_approver_ids: [] }), "START_REVIEW")), "OK");
  // ...mas não paga sem o papel Financeiro.
  assert.equal(code(() => policy.assertTransition(admin, report("APROVADO"), "PAY")), "EX_FINANCE_REQUIRED");
  // Solicitante sem aprovador: nenhum aprovador decide, só o Administrador.
  assert.equal(code(() => policy.assertTransition(manager, report("EM_ANALISE", { owner_approver_ids: [] }), "APPROVE")), "EX_NOT_DESIGNATED_APPROVER");
});

test("escopo das listas da Gestão: Aprovador filtrado; Financeiro e Administrador veem tudo", () => {
  assert.equal(policy.approverScope(approver), "a-1");
  assert.equal(policy.approverScope(finance), null);
  assert.equal(policy.approverScope(admin), null);
});

test("financeiro: rejeita ou devolve relatório aprovado, com justificativa", () => {
  for (const action of ["FINANCE_REJECT", "FINANCE_RETURN"]) {
    assert.equal(code(() => policy.assertTransition(finance, report("APROVADO"), action, { reason: "x" })), "OK", action);
    assert.equal(code(() => policy.assertTransition(finance, report("APROVADO"), action)), "EX_REASON_REQUIRED", action);
    // Só depois da aprovação: antes disso a decisão é do aprovador.
    assert.equal(code(() => policy.assertTransition(finance, report("EM_ANALISE"), action, { reason: "x" })), "EX_INVALID_TRANSITION", action);
    // Aprovador (sem papel Financeiro) e o próprio solicitante não usam essas ações.
    assert.equal(code(() => policy.assertTransition({ ...approver, seesAllReports: true }, report("APROVADO"), action, { reason: "x" })), "EX_FINANCE_REQUIRED", action);
    assert.equal(code(() => policy.assertTransition(managerOwner, report("APROVADO"), action, { reason: "x" })), "EX_SELF_APPROVAL_FORBIDDEN", action);
  }
  assert.deepEqual(policy.availableActions(finance, report("APROVADO")), ["PAY", "FINANCE_REJECT", "FINANCE_RETURN"]);
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
  // Com a política explícita, o Administrador pode aprovar o próprio (substituto).
  const allowed = { ...admin, userId: "u-1", allowSelfApproval: true };
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
