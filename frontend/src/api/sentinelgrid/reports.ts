import { api, downloadFile } from "../client";

// Relatórios gerenciais do SentinelGrid. Os três relatórios compartilham o mesmo
// formato de documento — por isso uma única tipagem e um único componente de tela.

export type SgReportKind = "equipment-schedule" | "technician-orders" | "client-schedule";
export type SgReportFormat = "xlsx" | "csv" | "pdf";

export interface SgReportColumn {
  key: string;
  label: string;
  from: string;
  to: string;
}

export interface SgReportTask {
  key: string;
  orderId: number;
  orderNumber: string;
  startDate: string;
  endDate: string;
  status: string;
  statusLabel: string;
  priority: string;
  maintenanceType: string;
  maintenanceTypeLabel: string;
  executionDays: number;
  equipmentTag: string | null;
  clientName: string | null;
  siteName: string | null;
  technicianName: string | null;
  planName: string | null;
  label: string;
}

export interface SgReportSummary {
  total: number;
  concluidas: number;
  pendentes: number;
  atrasadas: number;
  canceladas: number;
  dias: number;
  conclusaoRate: number | null;
}

export interface SgReportRow {
  key: string;
  title: string;
  subtitle: string;
  tasks: SgReportTask[];
  summary: SgReportSummary;
}

export interface SgReportPeriod {
  year: number;
  month: number | null;
  granularity: "month" | "day";
  from: string;
  to: string;
  label: string;
}

export interface SgReportDocument {
  key: SgReportKind;
  title: string;
  groupLabel: string;
  subtitle: string;
  period: SgReportPeriod;
  columns: SgReportColumn[];
  rows: SgReportRow[];
  totals: SgReportSummary & { linhas: number };
  generatedAt: string;
}

export interface SgReportFilters {
  year?: number;
  month?: number | null;
  clientId?: number | "";
  siteId?: number | "";
  equipmentId?: number | "";
  technicianId?: number | "";
  status?: string;
  maintenanceType?: string;
  includeCancelled?: boolean;
}

function qs(filters: SgReportFilters, extra: Record<string, string> = {}) {
  const q = new URLSearchParams(extra);
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) return;
    q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function getReport(kind: SgReportKind, filters: SgReportFilters) {
  return api<SgReportDocument>(`/sentinelgrid/reports/${kind}${qs(filters)}`);
}

export function exportReport(kind: SgReportKind, filters: SgReportFilters, format: SgReportFormat) {
  const period = filters.month ? `${filters.year}-${String(filters.month).padStart(2, "0")}` : String(filters.year);
  return downloadFile(
    `/sentinelgrid/reports/${kind}${qs(filters, { format })}`,
    `${kind}-${period}.${format}`
  );
}
