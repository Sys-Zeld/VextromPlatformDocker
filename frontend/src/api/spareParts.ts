import { api } from "./client";
import type { Customer } from "./customers";
import type { Equipment } from "./equipments";

export interface SparePart {
  id: number;
  description: string;
  manufacturer: string | null;
  equipment_model: string | null;
  part_number: string | null;
  lead_time: string | null;
  is_obsolete: boolean;
  replaced_by_part_number: string | null;
  equipment_family: string | null;
}

export interface SparePartsPayload {
  spareParts: SparePart[];
  equipments: Equipment[];
  customers: Customer[];
}

export interface SparePartInput {
  description: string;
  manufacturer: string;
  equipmentModel: string;
  partNumber: string;
  leadTime: string;
  isObsolete: boolean;
  replacedByPartNumber: string;
  equipmentFamily: string;
}

export function listSpareParts() {
  return api<SparePartsPayload>("/spare-parts");
}

export function createSparePart(input: SparePartInput) {
  return api<SparePart>("/spare-parts", { method: "POST", body: JSON.stringify(input) });
}

export function updateSparePart(id: number, input: SparePartInput) {
  return api<SparePart>(`/spare-parts/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteSparePart(id: number) {
  return api<void>(`/spare-parts/${id}`, { method: "DELETE" });
}

// ---- Vínculo por equipamento (snapshots editáveis) ----------------------

export interface EquipmentSpare {
  id: number;
  equipment_id: number;
  source_spare_part_id: number | null;
  description: string;
  manufacturer: string | null;
  equipment_model: string | null;
  part_number: string | null;
  lead_time: string | null;
  is_obsolete: boolean;
  replaced_by_part_number: string | null;
  equipment_family: string | null;
  quantity: number;
}

export interface EquipmentSparesPayload {
  equipment: { id: number; type: string | null; customer_name: string | null; site_name: string | null };
  linkedSpares: EquipmentSpare[];
  availableSpares: SparePart[];
}

export interface EquipmentSpareInput extends SparePartInput {
  quantity: number;
}

export function getEquipmentSpares(equipmentId: number) {
  return api<EquipmentSparesPayload>(`/spare-parts/equipment/${equipmentId}`);
}

export function linkSparePartToEquipment(equipmentId: number, sparePartId: number, quantity: number) {
  return api<{ ok: boolean }>(`/spare-parts/equipment/${equipmentId}/link`, {
    method: "POST",
    body: JSON.stringify({ sparePartId, quantity })
  });
}

export function createEquipmentSpare(equipmentId: number, input: EquipmentSpareInput) {
  return api<EquipmentSpare>(`/spare-parts/equipment/${equipmentId}/spares`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateEquipmentSpare(id: number, input: EquipmentSpareInput) {
  return api<EquipmentSpare>(`/spare-parts/equipment-spares/${id}`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export function deleteEquipmentSpare(id: number) {
  return api<void>(`/spare-parts/equipment-spares/${id}`, { method: "DELETE" });
}

// ---- Importação por IA/PDF + bulk ---------------------------------------

export interface AiConfig {
  defaultPrompt: string;
  jsonSchema: string;
}

export interface ExtractedSparePart {
  description?: string;
  manufacturer?: string;
  part_number?: string;
  equipment_model?: string;
  equipment_family?: string;
  lead_time?: string;
  is_obsolete?: boolean;
  replaced_by_part_number?: string;
  quantity?: number;
  [key: string]: unknown;
}

export interface BulkImportResult {
  ok: boolean;
  scope: "catalog" | "equipment";
  inserted: number;
  updated?: number;
  linked?: number;
  skipped?: number;
  skippedExisting?: number;
}

export function getSparePartsAiConfig() {
  return api<AiConfig>("/spare-parts/ai-config");
}

export function aiExtractSpareParts(input: { fileBase64: string; fileName: string; mimeType: string; promptTemplate?: string }) {
  return api<{ spareParts: ExtractedSparePart[]; count: number }>("/spare-parts/ai-extract", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function bulkImportSpareParts(items: ExtractedSparePart[], equipmentId?: number) {
  return api<BulkImportResult>("/spare-parts/bulk-import", {
    method: "POST",
    body: JSON.stringify({ items, equipmentId })
  });
}
