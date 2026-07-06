import { api } from "../client";
import { SgMaintenanceType } from "./programs";

export const CHECKLIST_ITEM_TYPE_OPTIONS = [
  { value: "inspection", label: "Inspecao" },
  { value: "measurement", label: "Medicao" },
  { value: "test", label: "Teste" },
  { value: "safety", label: "Seguranca" },
  { value: "note", label: "Nota" }
] as const;

export type SgChecklistItemType = typeof CHECKLIST_ITEM_TYPE_OPTIONS[number]["value"];

export interface SgChecklistItem {
  id: number;
  checklist_id: number;
  title: string;
  item_type: SgChecklistItemType;
  required: boolean;
  expected_value: string;
  unit: string;
  acceptance_criteria: string;
  order_index: number;
  notes: string;
}

export interface SgChecklist {
  id: number;
  name: string;
  description: string;
  equipment_type_id: number | null;
  equipment_type_name?: string | null;
  manufacturer_id: number | null;
  manufacturer_name?: string | null;
  model_id: number | null;
  model_name?: string | null;
  program_id: number | null;
  program_name?: string | null;
  maintenance_type: SgMaintenanceType;
  active: boolean;
  notes: string;
  items?: SgChecklistItem[];
}

export interface SgChecklistInput {
  name: string;
  description: string;
  equipmentTypeId: number | null;
  manufacturerId: number | null;
  modelId: number | null;
  programId: number | null;
  maintenanceType: SgMaintenanceType;
  active: boolean;
  notes: string;
}

export interface SgChecklistItemInput {
  title: string;
  itemType: SgChecklistItemType;
  required: boolean;
  expectedValue: string;
  unit: string;
  acceptanceCriteria: string;
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

export function listChecklists(params: {
  search?: string;
  equipmentTypeId?: number;
  maintenanceType?: string;
  active?: boolean | null;
  page?: number;
  pageSize?: number;
} = {}) {
  return api<{ checklists: SgChecklist[]; total: number; page: number; pageSize: number }>(`/sentinelgrid/checklists${qs(params)}`);
}

export function getChecklist(id: number) {
  return api<{ checklist: SgChecklist }>(`/sentinelgrid/checklists/${id}`).then((r) => r.checklist);
}

export function createChecklist(input: SgChecklistInput) {
  return api<{ checklist: SgChecklist }>("/sentinelgrid/checklists", { method: "POST", body: JSON.stringify(input) }).then((r) => r.checklist);
}

export function updateChecklist(id: number, input: SgChecklistInput) {
  return api<{ checklist: SgChecklist }>(`/sentinelgrid/checklists/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.checklist);
}

export function deleteChecklist(id: number) {
  return api<void>(`/sentinelgrid/checklists/${id}`, { method: "DELETE" });
}

export function createChecklistItem(checklistId: number, input: SgChecklistItemInput) {
  return api<{ item: SgChecklistItem }>(`/sentinelgrid/checklists/${checklistId}/items`, { method: "POST", body: JSON.stringify(input) }).then((r) => r.item);
}

export function updateChecklistItem(checklistId: number, itemId: number, input: SgChecklistItemInput) {
  return api<{ item: SgChecklistItem }>(`/sentinelgrid/checklists/${checklistId}/items/${itemId}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.item);
}

export function deleteChecklistItem(checklistId: number, itemId: number) {
  return api<void>(`/sentinelgrid/checklists/${checklistId}/items/${itemId}`, { method: "DELETE" });
}
