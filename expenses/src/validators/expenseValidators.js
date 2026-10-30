const { z } = require("zod");
const { ACCOUNT_TYPES, PIX_KEY_TYPES, PAYMENT_METHODS } = require("../constants");
const { parseToCents, centsToDecimal } = require("../lib/money");
const { isValidCpf, onlyDigits } = require("../lib/cpf");
const { fromZod } = require("../lib/errors");

// Contratos de entrada (zod). parse* lança DomainError 400 com os issues.

const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (AAAA-MM-DD)")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data inválida");

const text = (max, label) => z.string().trim().max(max, `${label} muito longo`).optional().default("");
const required = (max, label) => z.string().trim().min(1, `${label} é obrigatório`).max(max, `${label} muito longo`);

const money = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const cents = parseToCents(v);
  if (cents === null || cents <= 0n) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor deve ser maior que zero (máx. 2 casas)" });
    return z.NEVER;
  }
  return centsToDecimal(cents);
});

const profileSchema = z.object({
  fullName: required(200, "Nome completo"),
  cpf: z.string().trim().max(20).optional().default("")
    .refine((v) => !v || isValidCpf(v), "CPF inválido")
    .transform(onlyDigits),
  email: z.string().trim().max(200).optional().default("")
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido"),
  phone: z.string().trim().max(30).optional().default("")
    .refine((v) => !v || /^[\d\s()+-]{8,30}$/.test(v), "Telefone inválido"),
  bankCode: z.string().trim().max(5).optional().default("")
    .refine((v) => !v || /^\d{3}$/.test(v), "Código do banco deve ter 3 dígitos"),
  bankName: text(120, "Banco"),
  agency: z.string().trim().max(10).optional().default("")
    .refine((v) => !v || /^\d{1,5}(-[\dXx])?$/.test(v), "Agência inválida"),
  accountNumber: z.string().trim().max(20).optional().default("")
    .refine((v) => !v || /^\d{1,15}$/.test(v), "Conta deve conter apenas dígitos"),
  accountDigit: z.string().trim().max(2).optional().default("")
    .refine((v) => !v || /^[\dXx]{1,2}$/.test(v), "Dígito inválido"),
  accountType: z.enum(["", ...ACCOUNT_TYPES]).optional().default(""),
  pixKey: z.string().trim().max(140).optional().default(""),
  pixKeyType: z.enum(["", ...PIX_KEY_TYPES]).optional().default("")
}).superRefine((v, ctx) => {
  if (v.pixKey && !v.pixKeyType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pixKeyType"], message: "Informe o tipo da chave Pix" });
  }
  if (v.pixKey && v.pixKeyType === "CPF" && !isValidCpf(v.pixKey)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pixKey"], message: "Chave Pix CPF inválida" });
  }
  if (v.pixKey && v.pixKeyType === "EMAIL" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.pixKey)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pixKey"], message: "Chave Pix e-mail inválida" });
  }
});

const reportSchema = z.object({
  title: required(200, "Título"),
  description: text(4000, "Descrição"),
  projectName: text(200, "Projeto"),
  costCenter: text(120, "Centro de custo"),
  startDate: isoDate,
  endDate: isoDate
}).refine((v) => v.endDate >= v.startDate, { path: ["endDate"], message: "Data final anterior à inicial" });

const itemSchema = z.object({
  expenseDate: isoDate,
  categoryId: z.coerce.number().int().positive("Categoria é obrigatória"),
  description: required(500, "Descrição"),
  justification: required(2000, "Justificativa"),
  amount: money,
  merchant: text(200, "Estabelecimento"),
  notes: text(2000, "Observações")
});

const categorySchema = z.object({
  name: required(80, "Nome"),
  description: text(300, "Descrição"),
  active: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional().default(0)
});

const decisionSchema = z.object({
  reason: z.string().trim().max(2000, "Justificativa muito longa").optional().default("")
});

const paymentSchema = z.object({
  paymentDate: isoDate,
  amount: money,
  paymentMethod: z.enum(PAYMENT_METHODS),
  transactionReference: text(200, "Referência"),
  notes: text(2000, "Observações"),
  proof: z.object({
    name: z.string().trim().min(1).max(200),
    // Base64 do comprovante bancário (limite de tamanho aplicado no serviço).
    dataBase64: z.string().min(1)
  }).optional().nullable()
});

