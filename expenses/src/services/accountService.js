const pool = require("../db");
const { withTransaction } = require("../db");
const userRepo = require("../repositories/userRepository");
const audit = require("./auditService");
const policy = require("../policies/expensePolicy");
const { hashPassword, generateTemporaryPassword } = require("../lib/password");
const { badRequest, notFound, conflict } = require("../lib/errors");

// Gestão das contas do módulo (tela Usuários) — só Administrador do módulo.
// Papéis: Colaborador (toda conta ativa), Aprovador, Financeiro, Administrador.
// Cada usuário tem um aprovador definido (quem decide sobre os relatórios dele).

function view(u) {
  const locked = Boolean(u.locked_until && new Date(u.locked_until) > new Date());
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    email: u.email,
    status: u.status,
    isAdmin: u.is_admin,
    isApprover: u.is_approver,
    isFinance: u.is_finance,
    approverId: u.approver_id || null,
    approverName: u.approver_name || null,
    locked,
    lockedUntil: locked ? u.locked_until : null,
    mustChangePassword: u.must_change_password,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at
  };
}

function uniqueViolation(err) {
  if (err && err.code === "23505") {
    return conflict("EX_USER_DUP", String(err.constraint || "").includes("email")
      ? "Já existe uma conta com este e-mail."
      : "Já existe uma conta com este usuário.");
  }
  return err;
}

