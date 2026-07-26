import { api } from "./client";
import type { Customer, Site } from "./customers";

export interface Equipment {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  site_id: number | null;
  site_name: string | null;
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
}

export interface EquipmentInput {
  customerId: number | "";
  siteId: number | "";
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