const usernameField = z.string().trim().min(3, "Usuário deve ter ao menos 3 caracteres").max(60, "Usuário muito longo")
  .regex(/^[A-Za-z0-9._@-]+$/, "Usuário: use letras, números, ponto, hífen, arroba ou sublinhado");
const optionalEmail = z.string().trim().max(200).optional().default("")
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido");
const passwordField = z.string().min(1, "Informe a senha").max(200, "Senha muito longa");

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Informe o usuário ou e-mail").max(200),
  password: passwordField
});

const changePasswordSchema = z.object({
  currentPassword: passwordField,
  newPassword: passwordField
});

const forgotPasswordSchema = z.object({ identifier: z.string().trim().min(1).max(200) });

const tokenPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  newPassword: passwordField
});

const userCreateSchema = z.object({
  username: usernameField,
  fullName: z.string().trim().max(200).optional().default(""),
  email: optionalEmail,
  isAdmin: z.boolean().optional().default(false),
  isApprover: z.boolean().optional().default(false),
  isFinance: z.boolean().optional().default(false),
  // Sem e-mail/SMTP: gera senha provisória (troca obrigatória no 1º acesso).
  temporaryPassword: z.boolean().optional().default(false)
});

const userUpdateSchema = z.object({
  fullName: z.string().trim().max(200).optional().default(""),
  email: optionalEmail,
  status: z.enum(["active", "disabled"]),
  isAdmin: z.boolean(),
  isApprover: z.boolean(),
  isFinance: z.boolean(),
  unlock: z.boolean().optional().default(false)
});

const emailAddress = z.string().trim().max(200).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "E-mail inválido");

const emailSettingsSchema = z.object({
  mode: z.enum(["platform", "custom"]),
  notificationsEnabled: z.boolean(),
  smtp: z.object({
    host: z.string().trim().max(200).optional().default("")
      .refine((v) => !v || /^[A-Za-z0-9.-]+$/.test(v), "Servidor inválido"),
    port: z.coerce.number().int().min(1, "Porta inválida").max(65535, "Porta inválida").optional().default(587),
    secure: z.boolean().optional().default(false),
    user: z.string().trim().max(200).optional().default(""),
    // Ausente/vazio = mantém a senha salva.
    pass: z.string().max(500).optional().default(""),
    // Aceita "email@dominio" ou "Nome <email@dominio>".
    from: z.string().trim().max(200).optional().default("")
      .refine((v) => !v || /^([^<>]*<)?[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>?$/.test(v), "Remetente inválido")
  }),
  clearPassword: z.boolean().optional().default(false)
});

const emailTestSchema = z.object({ to: emailAddress });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().trim().optional().default(""),
  search: z.string().trim().max(120).optional().default(""),
  project: z.string().trim().max(120).optional().default(""),
  categoryId: z.coerce.number().int().positive().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  sort: z.enum(["created_at", "submitted_at", "total_amount", "report_number", "status"]).optional().default("created_at"),
  dir: z.enum(["asc", "desc"]).optional().default("desc")
});

const periodQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional()
});

function parseWith(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) throw fromZod(result.error);
  return result.data;
}

module.exports = {
  parseProfile: (b) => parseWith(profileSchema, b),
  parseReport: (b) => parseWith(reportSchema, b),
  parseItem: (b) => parseWith(itemSchema, b),
  parseCategory: (b) => parseWith(categorySchema, b),
  parseDecision: (b) => parseWith(decisionSchema, b),
  parsePayment: (b) => parseWith(paymentSchema, b),
  parseLogin: (b) => parseWith(loginSchema, b),
  parseChangePassword: (b) => parseWith(changePasswordSchema, b),
  parseForgotPassword: (b) => parseWith(forgotPasswordSchema, b),
  parseTokenPassword: (b) => parseWith(tokenPasswordSchema, b),
  parseUserCreate: (b) => parseWith(userCreateSchema, b),
  parseUserUpdate: (b) => parseWith(userUpdateSchema, b),
  parseEmailSettings: (b) => parseWith(emailSettingsSchema, b),
  parseEmailTest: (b) => parseWith(emailTestSchema, b),
  parseListQuery: (q) => parseWith(listQuerySchema, q),
  parsePeriodQuery: (q) => parseWith(periodQuerySchema, q)
};
