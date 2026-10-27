// Client tipado do módulo Relatório de Despesas (API /api/expenses).
// O módulo tem LOGIN PRÓPRIO (independente do hub): sessão expirada leva à
// tela de login do módulo, não ao /admin/login.
// Valores monetários trafegam como string decimal ("1234.56") — o total é
// sempre calculado pelo servidor; o front só exibe.
import { createApiClient } from "./client";

const API_ROOT = "/api/expenses";
const BASE = "";

export const EXPENSES_LOGIN_PATH = "/app/expenses/login";

const client = createApiClient({
  base: API_ROOT,
  csrfPath: "/auth/csrf-token",
  // Volta para a tela atual depois do login.
  loginUrl: () => `${EXPENSES_LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
  // Login/recuperação respondem 401 por senha errada — não é sessão expirada.
  noRedirectPrefixes: ["/auth/"]
});
const { api, downloadFile } = client;

export type ExpenseStatus = "RASCUNHO" | "ENVIADO" | "EM_ANALISE" | "DEVOLVIDO" | "APROVADO" | "REJEITADO" | "PAGO";
export type WorkflowAction = "SUBMIT" | "RESUBMIT" | "START_REVIEW" | "APPROVE" | "REJECT" | "RETURN" | "PAY";

export interface ExpenseCategory {
  id: number;
  name: string;
  description: string;
  active: boolean;
  sort_order: number;
}

export interface ExpensesMeta {
  actor: {
    userId: string;
    username: string;
    canManage: boolean;
    canApprove: boolean;
    canPay: boolean;
    canManageUsers: boolean;
  };
  categories: ExpenseCategory[];
  statuses: { value: ExpenseStatus; label: string }[];
  paymentMethods: string[];
  accountTypes: string[];
  pixKeyTypes: string[];
  allowedExtensions: string[];
  maxFileMb: number;
}

export interface ExpenseReport {
  id: number;
  report_number: string;
  user_id: string;
  requester_username: string;
  requester_name: string;
  title: string;
  description?: string;
  project_name: string;
  cost_center: string;
  start_date: string;
  end_date: string;
  total_amount: string;
  approved_amount: string | null;
  paid_amount: string;
  status: ExpenseStatus;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by_name?: string | null;
  reviewer_name?: string | null;
  paid_at: string | null;
  last_decision_reason?: string;
  created_at: string;
  updated_at: string;
  items_count?: number;
}

export interface ExpenseItem {
  id: number;
  report_id: number;
  category_id: number;
  category_name: string;
  expense_date: string;
  description: string;
  justification: string;
  amount: string;
  merchant: string;
  notes: string;
}

export interface ExpenseAttachment {
  id: number;
  item_id: number;
  report_id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_hash: string;
  created_at: string;
}

export interface DuplicateWarning {
  reportId: number | null;
  reportNumber: string;
  sameReport: boolean;
}

export interface HistoryEntry {
  id: number;
  report_id: number;
  previous_status: ExpenseStatus | null;
  new_status: ExpenseStatus;
  action: WorkflowAction;
  performed_by_name: string;
  reason: string;
  created_at: string;
  report_number?: string;
  title?: string;
  requester_name?: string;
  requester_username?: string;
}

export interface ExpensePayment {
  id: number;
  report_id: number;
  amount: string;
  payment_date: string;
  payment_method: string;
  transaction_reference: string;
  proof_name: string | null;
  has_proof: boolean;
  notes: string;
  recorded_by_name: string;
  created_at: string;
  report_number?: string;
  title?: string;
  requester_name?: string;
  requester_username?: string;
}

export interface ProfileData {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  bankCode: string;
  bankName: string;
  agency: string;
  accountNumber: string;
  accountDigit: string;
  accountType: string;
  pixKey: string;
  pixKeyType: string;
}

export interface Readiness {
  ready: boolean;
  missing: string[];
}

export interface ReportDetail {
  report: ExpenseReport;
  items: ExpenseItem[];
  attachments: ExpenseAttachment[];
  duplicates: Record<string, DuplicateWarning[]>;
  history: HistoryEntry[];
  payments: ExpensePayment[];
  requester: { profile: ProfileData | null; readiness: Readiness } | null;
  permissions: { isOwner: boolean; canEdit: boolean; canDelete: boolean; actions: WorkflowAction[] };
}

export interface ReportList {
  reports: ExpenseReport[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReportInput {
  title: string;
  description: string;
  projectName: string;
  costCenter: string;
  startDate: string;
  endDate: string;
}

export interface ItemInput {
  expenseDate: string;
  categoryId: number | "";
  description: string;
  justification: string;
  amount: string;
  merchant: string;
  notes: string;
}

export interface DashboardData {
  total: number;
  counts: Record<ExpenseStatus, number>;
  requestedAmount: string;
  approvedUnpaidAmount: string;
  reimbursedAmount: string;
  charts: {
    monthly: { month: string; amount: string }[];
    byCategory: { label: string; amount: string }[];
    byUser?: { label: string; amount: string }[];
    byProject?: { label: string; amount: string }[];
    byStatus?: { status: ExpenseStatus; count: number }[];
  };
  recent?: ExpenseReport[];
}

export interface NotificationEntry {
  id: number;
  report_id: number | null;
  report_number: string | null;
  event: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  report_id: number | null;
  report_number: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  previous_status: string | null;
  new_status: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
  project?: string;
  categoryId?: number | "";
  from?: string;
  to?: string;
  sort?: string;
  dir?: "asc" | "desc";
}

function qs(params: object = {}): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

/* ------------------------------ Usuário ------------------------------ */

export const getMeta = () => api<ExpensesMeta>(`${BASE}/meta`);

export const getProfile = () => api<{ profile: ProfileData | null; readiness: Readiness }>(`${BASE}/profile`);
export const saveProfile = (input: ProfileData) =>
  api<{ profile: ProfileData; readiness: Readiness }>(`${BASE}/profile`, { method: "PUT", ...json(input) });

export const getDashboard = (period: { from?: string; to?: string }) =>
  api<DashboardData>(`${BASE}/dashboard${qs(period)}`);

export const listMyReports = (params: ListParams) => api<ReportList>(`${BASE}/reports${qs(params)}`);
export const createReport = (input: ReportInput) =>
  api<{ report: ExpenseReport }>(`${BASE}/reports`, { method: "POST", ...json(input) });
export const getReport = (id: number) => api<ReportDetail>(`${BASE}/reports/${id}`);
export const updateReport = (id: number, input: ReportInput) =>
  api<{ report: ExpenseReport }>(`${BASE}/reports/${id}`, { method: "PUT", ...json(input) });
export const deleteReport = (id: number) => api<void>(`${BASE}/reports/${id}`, { method: "DELETE" });
export const checkSubmission = (id: number) =>
  api<{ canSubmit: boolean; issues: string[] }>(`${BASE}/reports/${id}/submission-check`);
export const submitReport = (id: number) =>
  api<{ report: ExpenseReport }>(`${BASE}/reports/${id}/submit`, { method: "POST" });

export const addItem = (reportId: number, input: ItemInput) =>
  api<{ item: ExpenseItem; totalAmount: string }>(`${BASE}/reports/${reportId}/items`, { method: "POST", ...json(input) });
export const updateItem = (reportId: number, itemId: number, input: ItemInput) =>
  api<{ item: ExpenseItem; totalAmount: string }>(`${BASE}/reports/${reportId}/items/${itemId}`, { method: "PUT", ...json(input) });
export const deleteItem = (reportId: number, itemId: number) =>
  api<{ totalAmount: string }>(`${BASE}/reports/${reportId}/items/${itemId}`, { method: "DELETE" });

export const uploadAttachment = (reportId: number, itemId: number, file: File) =>
  api<{ attachment: ExpenseAttachment; duplicateWarnings: DuplicateWarning[] }>(
    `${BASE}/reports/${reportId}/items/${itemId}/attachments`,
    {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name)
      },
      body: file
    }
  );
export const deleteAttachment = (reportId: number, attachmentId: number) =>
  api<void>(`${BASE}/reports/${reportId}/attachments/${attachmentId}`, { method: "DELETE" });

// URLs servidas pela mesma origem (cookie de sessão): usáveis em <img>/<iframe>.
export const attachmentUrl = (attachmentId: number, download = false) =>
  `${API_ROOT}/attachments/${attachmentId}/content${download ? "?download=1" : ""}`;
export const paymentProofUrl = (paymentId: number, download = false) =>
  `${API_ROOT}/payments/${paymentId}/proof${download ? "?download=1" : ""}`;

export const downloadReportPdf = (r: ExpenseReport) => downloadFile(`${BASE}/reports/${r.id}/pdf`, `${r.report_number}.pdf`);
export const downloadReportZip = (r: ExpenseReport) => downloadFile(`${BASE}/reports/${r.id}/export.zip`, `${r.report_number}.zip`);

export const listNotifications = () =>
  api<{ notifications: NotificationEntry[]; unread: number }>(`${BASE}/notifications`);
export const markNotificationsRead = (id?: number) =>
  api<{ ok: boolean }>(`${BASE}/notifications/read`, { method: "POST", ...json(id ? { id } : {}) });

export const listMyHistory = (params: ListParams) =>
  api<{ history: HistoryEntry[]; total: number; page: number; pageSize: number }>(`${BASE}/history${qs(params)}`);

/* ------------------------------- Gestão ------------------------------ */

export const getAdminDashboard = (period: { from?: string; to?: string }) =>
  api<DashboardData>(`${BASE}/admin/dashboard${qs(period)}`);
export const listAllReports = (params: ListParams) => api<ReportList>(`${BASE}/admin/reports${qs(params)}`);

export type Decision = "start-review" | "approve" | "reject" | "return";
export const decide = (id: number, decision: Decision, reason = "") =>
  api<{ report: ExpenseReport }>(`${BASE}/admin/reports/${id}/${decision}`, { method: "POST", ...json({ reason }) });

export const getBankDetails = (id: number) =>
  api<{ bankDetails: ProfileData | null }>(`${BASE}/admin/reports/${id}/bank-details`);

export interface PaymentInput {
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  transactionReference: string;
  notes: string;
  proof?: { name: string; dataBase64: string } | null;
}
export const registerPayment = (id: number, input: PaymentInput) =>
  api<{ report: ExpenseReport }>(`${BASE}/admin/reports/${id}/payment`, { method: "POST", ...json(input) });

export const listPendingReimbursements = (params: ListParams) =>
  api<ReportList>(`${BASE}/admin/reimbursements/pending${qs(params)}`);
export const listPayments = (params: ListParams) =>
  api<{ payments: ExpensePayment[]; total: number; page: number; pageSize: number }>(`${BASE}/admin/payments${qs(params)}`);
export const listAllHistory = (params: ListParams) =>
  api<{ history: HistoryEntry[]; total: number; page: number; pageSize: number }>(`${BASE}/admin/history${qs(params)}`);
export const listAudit = (params: ListParams & { reportId?: number }) =>
  api<{ entries: AuditEntry[]; total: number; page: number; pageSize: number }>(`${BASE}/admin/audit${qs(params)}`);

export const listAllCategories = () => api<{ categories: ExpenseCategory[] }>(`${BASE}/admin/categories`);
export interface CategoryInput { name: string; description: string; active: boolean; sortOrder: number }
export const createCategory = (input: CategoryInput) =>
  api<{ category: ExpenseCategory }>(`${BASE}/admin/categories`, { method: "POST", ...json(input) });
export const updateCategory = (id: number, input: CategoryInput) =>
  api<{ category: ExpenseCategory }>(`${BASE}/admin/categories/${id}`, { method: "PUT", ...json(input) });

/* ------------------------------ Usuários ----------------------------- */

export interface ExpenseUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  status: "invited" | "active" | "disabled";
  isAdmin: boolean;
  isApprover: boolean;
  isFinance: boolean;
  locked: boolean;
  lockedUntil: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserCreateInput {
  username: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  isApprover: boolean;
  isFinance: boolean;
  temporaryPassword: boolean;
}

export interface UserUpdateInput {
  fullName: string;
  email: string;
  status: "active" | "disabled";
  isAdmin: boolean;
  isApprover: boolean;
  isFinance: boolean;
  unlock?: boolean;
}

export const listExpenseUsers = () => api<{ users: ExpenseUser[] }>(`${BASE}/admin/users`);
export const createExpenseUser = (input: UserCreateInput) =>
  api<{ user: ExpenseUser; temporaryPassword: string | null; inviteLink: string | null; inviteError: string | null }>(
    `${BASE}/admin/users`,
    { method: "POST", ...json(input) }
  );
export const updateExpenseUser = (id: string, input: UserUpdateInput) =>
  api<{ user: ExpenseUser }>(`${BASE}/admin/users/${encodeURIComponent(id)}`, { method: "PUT", ...json(input) });
export const deleteExpenseUser = (id: string) =>
  api<{ username: string }>(`${BASE}/admin/users/${encodeURIComponent(id)}`, { method: "DELETE" });
/** Reenvia o convite (pendente) ou envia link de redefinição de senha (ativo). */
export const sendUserAccessLink = (id: string) =>
  api<{ kind: "invite" | "reset"; link: string; emailError: string | null }>(
    `${BASE}/admin/users/${encodeURIComponent(id)}/access-link`,
    { method: "POST" }
  );

/* -------------------------------- Login ------------------------------ */

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  isApprover: boolean;
  isFinance: boolean;
  mustChangePassword: boolean;
}

export async function login(identifier: string, password: string) {
  client.resetCsrf();
  const res = await api<{ user: AuthUser }>(`${BASE}/auth/login`, { method: "POST", ...json({ identifier, password }) });
  client.resetCsrf();
  return res;
}
export async function logout() {
  await api<{ ok: boolean }>(`${BASE}/auth/logout`, { method: "POST" }).catch(() => undefined);
  client.resetCsrf();
}
export const getMe = () => api<{ user: AuthUser }>(`${BASE}/auth/me`);
export const changePassword = (currentPassword: string, newPassword: string) =>
  api<{ user: AuthUser }>(`${BASE}/auth/change-password`, { method: "POST", ...json({ currentPassword, newPassword }) });
export const forgotPassword = (identifier: string) =>
  api<{ ok: boolean }>(`${BASE}/auth/forgot-password`, { method: "POST", ...json({ identifier }) });
export const getTokenInfo = (token: string) =>
  api<{ kind: "invite" | "reset"; username: string; requirements: string }>(`${BASE}/auth/token?token=${encodeURIComponent(token)}`);
export const completeToken = (token: string, newPassword: string) =>
  api<{ username: string }>(`${BASE}/auth/token`, { method: "POST", ...json({ token, newPassword }) });

/* ---------------------------- Configurações -------------------------- */

export interface EmailSettings {
  mode: "platform" | "custom";
  notificationsEnabled: boolean;
  smtp: { host: string; port: number; secure: boolean; user: string; from: string };
  hasPassword: boolean;
}

export interface EmailSettingsInput {
  mode: "platform" | "custom";
  notificationsEnabled: boolean;
  smtp: { host: string; port: number; secure: boolean; user: string; from: string; pass: string };
  clearPassword: boolean;
}

export const getEmailSettings = () => api<{ email: EmailSettings }>(`${BASE}/admin/settings/email`);
export const saveEmailSettings = (input: EmailSettingsInput) =>
  api<{ email: EmailSettings }>(`${BASE}/admin/settings/email`, { method: "PUT", ...json(input) });
export const sendTestEmail = (to: string) =>
  api<{ ok: boolean; mode: string }>(`${BASE}/admin/settings/email/test`, { method: "POST", ...json({ to }) });

// Lê um File como base64 (comprovante de pagamento vai no corpo JSON).
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
