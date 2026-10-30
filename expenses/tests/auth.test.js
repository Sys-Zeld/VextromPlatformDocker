const test = require("node:test");
const assert = require("node:assert/strict");
const { hashPassword, verifyPassword, generateTemporaryPassword } = require("../src/lib/password");
const { createSessionCodec } = require("../src/lib/session");
const { actorFromUser } = require("../src/services/authService");
const passwordPolicy = require("../../specflow/services/passwordPolicy");
const v = require("../src/validators/expenseValidators");

/* ---------------------------------- Senha ---------------------------------- */

test("senha: hash com salt aleatório e verificação correta", async () => {
  const a = await hashPassword("Correta#Senha9");
  const b = await hashPassword("Correta#Senha9");
  assert.notEqual(a, b, "salt deve variar");
  assert.match(a, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("Correta#Senha9", a), true);
  assert.equal(await verifyPassword("errada", a), false);
});

test("senha: sem hash cadastrado (convite pendente/inexistente) nunca autentica", async () => {
  assert.equal(await verifyPassword("qualquer", ""), false);
  assert.equal(await verifyPassword("qualquer", null), false);
  assert.equal(await verifyPassword("", "lixo"), false);
});

test("senha provisória atende à política da plataforma", () => {
  for (let i = 0; i < 20; i += 1) {
    const p = generateTemporaryPassword();
    assert.equal(p.length, 16);
    assert.deepEqual(passwordPolicy.validatePassword(p, { username: "fulano", email: "f@x.com" }), [], p);
  }
});

/* --------------------------------- Sessão ---------------------------------- */

test("sessão: emite e valida; rejeita adulteração, outra chave e expiração", () => {
  const codec = createSessionCodec("segredo-1");
  const token = codec.issue({ userId: "ex:abc", sessionVersion: 3, ttlMs: 60_000 });
  const data = codec.verify(token);
  assert.equal(data.uid, "ex:abc");
  assert.equal(data.sv, 3);

  const [payload, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ uid: "ex:admin", sv: 3, iat: 0, exp: Date.now() + 1e6 })).toString("base64url");
  assert.equal(codec.verify(`${forged}.${sig}`), null, "payload trocado");
  assert.equal(codec.verify(`${payload}.x${sig.slice(1)}`), null, "assinatura alterada");
  assert.equal(createSessionCodec("segredo-2").verify(token), null, "outra chave");
  assert.equal(codec.verify(codec.issue({ userId: "ex:abc", sessionVersion: 1, ttlMs: -1 })), null, "expirado");
  assert.equal(codec.verify(""), null);
  assert.equal(codec.verify("semponto"), null);
});

/* --------------------------------- Papéis ---------------------------------- */

const user = (extra = {}) => ({
  id: "ex:1", username: "ana", full_name: "Ana", email: "", is_admin: false, is_approver: false, is_finance: false,
  must_change_password: false, ...extra
});

test("papéis: colaborador, aprovador, financeiro e administrador do módulo", () => {
  const c = actorFromUser(user());
  assert.deepEqual([c.canSubmit, c.canApprove, c.canPay, c.canManage, c.canManageUsers], [true, false, false, false, false]);
  const a = actorFromUser(user({ is_approver: true }));
  assert.deepEqual([a.canApprove, a.canPay, a.canManage], [true, false, true]);
  const f = actorFromUser(user({ is_finance: true }));
  assert.deepEqual([f.canApprove, f.canPay, f.canManage], [false, true, true]);
  // Administrador gerencia usuários e enxerga a gestão, mas aprovar/pagar exigem o papel.
  const adm = actorFromUser(user({ is_admin: true }));
  assert.deepEqual([adm.canManageUsers, adm.canManage, adm.canApprove, adm.canPay], [true, true, false, false]);
  assert.equal(actorFromUser(user({ must_change_password: true })).mustChangePassword, true);
});

/* ------------------------------- Validadores ------------------------------- */

test("validação: login, criação e edição de conta", () => {
  assert.equal(v.parseLogin({ identifier: " ana ", password: "x" }).identifier, "ana");
  assert.throws(() => v.parseLogin({ identifier: "", password: "x" }));
  assert.throws(() => v.parseUserCreate({ username: "a b" }), "espaço no usuário");
  assert.throws(() => v.parseUserCreate({ username: "ana", email: "invalido" }));
  assert.equal(v.parseUserCreate({ username: "ana.silva" }).temporaryPassword, false);
  assert.throws(() => v.parseUserUpdate({ status: "invited", isAdmin: false, isApprover: false, isFinance: false }));
  assert.throws(() => v.parseTokenPassword({ token: "curto", newPassword: "x" }));
});

test("validação: e-mail comum (com 's' e pontos) é aceito — regressão de regex", () => {
  const ok = v.parseUserCreate({ username: "susana.souza", email: "susana.souza@vextrom.com.br" });
  assert.equal(ok.email, "susana.souza@vextrom.com.br");
  assert.throws(() => v.parseUserCreate({ username: "sem.arroba", email: "susana.vextrom.com.br" }));
  assert.throws(() => v.parseUserCreate({ username: "sem.ponto", email: "susana@vextrom" }));
});
