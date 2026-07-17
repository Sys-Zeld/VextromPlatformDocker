import { api, API_BASE } from "./client";
import type { Order } from "./orders";

export interface ReportSection {
  section_key: string;
  section_title: string | null;
  section_title_html: string | null;
  section_title_text: string | null;
  content_html: string | null;
  content_text: string | null;
  is_visible: boolean;
  sort_order: number | null;
}

export interface ReportImage {
  id: number;
  ref_id?: number;
  file_path: string | null;
  caption: string | null;
  rotation: number | null;
  section_key?: string | null;
  sort_order?: number | null;
}

export interface ReportTemplateOption { key: string; name: string }

export interface SignRequest {
  id: number;
  token: string;
  signer_name: string | null;
  signer_email: string | null;
  signer_role: string | null;
  signer_company: string | null;
  status: string;
  notes: string | null;
  expires_at: string | null;
  updated_at: string | null;
}

export interface Signature {
  id: number;
  signer_type: string | null;
  signer_name: string | null;
  signer_role: string | null;
  signer_company: string | null;
  created_at: string | null;
}

export interface SignRequestGuard {
  allowed: boolean;
  hasValidOrder: boolean;
  hasVextromSignature: boolean;
  reasons: string[];
}

export interface SignRequestInput {
  signerName: string;
  signerRole: string;
  signerCompany: string;
  signerEmail: string;
  notes: string;
  notifyTechnicians?: boolean;
  notificationEmails?: string;
}

export interface ReportEditorPayload {
  order: Order & { service_order_code?: string | null; service_order_display?: string | null };
  report: { id: number; status?: string | null };
  sections: ReportSection[];
  images: ReportImage[];
  locked: boolean;
  reportTemplates: ReportTemplateOption[];
  templateKey: string;
  signatures: Signature[];
  signRequests: SignRequest[];
  signRequestGuard: SignRequestGuard;
  reportLanguages: ReportLanguage[];
  reportLanguage: string;
}

export interface ReportLanguage { key: string; label: string }
export interface TranslateJob {
  ok: boolean;
  jobId: string;
  targetLanguage: string;
  status: "queued" | "running" | "completed" | "failed" | string;
  progress: number;
  message?: string;
  error?: string;
}

export interface SectionSaveInput {
  sectionTitleHtml: string;
  sectionTitleText: string;
  contentHtml: string;
  contentText: string;
  isVisible: boolean;
}

export function getReportEditor(id: number) {
  return api<ReportEditorPayload>(`/orders/${id}/report-editor`);
}

// URL (same-origin/proxied) para abrir o preview em nova janela — devolve HTML puro.
export function reportPreviewHtmlUrl(id: number, templateKey: string): string {
  return `${API_BASE}/orders/${id}/preview-html?templateKey=${encodeURIComponent(templateKey)}&format=html`;
}

export function createSection(id: number, input: { sectionTitle: string; insertAfter: string }) {
  return api<{ ok: boolean }>(`/orders/${id}/sections`, { method: "POST", body: JSON.stringify(input) });
}

