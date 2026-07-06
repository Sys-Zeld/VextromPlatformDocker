import { api } from "../client";
import type { SgMaintenanceType } from "./programs";

export const ORDER_STATUS_OPTIONS = [
  { value: "planejada", label: "Planejada", variant: "secondary" },
  { value: "agendada", label: "Agendada", variant: "info" },
  { value: "aguardando_aprovacao", label: "Aguardando aprovacao", variant: "warning" },
  { value: "aprovada", label: "Aprovada", variant: "primary" },
  { value: "em_execucao", label: "Em execucao", variant: "primary" },
  { value: "concluida", label: "Concluida", variant: "success" },
  { value: "concluida_com_pendencias", label: "Concluida com pendencias", variant: "warning" },
  { value: "reprogramada", label: "Reprogramada", variant: "info" },
  { value: "cancelada", label: "Cancelada", variant: "dark" },
  { value: "emergencial", label: "Emergencial", variant: "danger" }
] as const;

export const CORRECTIVE_CLASS_OPTIONS = [
  { value: "emergencial", label: "Emergencial" },
  { value: "urgente", label: "Urgente" },
  { value: "programada", label: "Programada" },
  { value: "paliativa", label: "Paliativa" },
  { value: "definitiva", label: "Definitiva" }
] as const;

export type SgOrderStatus = typeof ORDER_STATUS_OPTIONS[number]["value"];
export type SgCorrectiveClass = typeof CORRECTIVE_CLASS_OPTIONS[number]["value"];

export interface SgCorrectiveDetails {
  symptom: string;
  alarm: string;
  operational_impact: string;
  probable_cause: string;
  root_cause: string;
  action_taken: string;
  urgency: string;
  corrective_class: SgCorrectiveClass;
}

export interface SgCorrectiveDetailsInput {
  symptom: string;
  alarm: string;
  operationalImpact: string;
  probableCause: string;
  rootCause: string;
  actionTaken: string;
  urgency: string;
  correctiveClass: SgCorrectiveClass;
}

export interface SgOrderApproval {
  id: number;
  order_id: number;
  client_manager_id: number | null;
  client_manager_name?: string | null;
  approver_name: string;
  approved_at: string | null;
  authorized_window: string;
  restrictions: string;
  release_condition: string;
  final_accept: boolean;
  notes: string;
}

export interface SgOrderApprovalInput {
  clientManagerId: number | null;
  approverName: string;
  approvedAt: string | null;
  authorizedWindow: string;
  restrictions: string;
  releaseCondition: string;
  finalAccept: boolean;
  notes: string;
}

export interface SgMaintenanceOrder {
  id: number;
  order_number: string;
  equipment_id: number;
  equipment_tag?: string;
  equipment_serial_number?: string;
  client_id: number;
  client_name?: string;
  site_id: number;
  site_name?: string;
  area_id: number;
  area_name?: string;
  plan_id: number | null;
  plan_name?: string | null;
  plan_item_id: number | null;
  plan_item_title?: string | null;
  checklist_id: number | null;
  checklist_name?: string | null;
  maintenance_type: SgMaintenanceType;
  status: SgOrderStatus;
  priority: string;
  planned_date: string | null;
  scheduled_date: string | null;
  executed_date: string | null;
  technician_id: string;
  client_manager_id: number | null;
  client_manager_name?: string | null;
  scope: string;
  final_condition: string;
  notes: string;
  corrective_details?: SgCorrectiveDetails | null;
  approvals?: SgOrderApproval[];
  created_at: string;
  updated_at: string;
}

export interface SgMaintenanceOrderInput {
  equipmentId: number;
  planId: number | null;
  planItemId: number | null;
  checklistId: number | null;
  maintenanceType: SgMaintenanceType;
  status?: SgOrderStatus;
  priority: string;
  plannedDate: string | null;
  scheduledDate: string | null;
  executedDate: string | null;
  technicianId: string;
  clientManagerId: number | null;
  scope: string;
  finalCondition: string;
  notes: string;
  correctiveDetails: SgCorrectiveDetailsInput | null;
}

export interface SgOrderFromPlanInput {
  planId: number;
  planItemId: number | null;
  checklistId: number | null;
  priority: string;
  plannedDate: string | null;
  scheduledDate: string | null;
  technicianId: string;
  clientManagerId: number | null;
  scope: string;
  notes: string;
}

export interface SgOrderStatusInput {
  status: SgOrderStatus;
  finalCondition: string;
  notes: string;
}

function qs(params: Record<string, string | number | boolean | null | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== 0) q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listMaintenanceOrders(params: {
  search?: string;
  equipmentId?: number;
  clientId?: number;
  status?: string;
  maintenanceType?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return api<{ orders: SgMaintenanceOrder[]; total: number; page: number; pageSize: number }>(`/sentinelgrid/maintenance-orders${qs(params)}`);
}

export function getMaintenanceOrder(id: number) {
  return api<{ order: SgMaintenanceOrder }>(`/sentinelgrid/maintenance-orders/${id}`).then((r) => r.order);
}

export function createMaintenanceOrder(input: SgMaintenanceOrderInput) {
  return api<{ order: SgMaintenanceOrder }>("/sentinelgrid/maintenance-orders", { method: "POST", body: JSON.stringify(input) }).then((r) => r.order);
}

export function createMaintenanceOrderFromPlan(input: SgOrderFromPlanInput) {
  return api<{ order: SgMaintenanceOrder }>("/sentinelgrid/maintenance-orders/from-plan", { method: "POST", body: JSON.stringify(input) }).then((r) => r.order);
}

export interface SgOrdersFromPlansInput {
  planIds: number[];
  checklistId?: number | null;
  priority?: string;
  scheduledDate?: string | null;
  technicianId?: string;
  clientManagerId?: number | null;
  notes?: string;
  skipExisting?: boolean;
}

export interface SgOrdersFromPlansResult {
  created: number;
  skipped: number;
  plans: number;
  orderIds: number[];
}

// Geração em lote: cria OMs para todos os itens dos planos informados.
export function createMaintenanceOrdersFromPlans(input: SgOrdersFromPlansInput) {
  return api<SgOrdersFromPlansResult>("/sentinelgrid/maintenance-orders/from-plans", { method: "POST", body: JSON.stringify(input) });
}

// Fase 11 — envia a OM (agendada) para o Service Report, criando/reabrindo uma OS.
export interface SendToReportServiceResult {
  rsOrderId: number;
  rsOrderCode: string;
  reused: boolean;
}

export function sendOrderToReportService(orderId: number) {
  return api<SendToReportServiceResult>(
    `/sentinelgrid/maintenance-orders/${orderId}/send-to-report-service`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export function updateMaintenanceOrder(id: number, input: SgMaintenanceOrderInput) {
  return api<{ order: SgMaintenanceOrder }>(`/sentinelgrid/maintenance-orders/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.order);
}

export function deleteMaintenanceOrder(id: number) {
  return api<void>(`/sentinelgrid/maintenance-orders/${id}`, { method: "DELETE" });
}

export function transitionMaintenanceOrderStatus(id: number, input: SgOrderStatusInput) {
  return api<{ order: SgMaintenanceOrder }>(`/sentinelgrid/maintenance-orders/${id}/status`, { method: "POST", body: JSON.stringify(input) }).then((r) => r.order);
}

export function createOrderApproval(id: number, input: SgOrderApprovalInput) {
  return api<{ approval: SgOrderApproval; order: SgMaintenanceOrder }>(`/sentinelgrid/maintenance-orders/${id}/approvals`, { method: "POST", body: JSON.stringify(input) });
}
