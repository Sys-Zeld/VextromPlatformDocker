import { api } from "./client";

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
