import { api } from "../client";

export interface SgLookup {
  id: number;
  name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface SgLookupInput {
  name: string;
  notes: string;
}

export interface SgModel {
  id: number;
  manufacturer_id: number;
  manufacturer_name?: string;
  equipment_type_id: number;
  equipment_type_name?: string;
  name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}
export interface SgModelInput {
  manufacturerId: number;
  equipmentTypeId: number;
  name: string;
  notes: string;
}

function qs(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== 0) q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

// --- Fabricantes ---
export function listManufacturers(search = "") {
  return api<{ manufacturers: SgLookup[] }>(`/sentinelgrid/manufacturers${qs({ search })}`).then((r) => r.manufacturers);
}
export function createManufacturer(input: SgLookupInput) {
  return api<{ item: SgLookup }>("/sentinelgrid/manufacturers", { method: "POST", body: JSON.stringify(input) }).then((r) => r.item);
}
export function updateManufacturer(id: number, input: SgLookupInput) {
  return api<{ item: SgLookup }>(`/sentinelgrid/manufacturers/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.item);
}
export function deleteManufacturer(id: number) {
  return api<void>(`/sentinelgrid/manufacturers/${id}`, { method: "DELETE" });
}

// --- Tipos de equipamento ---
export function listEquipmentTypes(search = "") {
  return api<{ equipmentTypes: SgLookup[] }>(`/sentinelgrid/equipment-types${qs({ search })}`).then((r) => r.equipmentTypes);
}
export function createEquipmentType(input: SgLookupInput) {
  return api<{ item: SgLookup }>("/sentinelgrid/equipment-types", { method: "POST", body: JSON.stringify(input) }).then((r) => r.item);
}
export function updateEquipmentType(id: number, input: SgLookupInput) {
  return api<{ item: SgLookup }>(`/sentinelgrid/equipment-types/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.item);
}
export function deleteEquipmentType(id: number) {
  return api<void>(`/sentinelgrid/equipment-types/${id}`, { method: "DELETE" });
}

// --- Modelos ---
export function listModels(params: { manufacturerId?: number; equipmentTypeId?: number; search?: string } = {}) {
  return api<{ models: SgModel[]; total: number }>(`/sentinelgrid/equipment-models${qs(params)}`);
}
export function createModel(input: SgModelInput) {
  return api<{ model: SgModel }>("/sentinelgrid/equipment-models", { method: "POST", body: JSON.stringify(input) }).then((r) => r.model);
}
export function updateModel(id: number, input: SgModelInput) {
  return api<{ model: SgModel }>(`/sentinelgrid/equipment-models/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.model);
}
export function deleteModel(id: number) {
  return api<void>(`/sentinelgrid/equipment-models/${id}`, { method: "DELETE" });
}
