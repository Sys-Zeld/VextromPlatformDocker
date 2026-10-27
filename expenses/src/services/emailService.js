const pool = require("../db");
const { withTransaction } = require("../db");
const env = require("../../../specflow/config/env");
const settingsRepo = require("../repositories/settingsRepository");
const audit = require("./auditService");
const policy = require("../policies/expensePolicy");
const { getCipher } = require("../lib/crypto");
const { DomainError, unprocessable } = require("../lib/errors");

// E-mail do módulo: usa o SMTP da plataforma (padrão) ou um SMTP próprio,
// configurado na tela Configurações. Vale para notificações, convites e
// redefinição de senha. A senha SMTP é cifrada e nunca sai na API.
//
// deps.sendEmail(mail) → sendTransactionalEmail da plataforma (aceita mail.smtp)

const KEYS = {
  mode: "email.mode", // "platform" | "custom"
  notifications: "email.notifications", // "true" | "false"
  host: "email.smtp.host",
  port: "email.smtp.port",
  secure: "email.smtp.secure",
  user: "email.smtp.user",
  passEnc: "email.smtp.pass_enc",
  from: "email.smtp.from"
};

function createEmailService(deps) {
  async function readRaw(db = pool) {
    return settingsRepo.getMany(db, Object.values(KEYS));
  }

  function toConfig(raw) {
    return {
      mode: raw[KEYS.mode] === "custom" ? "custom" : "platform",
      // Sem configuração salva, segue a variável de ambiente.
      notificationsEnabled: raw[KEYS.notifications] !== undefined
        ? raw[KEYS.notifications] === "true"
        : env.expenses.emailNotifications,
      smtp: {
        host: raw[KEYS.host] || "",
        port: Number(raw[KEYS.port]) || 587,
        secure: raw[KEYS.secure] === "true",
        user: raw[KEYS.user] || "",
        from: raw[KEYS.from] || ""
      },
      hasPassword: Boolean(raw[KEYS.passEnc])
    };
  }

  async function getConfig(actor) {
    policy.assertUserAdmin(actor);
    return toConfig(await readRaw());
  }

  async function saveConfig(actor, input) {
    policy.assertUserAdmin(actor);
    return withTransaction(async (db) => {
      const raw = await readRaw(db);
      const values = {
        [KEYS.mode]: input.mode,
        [KEYS.notifications]: String(input.notificationsEnabled),
        [KEYS.host]: input.smtp.host,
        [KEYS.port]: String(input.smtp.port),
        [KEYS.secure]: String(input.smtp.secure),
        [KEYS.user]: input.smtp.user,
        [KEYS.from]: input.smtp.from
      };
      // Senha: ausente = mantém; clearPassword = apaga; preenchida = substitui.
      if (input.clearPassword) values[KEYS.passEnc] = "";
      else if (input.smtp.pass) values[KEYS.passEnc] = getCipher().encrypt(input.smtp.pass);
      const after = { ...raw, ...values };
      if (input.mode === "custom" && (!after[KEYS.host] || !after[KEYS.from])) {
        throw unprocessable("EX_SMTP_INCOMPLETE", "Informe servidor e remetente do SMTP próprio.");
      }
      await settingsRepo.setMany(db, values, actor.username);
      await audit.record(db, actor, {
        action: "EMAIL_SETTINGS_UPDATED",
        entityType: "settings",
        entityId: "email",
        // Nunca registrar a senha — só se foi trocada.
        metadata: {
          mode: input.mode,
          notificationsEnabled: input.notificationsEnabled,
          host: input.smtp.host,
          port: input.smtp.port,
          user: input.smtp.user,
          from: input.smtp.from,
          passwordChanged: Boolean(input.smtp.pass) || Boolean(input.clearPassword)
        }
      });
      return toConfig(after);
    });
  }

  // SMTP a usar no envio: null = servidor da plataforma.
  async function smtpOverride() {
    const raw = await readRaw();
    if (raw[KEYS.mode] !== "custom") return null;
    return {
      host: raw[KEYS.host],
      port: Number(raw[KEYS.port]) || 587,
      secure: raw[KEYS.secure] === "true",
      user: raw[KEYS.user] || "",
      pass: raw[KEYS.passEnc] ? getCipher().decrypt(raw[KEYS.passEnc]) : "",
      from: raw[KEYS.from]
    };
  }

  async function notificationsEnabled() {
    return toConfig(await readRaw()).notificationsEnabled;
  }

  async function send(mail) {
    const smtp = await smtpOverride();
    return deps.sendEmail(smtp ? { ...mail, smtp } : mail);
  }

  // Envio de teste com a configuração SALVA. Devolve a mensagem real do servidor.
  async function sendTest(actor, to) {
    policy.assertUserAdmin(actor);
    const config = toConfig(await readRaw());
    try {
      await send({
        to,
        subject: "Vextrom — teste de e-mail do Relatório de Despesas",
        heading: "Teste de e-mail",
        bodyLines: [
          "Esta é uma mensagem de teste do módulo Relatório de Despesas.",
          `Servidor: ${config.mode === "custom" ? `SMTP próprio (${config.smtp.host}:${config.smtp.port})` : "SMTP da plataforma"}.`,
          `Enviado por ${actor.username} em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`
        ]
      });
    } catch (err) {
      throw new DomainError(502, "EX_EMAIL_TEST_FAILED", `Falha no envio: ${err.message}`);
    }
    await audit.record(pool, actor, {
      action: "EMAIL_TEST_SENT",
      entityType: "settings",
      entityId: "email",
      metadata: { to, mode: config.mode }
    });
    return { ok: true, mode: config.mode };
  }

  return { getConfig, saveConfig, send, sendTest, notificationsEnabled };
}

module.exports = { createEmailService };