function createAccountService({ auth }) {
  async function listUsers(actor) {
    policy.assertUserAdmin(actor);
    return (await userRepo.list(pool)).map(view);
  }

  async function loadTarget(db, id, opts) {
    const user = await userRepo.getById(db, id, opts);
    if (!user) throw notFound("Usuário não encontrado", "EX_USER_NOT_FOUND");
    return user;
  }

  // O aprovador escolhido precisa existir, ter o papel Aprovador e estar ativo.
  async function assertValidApprover(db, approverId, userId = null) {
    if (!approverId) return;
    if (approverId === userId) throw badRequest("EX_APPROVER_SELF", "O usuário não pode ser o próprio aprovador.");
    const approver = await userRepo.getById(db, approverId);
    if (!approver || !approver.is_approver || approver.status === "disabled") {
      throw badRequest("EX_APPROVER_INVALID", "O aprovador escolhido precisa ser um usuário ativo com o papel Aprovador.");
    }
  }

  // Quem é aprovador de alguém não pode perder o papel nem sair sem antes
  // transferir esses usuários — eles ficariam sem quem aprove.
  async function assertNoApprovees(db, user, action) {
    const count = await userRepo.countApprovees(db, user.id);
    if (count > 0) {
      throw badRequest("EX_APPROVER_IN_USE",
        `${user.username} é aprovador de ${count} usuário(s). Defina outro aprovador para eles antes de ${action}.`);
    }
  }

  // Criação: convite por e-mail (padrão) ou senha provisória (troca obrigatória
  // no primeiro acesso) quando não há e-mail/SMTP disponível.
  async function createUser(actor, input) {
    policy.assertUserAdmin(actor);
    if (!input.email && !input.temporaryPassword) {
      throw badRequest("EX_USER_NO_CREDENTIAL", "Informe um e-mail para o convite ou marque a opção de senha provisória.");
    }
    const temporary = input.temporaryPassword ? generateTemporaryPassword() : null;
    let user;
    try {
      user = await withTransaction(async (db) => {
        await assertValidApprover(db, input.approverId);
        const created = await userRepo.insert(db, {
          username: input.username,
          fullName: input.fullName,
          email: input.email,
          passwordHash: temporary ? await hashPassword(temporary) : "",
          status: temporary ? "active" : "invited",
          isAdmin: input.isAdmin,
          isApprover: input.isApprover,
          isFinance: input.isFinance,
          mustChangePassword: Boolean(temporary),
          createdBy: actor.username,
          approverId: input.approverId
        });
        await audit.record(db, actor, {
          action: "USER_CREATED",
          entityType: "user",
          entityId: created.id,
          metadata: {
            username: created.username,
            email: created.email,
            roles: { admin: input.isAdmin, approver: input.isApprover, finance: input.isFinance },
            approverId: input.approverId || null,
            method: temporary ? "temporary_password" : "invite"
          }
        });
        return created;
      });
    } catch (err) {
      throw uniqueViolation(err);
    }
    // A senha provisória é mostrada UMA vez ao administrador; nunca é gravada em claro.
    if (temporary) return { user: view(user), temporaryPassword: temporary, inviteLink: null, inviteError: null };
    const invite = await auth.deliverToken(user, "invite");
    return { user: view(user), temporaryPassword: null, inviteLink: invite.link, inviteError: invite.emailError };
  }

  async function updateUser(actor, id, input) {
    policy.assertUserAdmin(actor);
    try {
      return await withTransaction(async (db) => {
        const before = await loadTarget(db, id, { forUpdate: true });
        const self = before.id === actor.userId;
        if (self && (!input.isAdmin || input.status === "disabled")) {
          throw badRequest("EX_SELF_LOCKOUT", "Você não pode remover o próprio acesso de administrador nem desativar a si mesmo.");
        }
        const losesAdmin = before.is_admin && before.status === "active" && (!input.isAdmin || input.status === "disabled");
        if (losesAdmin && (await userRepo.countActiveAdmins(db, { excludeId: before.id })) === 0) {
          throw badRequest("EX_LAST_ADMIN", "O módulo precisa de pelo menos um administrador ativo.");
        }
        // Convite pendente continua pendente até a pessoa definir a senha.
        const status = before.status === "invited" && input.status === "active" ? "invited" : input.status;
        const disabling = status === "disabled" && before.status !== "disabled";
        if (before.is_approver && (!input.isApprover || disabling)) {
          await assertNoApprovees(db, before, input.isApprover ? "desativá-lo" : "remover o papel Aprovador");
        }
        // Sem `approverId` no pedido, mantém o aprovador atual.
        const approverId = input.approverId === undefined ? before.approver_id : input.approverId;
        if (approverId !== before.approver_id) await assertValidApprover(db, approverId, before.id);
        const updated = await userRepo.update(db, before.id, {
          fullName: input.fullName,
          email: input.email,
          status,
          isAdmin: input.isAdmin,
          isApprover: input.isApprover,
          isFinance: input.isFinance,
          approverId,
          revokeSessions: disabling || (before.email !== input.email),
          unlock: input.unlock
        });
        await audit.record(db, actor, {
          action: "USER_UPDATED",
          entityType: "user",
          entityId: before.id,
          metadata: {
            username: before.username,
            before: { status: before.status, email: before.email, admin: before.is_admin, approver: before.is_approver, finance: before.is_finance, approverId: before.approver_id },
            after: { status: updated.status, email: updated.email, admin: updated.is_admin, approver: updated.is_approver, finance: updated.is_finance, approverId: updated.approver_id },
            unlocked: Boolean(input.unlock)
          }
        });
        return view(updated);
      });
    } catch (err) {
      throw uniqueViolation(err);
    }
  }

  // Exclusão lógica: a conta some e as sessões caem; relatórios e auditoria ficam.
  async function deleteUser(actor, id) {
    policy.assertUserAdmin(actor);
    return withTransaction(async (db) => {
      const target = await loadTarget(db, id, { forUpdate: true });
      if (target.id === actor.userId) throw badRequest("EX_SELF_DELETE", "Você não pode excluir o próprio usuário.");
      if (target.is_admin && target.status === "active" && (await userRepo.countActiveAdmins(db, { excludeId: target.id })) === 0) {
        throw badRequest("EX_LAST_ADMIN", "O módulo precisa de pelo menos um administrador ativo.");
      }
      if (target.is_approver) await assertNoApprovees(db, target, "excluí-lo");
      await userRepo.softDelete(db, target.id);
      await audit.record(db, actor, {
        action: "USER_DELETED",
        entityType: "user",
        entityId: target.id,
        metadata: { username: target.username, email: target.email }
      });
      return { username: target.username };
    });
  }

  // Reenvio de convite (pendente) ou envio de link de redefinição (ativo).
  async function sendAccessLink(actor, id) {
    policy.assertUserAdmin(actor);
    const target = await loadTarget(pool, id);
    if (target.status === "disabled") throw badRequest("EX_USER_DISABLED", "Conta desativada.");
    if (!target.email) throw badRequest("EX_USER_NO_EMAIL", "Conta sem e-mail cadastrado.");
    const kind = target.status === "invited" ? "invite" : "reset";
    const result = await auth.deliverToken(target, kind);
    await audit.record(pool, actor, {
      action: kind === "invite" ? "INVITE_RESENT" : "PASSWORD_RESET_SENT",
      entityType: "user",
      entityId: target.id,
      metadata: { username: target.username, emailSent: !result.emailError }
    });
    return { kind, link: result.link, emailError: result.emailError };
  }

  return { listUsers, createUser, updateUser, deleteUser, sendAccessLink };
}

module.exports = { createAccountService };
