const crypto = require("crypto");
const pool = require("../db");
const { withTransaction } = require("../db");
const env = require("../../../specflow/config/env");
const passwordPolicy = require("../../../specflow/services/passwordPolicy");
const userRepo = require("../repositories/userRepository");
const audit = require("./auditService");
const { hashPassword, verifyPassword } = require("../lib/password");
const { createSessionCodec } = require("../lib/session");
const { sha256 } = require("../lib/crypto");
const { DomainError, badRequest } = require("../lib/errors");
const { AUTH } = require("../constants");

// Login próprio do módulo, independente da sessão do hub.
// Sessão: cookie HttpOnly assinado; validado a cada requisição contra o banco
// (status ativo + session_version), então desativar/excluir/trocar senha
// derruba as sessões abertas na hora.

const ANONYMOUS = { userId: "anonymous", username: "anônimo" };

function actorFromUser(u) {
  return {
    userId: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email,
    canSubmit: true,
    canApprove: Boolean(u.is_approver),
    canPay: Boolean(u.is_finance),
    canManageUsers: Boolean(u.is_admin),
    canManage: Boolean(u.is_admin || u.is_approver || u.is_finance),
    mustChangePassword: Boolean(u.must_change_password)
  };
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email,
    isAdmin: u.is_admin,
    isApprover: u.is_approver,
    isFinance: u.is_finance,
    mustChangePassword: u.must_change_password
  };
}

function validateNewPassword(password, user) {
  const problems = passwordPolicy.validatePassword(password, { username: user.username, email: user.email });
  if (problems.length) throw badRequest("EX_WEAK_PASSWORD", problems.join(" "));
}

