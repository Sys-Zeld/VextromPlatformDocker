import { api } from "../client";

export const CRITICALITY_OPTIONS = [
  { value: "baixa", label: "Baixa", variant: "secondary" },
  { value: "media", label: "Media", variant: "info" },
  { value: "alta", label: "Alta", variant: "warning" },
  { value: "missao_critica", label: "Missao critica", variant: "danger" }
] as const;

export const MAINTENANCE_TYPE_OPTIONS = [
  { value: "preventiva_sem_parada", label: "Preventiva sem parada" },
  { value: "preventiva_com_parada", label: "Preventiva com parada" },
  { value: "corretiva", label: "Corretiva" }
] as const;

export const PERIODICITY_OPTIONS = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "bienal", label: "Bienal" },
  { value: "personalizada", label: "Personalizada" }
] as const;

export type SgCriticality = typeof CRITICALITY_OPTIONS[number]["value"];
export type SgMaintenanceType = typeof MAINTENANCE_TYPE_OPTIONS[number]["value"];
export type SgPeriodicity = typeof PERIODICITY_OPTIONS[number]["value"];

export interface SgMaintenanceProgram {
  id: number;
  name: string;
  description: string;
  equipment_type_id: number | null;
  equipment_type_name?: string | null;
  manufacturer_id: number | null;
  manufacturer_name?: string | null;
  model_id: number | null;
  model_name?: string | null;
  contract_id: number | null;
  contract_name?: string | null;
  contract_client_name?: string | null;
  criticality: SgCriticality | null;
  maintenance_type: SgMaintenanceType;
  periodicity: SgPeriodicity;
  active: boolean;
  scope_notes: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgMaintenanceProgramInput {
  name: string;
  description: string;
  equipmentTypeId: number | null;
  manufacturerId: number | null;
  modelId: number | null;
  contractId: number | null;
  criticality: SgCriticality | null;
  maintenanceType: SgMaintenanceType;
  periodicity: SgPeriodicity;
  active: boolean;
  scopeNotes: string;
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

export function listMaintenancePrograms(params: {
  search?: string;
  equipmentTypeId?: number;
  criticality?: string;
  maintenanceType?: string;
  active?: boolean | null;
} = {}) {
  return api<{ programs: SgMaintenanceProgram[]; total: number }>(`/sentinelgrid/maintenance-programs${qs(params)}`);
}

export function createMaintenanceProgram(input: SgMaintenanceProgramInput) {
  return api<{ program: SgMaintenanceProgram }>("/sentinelgrid/maintenance-programs", { method: "POST", body: JSON.stringify(input) }).then((r) => r.program);
}

export function updateMaintenanceProgram(id: number, input: SgMaintenanceProgramInput) {
  return api<{ program: SgMaintenanceProgram }>(`/sentinelgrid/maintenance-programs/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.program);
}

export function deleteMaintenanceProgram(id: number) {
  return api<void>(`/sentinelgrid/maintenance-programs/${id}`, { method: "DELETE" });
}
