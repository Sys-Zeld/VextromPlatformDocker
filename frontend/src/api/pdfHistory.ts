import { api } from "./client";

export interface PdfHistoryEntry {
  id: number;
  service_order_id: number;
  original_name?: string | null;
  file_name?: string | null;
  status?: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface Signature {
  id: number;
  signer_name?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

export interface PdfHistoryPayload {
  order: { id: number; service_order_code?: string | null; title?: string | null };
  report: { id: number };
  pdfHistory: PdfHistoryEntry[];
  signatures: Signature[];
}

export function listPdfHistory(orderId: number) {
  return api<PdfHistoryPayload>(`/orders/${orderId}/pdf-history`);
}

export function deletePdfHistory(orderId: number, entryId: number) {
  return api<void>(`/orders/${orderId}/pdf-history/${entryId}`, { method: "DELETE" });
}

// Download usa a rota legada (mesmo cookie de sessão), aberta em nova aba.
export function pdfHistoryDownloadUrl(orderId: number, entryId: number) {
  return `/admin/report-service/orders/${orderId}/pdf-history/${entryId}/download`;
}