function createAuthService({ email }) {
  const codec = createSessionCodec(env.expenses.sessionSecret || env.expenses.dataKey || env.admin.sessionSecret);
  const cookieName = env.expenses.sessionCookieName;
  const ttlMs = env.expenses.sessionTtlHours * 60 * 60 * 1000;
  const appUsesHttps = String(env.appBaseUrl || "").toLowerCase().startsWith("https://");

  function setSessionCookie(req, res, user) {
    res.cookie(cookieName, codec.issue({ userId: user.id, sessionVersion: user.session_version, ttlMs }), {
      httpOnly: true,
      sameSite: "lax",
      secure: appUsesHttps || req.secure,
      path: "/",
      maxAge: ttlMs
    });
  }

  function clearSessionCookie(req, res) {
    res.clearCookie(cookieName, { httpOnly: true, sameSite: "lax", secure: appUsesHttps || req.secure, path: "/" });
  }

  // Ator da requisição (ou null). Usado pela API e pelo gate do SPA no hub.
  async function resolveActor(req) {
    const session = codec.verify(req.cookies && req.cookies[cookieName]);
    if (!session) return null;
    const user = await userRepo.getById(pool, session.uid);
    if (!user || user.status !== "active" || user.session_version !== session.sv) return null;
    return actorFromUser(user);
  }

  async function login(req, res, { identifier, password }) {
    const ip = req.ip;
    const outcome = await withTransaction(async (db) => {
      const user = await userRepo.findForLogin(db, identifier);
      // Mesmo custo de scrypt existindo ou não o usuário.
      const ok = await verifyPassword(password, user ? user.password_hash : "");

      if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
        await audit.record(db, actorFromUser(user), { action: "LOGIN_BLOCKED", entityType: "user", entityId: user.id, metadata: { ip } });
        return { locked: user.locked_until };
      }
      if (!user || !ok || user.status !== "active") {
        let lockedUntil = null;
        if (user && user.status === "active") {
          const r = await userRepo.registerFailure(db, user.id, { maxAttempts: AUTH.MAX_ATTEMPTS, lockMinutes: AUTH.LOCK_MINUTES });
          lockedUntil = r.locked_until;
        }
        await audit.record(db, user ? actorFromUser(user) : ANONYMOUS, {
          action: lockedUntil ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
          entityType: "user",
          entityId: user ? user.id : null,
          metadata: { ip, identifier: user ? undefined : String(identifier).slice(0, 120) }
        });
        return lockedUntil ? { locked: lockedUntil } : { invalid: true };
      }
      await userRepo.registerSuccess(db, user.id);
      await audit.record(db, actorFromUser(user), { action: "LOGIN_SUCCESS", entityType: "user", entityId: user.id, metadata: { ip } });
      return { user };
    });

    if (outcome.locked) {
      const until = new Date(outcome.locked).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
      throw new DomainError(423, "EX_ACCOUNT_LOCKED", `Conta bloqueada por excesso de tentativas. Tente novamente após ${until}.`);
    }
    // Mensagem única: não revela se o usuário existe, está inativo ou errou a senha.
    if (outcome.invalid) throw new DomainError(401, "EX_LOGIN_INVALID", "Usuário ou senha inválidos.");
    setSessionCookie(req, res, outcome.user);
    return publicUser(outcome.user);
  }

  async function logout(req, res, actor) {
    clearSessionCookie(req, res);
    if (actor) await audit.record(pool, actor, { action: "LOGOUT", entityType: "user", entityId: actor.userId });
  }

  async function me(actor) {
    const user = await userRepo.getById(pool, actor.userId);
    return publicUser(user);
  }

  async function changePassword(req, res, actor, { currentPassword, newPassword }) {
    const user = await withTransaction(async (db) => {
      const current = await userRepo.getById(db, actor.userId, { withHash: true, forUpdate: true });
      if (!current || !(await verifyPassword(currentPassword, current.password_hash))) {
        throw badRequest("EX_CURRENT_PASSWORD_INVALID", "Senha atual incorreta.");
      }
      if (currentPassword === newPassword) throw badRequest("EX_SAME_PASSWORD", "A nova senha deve ser diferente da atual.");
      validateNewPassword(newPassword, current);
      const updated = await userRepo.setPassword(db, current.id, { passwordHash: await hashPassword(newPassword) });
      await audit.record(db, actor, { action: "PASSWORD_CHANGED", entityType: "user", entityId: current.id });
      return updated;
    });
    // Outras sessões caem (session_version mudou); esta recebe cookie novo.
    setSessionCookie(req, res, user);
    return publicUser(user);
  }

  /* ----------------------- Convite e redefinição de senha ----------------------- */

  async function issueToken(db, user, kind) {
    const raw = crypto.randomBytes(32).toString("base64url");
    const ttlMinutes = kind === "invite" ? AUTH.INVITE_TTL_MINUTES : AUTH.RESET_TTL_MINUTES;
    const { expires_at: expiresAt } = await userRepo.insertToken(db, { userId: user.id, kind, tokenHash: sha256(raw), ttlMinutes });
    const base = String(env.appBaseUrl || "").replace(/\/+$/, "");
    const route = kind === "invite" ? "set-password" : "reset-password";
    return { link: `${base}/app/expenses/${route}?token=${encodeURIComponent(raw)}`, expiresAt };
  }

  const fmtDeadline = (d) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

  async function sendTokenEmail(user, kind, { link, expiresAt }) {
    const invite = kind === "invite";
    await email.send({
      to: user.email,
      subject: invite ? "Relatório de Despesas — crie sua senha de acesso" : "Relatório de Despesas — redefinição de senha",
      heading: invite ? "Bem-vindo ao Relatório de Despesas" : "Redefinição de senha",
      bodyLines: invite
        ? [`Olá, ${user.full_name || user.username}.`, `Foi criado um acesso para você (usuário: ${user.username}). Clique no botão abaixo para definir sua senha.`, passwordPolicy.describeRequirements()]
        : [`Olá, ${user.full_name || user.username}.`, "Recebemos um pedido para redefinir a senha do seu acesso ao Relatório de Despesas.", "Se não foi você, ignore este e-mail — sua senha atual continua valendo."],
      actionUrl: link,
      actionLabel: invite ? "Criar minha senha" : "Redefinir senha",
      footNote: `Este link vale até ${fmtDeadline(expiresAt)} e só pode ser usado uma vez.`
    });
  }

  // Emite o token e tenta enviar. Falha de envio devolve o link para o
  // administrador entregar por outro meio (só em chamadas administrativas).
  async function deliverToken(user, kind) {
    const token = await withTransaction((db) => issueToken(db, user, kind));
    try {
      await sendTokenEmail(user, kind, token);
      return { link: token.link, emailError: null };
    } catch (err) {
      return { link: token.link, emailError: err.message || "Falha ao enviar e-mail." };
    }
  }

  // "Esqueci minha senha": resposta sempre igual, exista ou não a conta.
  async function requestPasswordReset(identifier) {
    const user = await withTransaction((db) => userRepo.findForLogin(db, identifier));
    if (!user || user.status !== "active" || !user.email) return;
    const result = await deliverToken(user, "reset");
    await audit.record(pool, actorFromUser(user), {
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "user",
      entityId: user.id,
      metadata: { emailSent: !result.emailError }
    });
  }

  async function tokenInfo(rawToken) {
    const t = await userRepo.findValidToken(pool, sha256(String(rawToken || "")));
    if (!t) throw badRequest("EX_TOKEN_INVALID", "Link inválido ou expirado. Solicite um novo.");
    return { kind: t.kind, username: t.username, requirements: passwordPolicy.describeRequirements() };
  }

  async function completeToken(rawToken, newPassword) {
    return withTransaction(async (db) => {
      const t = await userRepo.findValidToken(db, sha256(String(rawToken || "")), { forUpdate: true });
      if (!t) throw badRequest("EX_TOKEN_INVALID", "Link inválido ou expirado. Solicite um novo.");
      validateNewPassword(newPassword, { username: t.username, email: t.email });
      const user = await userRepo.setPassword(db, t.user_id, { passwordHash: await hashPassword(newPassword) });
      await userRepo.markTokenUsed(db, t.id);
      await audit.record(db, actorFromUser(user), {
        action: t.kind === "invite" ? "INVITE_ACCEPTED" : "PASSWORD_RESET",
        entityType: "user",
        entityId: user.id
      });
      return { username: user.username };
    });
  }

  return {
    resolveActor,
    login,
    logout,
    me,
    changePassword,
    deliverToken,
    requestPasswordReset,
    tokenInfo,
    completeToken,
    validateNewPassword
  };
}

module.exports = { createAuthService, actorFromUser, publicUser };
