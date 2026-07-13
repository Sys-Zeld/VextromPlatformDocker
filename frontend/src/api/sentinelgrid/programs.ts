import { api, API_BASE } from "../client";

export const CRITICALITY_OPTIONS = [
  { value: "baixa", label: "Baixa", variant: "secondary" },
  { value: "media", label: "Media", variant: "info" },
  { value: "alta", label: "Alta", variant: "warning" },
  { value: "missao_critica", label: "Missao critica", variant: "danger" }
] as const;

export const MAINTENANCE_TYPE_OPTIONS = [
  { value: "preventiva_sem_parada", label: "Preventiva sem parada" },
  { value: "preventiva_com_parada", label: "Preventiva com parada" },
  { value: "corretiva", label: "Corretiva" },
  { value: "comissionamento", label: "Comissionamento" },
  { value: "teste_bateria", label: "Teste de bateria" },
  { value: "retrofit", label: "Retrofit" }
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
  contract_client_id?: number | null;
  contract_client_name?: string | null;
  contract_valid_from?: string | null;
  contract_valid_to?: string | null;
  criticality: SgCriticality | null;
  maintenance_type: SgMaintenanceType;
  periodicity: SgPeriodicity;
  plan_intervals_months: number[];
  checklist_ids?: number[];
  checklist_names?: string[];
  manual_original_name?: string | null;
  manual_mime_type?: string | null;
  manual_file_size?: number | null;
  nameplate_original_name?: string | null;
  nameplate_mime_type?: string | null;
  nameplate_file_size?: number | null;
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
  planIntervalsMonths: number[];
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
  page?: number;
  pageSize?: number;
} = {}) {
  return api<{ programs: SgMaintenanceProgram[]; total: number; page: number; pageSize: number }>(`/sentinelgrid/maintenance-programs${qs(params)}`);
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

export function uploadProgramDocument(id: number, kind: "manual" | "nameplate", file: File) {
  return api<{ program: SgMaintenanceProgram }>(`/sentinelgrid/maintenance-programs/${id}/${kind}`, {
    method: "PUT",
    headers: { "Content-Type": file.type, "X-File-Name": encodeURIComponent(file.name) },
    body: file
  }).then((r) => r.program);
}

export function programDocumentUrl(id: number, kind: "manual" | "nameplate") {
  return `${API_BASE}/sentinelgrid/maintenance-programs/${id}/documents/${kind}`;
}

export function updateProgramAssets(id: number, checklistIds: number[]) {
  return api<{ program: SgMaintenanceProgram }>(`/sentinelgrid/maintenance-programs/${id}/assets`, {
    method: "PUT",
    body: JSON.stringify({ checklistIds })
  }).then((r) => r.program);
}

// Gerar Planos a partir do programa (escopo + datas por periodicidade).
export interface SgScopeEquipment {
  id: number;
  tag: string;
  serial_number: string;
  client_id: number;
  client_name?: string;
  site_name?: string;
  area_name?: string;
  criticality: string;
  equipment_type_name?: string | null;
}

export function listProgramScopeEquipment(programId: number) {
  return api<{ equipment: SgScopeEquipment[]; total: number }>(`/sentinelgrid/maintenance-programs/${programId}/scope-equipment`);
}

export interface GeneratePlanSpec {
  intervalMonths: number;
  dates: string[];
}

export function generatePlansFromProgram(programId: number, input: { equipmentIds: number[]; plans: GeneratePlanSpec[] }) {
  return api<{ program: string; createdPlans: number; createdItems: number; planIds: number[] }>(
    `/sentinelgrid/maintenance-programs/${programId}/generate-plans`,
    { method: "POST", body: JSON.stringify(input) }
  );
}

// Periodicidade base → intervalo em meses (fallback quando o programa não tem intervalos).
export function periodicityToMonths(p: string): number {
  return PERIODICITY_MONTHS[p] ?? 0;
}

// Meses por periodicidade (0 = personalizada → só a data inicial).
export const PERIODICITY_MONTHS: Record<string, number> = {
  mensal: 1, trimestral: 3, semestral: 6, anual: 12, bienal: 24, personalizada: 0
};
