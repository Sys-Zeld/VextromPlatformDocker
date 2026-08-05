import { api } from "./client";
import type { Customer, CustomerArea, Site } from "./customers";

export interface Equipment {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  site_id: number | null;
  site_name: string | null;
  area_id: number | null;
  area_name: string | null;
  type: string | null;
  manufacturer: string | null;
  model_family: string | null;
  serial_number: string | null;
  tag_number: string | null;
  power: string | null;
  rated_ac_input_voltage: string | null;
  rated_ac_output_voltage: string | null;
  rated_dc_voltage: string | null;
  input_frequency: string | null;
  output_frequency: string | null;
  degree_of_protection: string | null;
  main_label: string | null;
  dt_number: string | null;
  year_of_manufacture: string | null;
  notes: string | null;
}

export interface EquipmentsPayload {
  equipments: Equipment[];
  customers: Customer[];
  sites: Site[];
  areas: CustomerArea[];
}

export interface EquipmentInput {
  customerId: number | "";
  siteId: number | "";
  areaId: number | "";
  type: string;
  manufacturer: string;
  modelFamily: string;
  serialNumber: string;
  tagNumber: string;
  power: string;
  ratedAcInputVoltage: string;
  inputFrequency: string;
  ratedDcVoltage: string;
  ratedAcOutputVoltage: string;
  outputFrequency: string;
  degreeOfProtection: string;
  mainLabel: string;
  dtNumber: string;
  yearOfManufacture: string;
  notes: string;
}

export function listEquipments() {
  return api<EquipmentsPayload>("/equipments");
}

export function createEquipment(input: EquipmentInput) {
  return api<Equipment>("/equipments", { method: "POST", body: JSON.stringify(input) });
}

export function updateEquipment(id: number, input: EquipmentInput) {
  return api<Equipment>(`/equipments/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteEquipment(id: number) {
  return api<void>(`/equipments/${id}`, { method: "DELETE" });
}

// ---- Anexos do equipamento (manuais, parâmetros, etc.) ------------------
export interface EquipmentAttachment {
  id: number;
  equipment_id: number;
  label: string | null;
  original_name: string | null;
  stored_name: string | null;
  file_size: number | string | null;
  mime_type: string | null;
  created_at: string | null;
}

export function listEquipmentAttachments(id: number) {
  return api<{ ok: boolean; data: EquipmentAttachment[] }>(`/equipments/${id}/attachments`);
}

export function uploadEquipmentAttachment(id: number, file: File, label: string) {
  // Corpo raw (o arquivo em si); nome e descrição vão por header, como nos anexos de OS.
  return api<{ ok: boolean; data?: unknown; error?: string }>(`/equipments/${id}/attachments`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-Label": encodeURIComponent(label.trim())
    },
    body: file
  });
}

export function deleteEquipmentAttachment(id: number, attachmentId: number) {
  return api<{ ok: boolean }>(`/equipments/${id}/attachments/${attachmentId}`, { method: "DELETE" });
}
