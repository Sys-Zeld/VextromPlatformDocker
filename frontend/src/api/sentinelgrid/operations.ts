import { api } from "../client";

export interface SgMeasurementInput {
  orderId: number;
  technicianId: string;
  measuredAt: string | null;
  metric: string;
  value: string;
  unit: string;
  notes: string;
}

export interface SgPartInput {
  orderId: number;
  partDescription: string;
  partCode: string;
  manufacturer: string;
  quantity: number;
  reason: string;
  removedCondition: string;
  newPartInstalled: boolean;
  evidence: string;
}

export interface SgReportInput {
  orderId: number;
  reportCode: string;
  title: string;
  issuedAt: string | null;
  technician: string;
  reportType: string;
  fileRef: string;
  externalLink: string;
  externalId: string;
  notes: string;
}

export interface SgEventInput {
  equipmentId: number;
  generatedOrderId: number | null;
  eventType: string;
  severity: string;
  occurredAt: string | null;
  description: string;
  actionTaken: string;
}

export interface SgRecommendation {
  id: number;
  equipment_id: number;
  order_id: number | null;
  report_id: number | null;
  equipment_tag?: string;
  order_number?: string;
  report_code?: string;
  description: string;
  technical_reason: string;
  criticality: string;
  due_date: string | null;
  responsible: string;
  status: string;
  evidence: string;
  notes: string;
  created_at: string;
}

export interface SgRecommendationInput {
  equipmentId: number;
  orderId: number | null;
  reportId: number | null;
  description: string;
  technicalReason: string;
  criticality: string;
  dueDate: string | null;
  responsible: string;
  status: string;
  evidence: string;
  notes: string;
}

export interface SgCalendarEntry {
  id: number;
  equipment_id: number;
  equipment_tag?: string;
  client_name?: string;
  site_name?: string;
  plan_item_id: number | null;
  year: number;
  month: number;
  maintenance_type: string;
  planned_date: string;
  status: string;
}

export interface SgHistoryEntry {
  id: number;
  equipment_id: number;
  equipment_tag?: string;
  client_name?: string;
  event_kind: string;
  ref_table: string;
  ref_id: number | null;
  occurred_at: string;
  summary: string;
  actor: string;
}

export interface SgDashboard {
  equipment: number;
  orders: { total: number; done: number; corrective: number };
  overdue: number;
  equipmentWithoutPlan: number;
  events: number;
  associatedReports: number;
  recommendations: { total: number; open: number; critical: number };
}

function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== 0) q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function createMeasurement(input: SgMeasurementInput) {
  return api<{ measurement: unknown }>("/sentinelgrid/measurements", { method: "POST", body: JSON.stringify(input) });
}

export function createPart(input: SgPartInput) {
  return api<{ part: unknown }>("/sentinelgrid/parts", { method: "POST", body: JSON.stringify(input) });
}

export function createAssociatedReport(input: SgReportInput) {
  return api<{ report: unknown }>("/sentinelgrid/reports", { method: "POST", body: JSON.stringify(input) });
}

export function createEvent(input: SgEventInput) {
  return api<{ event: unknown }>("/sentinelgrid/events", { method: "POST", body: JSON.stringify(input) });
}

export function listRecommendations(params: { equipmentId?: number; orderId?: number; status?: string } = {}) {
  return api<{ recommendations: SgRecommendation[] }>(`/sentinelgrid/recommendations${qs(params)}`);
}

export function createRecommendation(input: SgRecommendationInput) {
  return api<{ recommendation: SgRecommendation }>("/sentinelgrid/recommendations", { method: "POST", body: JSON.stringify(input) });
}

export function updateRecommendationStatus(id: number, input: { status: string; notes: string }) {
  return api<{ recommendation: SgRecommendation }>(`/sentinelgrid/recommendations/${id}/status`, { method: "PUT", body: JSON.stringify(input) });
}

export function createAttachment(input: { entityType: "equipment" | "order" | "recommendation" | "report" | "event"; entityId: number; fileRef: string; kind: string; label: string; notes: string }) {
  return api<{ attachment: unknown }>("/sentinelgrid/attachments", { method: "POST", body: JSON.stringify(input) });
}

export function listCalendar(params: { year?: number; month?: number; equipmentId?: number } = {}) {
  return api<{ entries: SgCalendarEntry[] }>(`/sentinelgrid/calendar${qs(params)}`);
}

export function generateCalendar(input: { year: number; equipmentId: number | null }) {
  return api<{ inserted: number; scanned: number }>("/sentinelgrid/calendar/generate", { method: "POST", body: JSON.stringify(input) });
}

export function listHistory(params: { equipmentId?: number } = {}) {
  return api<{ history: SgHistoryEntry[] }>(`/sentinelgrid/history${qs(params)}`);
}

export function getDashboard(params: { clientId?: number } = {}) {
  return api<SgDashboard>(`/sentinelgrid/dashboard${qs(params)}`);
}