export function saveSection(id: number, sectionKey: string, input: SectionSaveInput) {
  return api<{ ok: boolean }>(`/orders/${id}/sections/${encodeURIComponent(sectionKey)}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteSection(id: number, sectionKey: string) {
  return api<void>(`/orders/${id}/sections/${encodeURIComponent(sectionKey)}`, { method: "DELETE" });
}

export function reorderSections(id: number, sectionKeys: string[], tocTablesConfig?: Record<string, boolean>) {
  return api<{ ok: boolean }>(`/orders/${id}/sections/reorder`, {
    method: "POST",
    body: JSON.stringify(tocTablesConfig ? { sectionKeys, tocTablesConfig } : { sectionKeys })
  });
}

// ---- Sumário: tabelas por capítulo (TOC) --------------------------------
export interface TocTable {
  anchorId: string;
  configKey: string;
  tableType: string;
  itemId: number | null;
  title: string | null;
  label: string | null;
  visible: boolean;
}
export interface TocSection {
  sectionKey: string;
  tables: TocTable[];
}
export interface TableNameChange { type: string; id: number; title: string }

export function getTocTables(id: number) {
  return api<{ ok: boolean; sections: TocSection[] }>(`/orders/${id}/toc-tables`);
}
export function renameTocTables(id: number, tableNames: TableNameChange[]) {
  return api<{ ok: boolean }>(`/orders/${id}/toc-tables/rename`, { method: "POST", body: JSON.stringify({ tableNames }) });
}

// ---- Banco de imagens (@img) --------------------------------------------
export function imageFileName(filePath: string | null): string {
  return String(filePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
}
export function reportImageUrl(filePath: string | null): string {
  return `/docs/report/img/${encodeURIComponent(imageFileName(filePath))}`;
}
export function uploadReportImage(id: number, file: File, caption: string) {
  return api<{ ok: boolean; data?: { id: number }; error?: string }>(`/orders/${id}/images`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-Caption": encodeURIComponent(caption.trim())
    },
    body: file
  });
}
export function updateImageCaption(id: number, imageId: number, caption: string) {
  return api<{ ok: boolean }>(`/orders/${id}/images/${imageId}/caption`, { method: "PUT", body: JSON.stringify({ caption }) });
}
export function updateImageRotation(id: number, imageId: number, rotation: number) {
  return api<{ ok: boolean; rotation: number }>(`/orders/${id}/images/${imageId}/rotation`, { method: "PUT", body: JSON.stringify({ rotation }) });
}
export function deleteImage(id: number, imageId: number) {
  return api<void>(`/orders/${id}/images/${imageId}`, { method: "DELETE" });
}

// ---- Tradução do relatório (job assíncrono com progresso) ---------------
export function startTranslateReport(id: number, targetLanguage: string) {
  return api<TranslateJob>(`/orders/${id}/translate/start`, { method: "POST", body: JSON.stringify({ target_language: targetLanguage }) });
}
export function getTranslateJob(id: number, jobId: string) {
  return api<TranslateJob>(`/orders/${id}/translate/jobs/${encodeURIComponent(jobId)}`);
}

// ---- Assinatura do técnico Vextrom (tela de assinar) --------------------
export interface SignReportTechnician { id: number; name: string; role: string | null; company: string | null }
export interface SignReportSignature { id: number; signer_name: string | null; signer_role: string | null; signed_at: string | null }
export interface SignReportPayload {
  order: Order & { service_order_code?: string | null; service_order_display?: string | null; title?: string | null; customer_name?: string | null; status?: string | null };
  report: { id: number };
  technicians: SignReportTechnician[];
  signatures: SignReportSignature[];
  canSign: boolean;
}

export function getSignReport(id: number) {
  return api<SignReportPayload>(`/orders/${id}/sign-report`);
}
export function createTechnicianSignature(id: number, input: { signatureData: string; signerName: string; signerRole: string; signerCompany: string }) {
  return api<{ ok: boolean }>(`/orders/${id}/sign-report`, { method: "POST", body: JSON.stringify(input) });
}
export function deleteSignature(id: number, signatureId: number) {
  return api<void>(`/orders/${id}/signatures/${signatureId}`, { method: "DELETE" });
}

// ---- Assinatura eletrônica: links (sign-requests) -----------------------
export function createSignRequest(id: number, input: SignRequestInput) {
  return api<{ ok: boolean; link: string; emailStatus: string }>(`/orders/${id}/sign-requests`, { method: "POST", body: JSON.stringify(input) });
}
export function updateSignRequest(id: number, requestId: number, input: Omit<SignRequestInput, "notifyTechnicians" | "notificationEmails">) {
  return api<{ ok: boolean }>(`/orders/${id}/sign-requests/${requestId}`, { method: "PUT", body: JSON.stringify(input) });
}
export function cancelSignRequest(id: number, requestId: number) {
  return api<{ ok: boolean }>(`/orders/${id}/sign-requests/${requestId}/cancel`, { method: "POST", body: JSON.stringify({}) });
}
export function deleteSignRequest(id: number, requestId: number) {
  return api<void>(`/orders/${id}/sign-requests/${requestId}`, { method: "DELETE" });
}

export function reviseSectionText(id: number, body: { text: string; html: string; prompt?: string; preserveFormatting?: boolean }) {
  return api<{ ok: boolean; revisedText: string; revisedHtml: string }>(`/orders/${id}/sections/revise-text`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}
