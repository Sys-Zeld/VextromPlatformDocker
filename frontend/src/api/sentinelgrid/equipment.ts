import { api } from "../client";

export const CRITICALITY: { value: string; label: string; variant: string }[] = [
  { value: "baixa", label: "Baixa", variant: "secondary" },
  { value: "media", label: "Média", variant: "info" },
  { value: "alta", label: "Alta", variant: "warning" },
  { value: "missao_critica", label: "Missão crítica", variant: "danger" }
];

export const OPERATIONAL_STATUS: { value: string; label: string; variant: string }[] = [
  { value: "operacional_normal", label: "Operacional normal", variant: "success" },
  { value: "operacional_restricao", label: "Operacional c/ restrição", variant: "warning" },
  { value: "em_observacao", label: "Em observação", variant: "info" },
  { value: "em_manutencao", label: "Em manutenção", variant: "primary" },
  { value: "indisponivel", label: "Indisponível", variant: "danger" },
  { value: "desativado", label: "Desativado", variant: "secondary" },
  { value: "substituido", label: "Substituído", variant: "dark" }
];

export function criticalityMeta(v: string) {
  return CRITICALITY.find((c) => c.value === v) || { value: v, label: v, variant: "secondary" };
}
export function statusMeta(v: string) {
  return OPERATIONAL_STATUS.find((s) => s.value === v) || { value: v, label: v, variant: "secondary" };
}

export interface SgEquipment {
  id: number;
  client_id: number;
  site_id: number;
  area_id: number;
  client_name?: string;
  site_name?: string;
  area_name?: string;
  tag: string;
  equipment_type_id: number | null;
  equipment_type_name?: string | null;
  manufacturer_id: number | null;
  manufacturer_name?: string | null;
  model_id: number | null;
  model_name?: string | null;
  serial_number: string;
  rated_power: string;
  input_voltage: string;
  output_voltage: string;
  dc_voltage: string;
  frequency: string;
  redundancy_config: string;
  module_count: number | null;
  battery_type: string;
  install_date: string | null;
  commission_date: string | null;
  criticality: string;
  operational_status: string;
  internal_technician: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgEquipmentInput {
  areaId: number;
  tag: string;
  equipmentTypeId: number | null;
  manufacturerId: number | null;
  modelId: number | null;
  serialNumber: string;
  ratedPower: string;
  inputVoltage: string;
  outputVoltage: string;
  dcVoltage: string;
  frequency: string;
  redundancyConfig: string;
  moduleCount: number | null;
  batteryType: string;
  installDate: string;
  commissionDate: string;
  criticality: string;
  operationalStatus: string;
  internalTechnician: string;
  notes: string;
}

export interface EquipmentListResult {
  equipment: SgEquipment[];
  total: number;
  page: number;
  pageSize: number;
}

export function listEquipment(params: { clientId?: number; criticality?: string; operationalStatus?: string; search?: string; page?: number; pageSize?: number } = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== 0) q.set(k, String(v));
  });
  const qs = q.toString();
  return api<EquipmentListResult>(`/sentinelgrid/equipment${qs ? `?${qs}` : ""}`);
}

export function createEquipment(input: SgEquipmentInput) {
  return api<{ equipment: SgEquipment }>("/sentinelgrid/equipment", { method: "POST", body: JSON.stringify(input) }).then((r) => r.equipment);
}
export function updateEquipment(id: number, input: SgEquipmentInput) {
  return api<{ equipment: SgEquipment }>(`/sentinelgrid/equipment/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.equipment);
}
export function deleteEquipment(id: number) {
  return api<void>(`/sentinelgrid/equipment/${id}`, { method: "DELETE" });
}
