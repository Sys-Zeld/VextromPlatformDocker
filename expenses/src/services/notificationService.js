const auditRepo = require("../repositories/auditRepository");
const profileRepo = require("../repositories/profileRepository");
const { NOTIFICATION_EVENTS: EV, STATUS_LABELS } = require("../constants");
const { formatBRL } = require("../lib/money");

// Notificações internas (gravadas na transação da operação) + e-mail opcional
// (disparado só DEPOIS do commit, sem bloquear nem desfazer a operação).
//
// deps.listManagers(): Promise<[{ userId, username, email }]>
// deps.sendEmail({ to, subject, heading, bodyLines, actionUrl, actionLabel })
// options: { emailEnabled: boolean | () => Promise<boolean>, appBaseUrl }

const TITLES = {
  [EV.SUBMITTED]: "Relatório enviado para aprovação",
  [EV.RESUBMITTED]: "Relatório corrigido e reenviado",
  [EV.REVIEW_STARTED]: "Relatório em análise",
  [EV.APPROVED]: "Relatório aprovado",
  [EV.REJECTED]: "Relatório rejeitado",
  [EV.RETURNED]: "Relatório devolvido para correção",
  [EV.PAID]: "Reembolso pago"
};

// Quem recebe cada evento: a gestão (envios) ou o solicitante (decisões).
const MANAGER_EVENTS = new Set([EV.SUBMITTED, EV.RESUBMITTED]);

function formatDateTime(date) {
  return new Date(date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function createNotificationService(deps = {}, options = {}) {
  const listManagers = deps.listManagers || (async () => []);

  function buildMessage(event, report, actor, reason) {
    const lines = [
      `Relatório ${report.report_number} — ${report.title}`,
      `Status: ${STATUS_LABELS[report.status] || report.status}`,
      `Data: ${formatDateTime(new Date())}`
    ];
    if (MANAGER_EVENTS.has(event)) {
      lines.push(`Solicitante: ${report.requester_name || report.requester_username}`);
      lines.push(`Valor: ${formatBRL(report.total_amount)}`);
    } else {
      lines.push(`Responsável: ${actor.username}`);
    }
    if (event === EV.PAID && report.paid_amount) lines.push(`Valor pago: ${formatBRL(report.paid_amount)}`);
    if (reason) lines.push(`Justificativa: ${reason}`);
    return lines;
  }

  // Grava as notificações e devolve os e-mails a enviar após o commit.
  async function notify(db, event, report, actor, reason = "") {
    const lines = buildMessage(event, report, actor, reason);
    const title = `${TITLES[event]} · ${report.report_number}`;
    const recipients = [];

    if (MANAGER_EVENTS.has(event)) {
      const managers = await listManagers().catch(() => []);
      for (const m of managers) {
        if (m.userId && m.userId !== report.user_id) recipients.push({ userId: m.userId, email: m.email || "", manager: true });
      }
    } else {
      const profile = await profileRepo.getByUserId(db, report.user_id);
      recipients.push({ userId: report.user_id, email: (profile && profile.email) || "", manager: false });
    }

    for (const r of recipients) {
      await auditRepo.insertNotification(db, {
        recipientUserId: r.userId,
        reportId: report.id,
        event,
        title,
        message: lines.join("\n")
      });
    }

    if (!deps.sendEmail) return [];
    const emailEnabled = typeof options.emailEnabled === "function"
      ? await options.emailEnabled().catch(() => false)
      : options.emailEnabled;
    if (!emailEnabled) return [];
    const base = String(options.appBaseUrl || "").replace(/\/+$/, "");
    return recipients
      .filter((r) => r.email)
      .map((r) => ({
        to: r.email,
        subject: title,
        heading: TITLES[event],
        bodyLines: lines,
        actionUrl: base ? `${base}/app/expenses/${r.manager ? "admin/" : ""}reports/${report.id}` : undefined,
        actionLabel: "Abrir relatório"
      }));
  }

  // Fire-and-forget: falha de SMTP não afeta a operação já confirmada.
  function dispatch(emails) {
    for (const mail of emails || []) {
      Promise.resolve()
        .then(() => deps.sendEmail(mail))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn(`[expenses] falha ao enviar e-mail de notificação: ${err.message}`);
        });
    }
  }

  return { notify, dispatch };
}

module.exports = { createNotificationService };
