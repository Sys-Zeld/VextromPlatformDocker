// Domínios do módulo de Despesas — fonte única para validação, workflow e UI.

const STATUS = {
  RASCUNHO: "RASCUNHO",
  ENVIADO: "ENVIADO",
  EM_ANALISE: "EM_ANALISE",
  DEVOLVIDO: "DEVOLVIDO",
  APROVADO: "APROVADO",
  REJEITADO: "REJEITADO",
  PAGO: "PAGO"
};

const STATUS_LABELS = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  EM_ANALISE: "Em análise",
  DEVOLVIDO: "Devolvido",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  PAGO: "Pago"
};

// Ações do workflow → transição permitida e quem pode executá-la.
// actor: "owner" (solicitante), "approver" (Aprovador) ou "finance" (Financeiro).
const ACTIONS = {
  SUBMIT: { from: [STATUS.RASCUNHO], to: STATUS.ENVIADO, actor: "owner", label: "Envio" },
  RESUBMIT: { from: [STATUS.DEVOLVIDO], to: STATUS.ENVIADO, actor: "owner", label: "Reenvio" },
  START_REVIEW: { from: [STATUS.ENVIADO], to: STATUS.EM_ANALISE, actor: "approver", label: "Início da análise" },
  APPROVE: { from: [STATUS.EM_ANALISE], to: STATUS.APROVADO, actor: "approver", label: "Aprovação", selfRestricted: true },
  REJECT: { from: [STATUS.EM_ANALISE], to: STATUS.REJEITADO, actor: "approver", label: "Rejeição", requiresReason: true },
  RETURN: { from: [STATUS.EM_ANALISE], to: STATUS.DEVOLVIDO, actor: "approver", label: "Devolução", requiresReason: true },
  PAY: { from: [STATUS.APROVADO], to: STATUS.PAGO, actor: "finance", label: "Pagamento", selfRestricted: true }
};

// Estados em que o solicitante pode editar dados e lançamentos.
const EDITABLE_STATUSES = [STATUS.RASCUNHO, STATUS.DEVOLVIDO];

const ACCOUNT_TYPES = ["CORRENTE", "POUPANCA", "PAGAMENTO"];
const PIX_KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "TELEFONE", "ALEATORIA"];
const PAYMENT_METHODS = ["PIX", "TED", "DEPOSITO", "DINHEIRO", "OUTRO"];

// Formatos aceitos de comprovante: extensão → MIME. A checagem real é por
// assinatura binária (lib/fileSignature). Para aceitar outro formato, inclua-o
// aqui e no detector.
const ALLOWED_FILE_TYPES = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp"
};

const NOTIFICATION_EVENTS = {
  SUBMITTED: "SUBMITTED",
  RESUBMITTED: "RESUBMITTED",
  REVIEW_STARTED: "REVIEW_STARTED",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED: "RETURNED",
  PAID: "PAID"
};

// Login próprio do módulo.
const AUTH = {
  MAX_ATTEMPTS: 5, // senhas erradas seguidas até bloquear
  LOCK_MINUTES: 15,
  INVITE_TTL_MINUTES: 72 * 60,
  RESET_TTL_MINUTES: 60
};

module.exports = {
  AUTH,
  STATUS,
  STATUS_LABELS,
  ACTIONS,
  EDITABLE_STATUSES,
  ACCOUNT_TYPES,
  PIX_KEY_TYPES,
  PAYMENT_METHODS,
  ALLOWED_FILE_TYPES,
  NOTIFICATION_EVENTS
};
