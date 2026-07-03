import { api } from "../client";
import type { SgMaintenanceType, SgPeriodicity } from "./programs";

export interface SgPlanItem {
  id: number;
  plan_id: number;
  title: string;
  maintenance_type: SgMaintenanceType;
  periodicity: SgPeriodicity;
  next_due_date: string | null;
  order_index: number;
  notes: string;
}

export interface SgEquipmentPlan {
  id: number;
  equipment_id: number;
  equipment_tag?: string;
  equipment_serial_number?: string;
  client_name?: string;
  site_name?: string;
  area_name?: string;
  program_id: number | null;
  program_name?: string | null;
  name: string;
  maintenance_type: SgMaintenanceType;
  periodicity: SgPeriodicity;
  adjustments: Record<string, unknown>;
  active: boolean;
  notes: string;
  items?: SgPlanItem[];
  created_at: string;
  updated_at: string;
}

export interface SgEquipmentPlanInput {
  equipmentId: number;
  programId: number | null;
  name: string;
  maintenanceType: SgMaintenanceType;
  periodicity: SgPeriodicity;
  adjustments: Record<string, unknown>;
  active: boolean;
  notes: string;
  initialNextDueDate: string | null;
}

export interface SgPlanItemInput {
  title: string;
  maintenanceType: SgMaintenanceType;
  periodicity: SgPeriodicity;
  nextDueDate: string | null;
  orderIndex: number;
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

export function listEquipmentPlans(params: { equipmentId?: number; clientId?: number; active?: boolean | null; search?: string } = {}) {
  return api<{ plans: SgEquipmentPlan[]; total: number }>(`/sentinelgrid/equipment-plans${qs(params)}`);
}

export function getEquipmentPlan(id: number) {
  return api<{ plan: SgEquipmentPlan }>(`/sentinelgrid/equipment-plans/${id}`).then((r) => r.plan);
}

export function createEquipmentPlan(input: SgEquipmentPlanInput) {
  return api<{ plan: SgEquipmentPlan }>("/sentinelgrid/equipment-plans", { method: "POST", body: JSON.stringify(input) }).then((r) => r.plan);
}

export function updateEquipmentPlan(id: number, input: SgEquipmentPlanInput) {
  return api<{ plan: SgEquipmentPlan }>(`/sentinelgrid/equipment-plans/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.plan);
}

export function deleteEquipmentPlan(id: number) {
  return api<void>(`/sentinelgrid/equipment-plans/${id}`, { method: "DELETE" });
}

export function createPlanItem(planId: number, input: SgPlanItemInput) {
  return api<{ item: SgPlanItem }>(`/sentinelgrid/equipment-plans/${planId}/items`, { method: "POST", body: JSON.stringify(input) }).then((r) => r.item);
}

export function updatePlanItem(planId: number, itemId: number, input: SgPlanItemInput) {
  return api<{ item: SgPlanItem }>(`/sentinelgrid/equipment-plans/${planId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.item);
}

export function deletePlanItem(planId: number, itemId: number) {
  return api<void>(`/sentinelgrid/equipment-plans/${planId}/items/${itemId}`, { method: "DELETE" });
}
