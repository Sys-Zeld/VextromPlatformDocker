// Fluxos de acesso por e-mail: convite (definir a primeira senha) e
// recuperação de senha. Junta adminUsers (tokens) com o envio de e-mail.

const env = require("../config/env");
const adminUsers = require("./adminUsers");
const passwordPolicy = require("./passwordPolicy");
const { sendTransactionalEmail } = require("./email");

function buildLink(routePath, token) {
  const base = String(env.appBaseUrl || "").replace(/\/+$/, "");
  return `${base}${routePath}?token=${encodeURIComponent(token)}`;
}

function formatDeadline(expiresAt) {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo"
    }).format(expiresAt);
  } catch (_err) {
    return expiresAt.toISOString();
  }
}

/** Convite: o usuário define a própria senha, ninguém precisa transmitir senha. */
async function sendInvite({ userId, email, username }) {
  const { token, expiresAt } = await adminUsers.issueUserToken(userId, adminUsers.TOKEN_KINDS.INVITE);
  const link = buildLink("/admin/definir-senha", token);

  await sendTransactionalEmail({
    to: email,
    subject: "Vextrom Platform — crie sua senha de acesso",
    heading: "Bem-vindo à Vextrom Platform",
    bodyLines: [
      `Olá, ${username}.`,
      "Foi criado um acesso para você. Clique no botão abaixo para verificar seu e-mail e definir sua senha.",
      passwordPolicy.describeRequirements()
    ],
    actionUrl: link,
    actionLabel: "Criar minha senha",
    footNote: `Este link vale até ${formatDeadline(expiresAt)} e só pode ser usado uma vez.`
  });

  // Devolve o link para a tela poder mostrá-lo: se o e-mail não chegar ou o
  // APP_BASE_URL apontar para um endereço inacessível, o administrador ainda
  // consegue entregar o acesso copiando o link.
  return { expiresAt, link };
}

/**
 * Recuperação. Só envia se houver conta ativa com aquele e-mail — mas quem
 * chama NÃO deve revelar o resultado ao visitante, para não virar uma sonda de
 * "esse e-mail tem conta aqui?".
 */
async function sendPasswordReset({ email }) {
  const user = await adminUsers.findAdminUserByEmail(email);
  if (!user || user.status === adminUsers.USER_STATUS.DISABLED) return { sent: false };

  const { token, expiresAt } = await adminUsers.issueUserToken(user.id, adminUsers.TOKEN_KINDS.RESET);
  const link = buildLink("/admin/redefinir-senha", token);

  await sendTransactionalEmail({
    to: user.email,
    subject: "Vextrom Platform — redefinição de senha",
    heading: "Redefinir sua senha",
    bodyLines: [
      `Olá, ${user.username}.`,
      "Recebemos um pedido para redefinir a senha da sua conta. Se foi você, clique no botão abaixo.",
      passwordPolicy.describeRequirements()
    ],
    actionUrl: link,
    actionLabel: "Redefinir minha senha",
    footNote: `Este link vale até ${formatDeadline(expiresAt)} e só pode ser usado uma vez. `
      + "Se você não pediu a redefinição, ignore esta mensagem — sua senha atual continua valendo."
  });

  return { sent: true, expiresAt };
}

module.exports = { sendInvite, sendPasswordReset };
