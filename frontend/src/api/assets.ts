import { api } from "./client";

export interface Technician {
  id: number;
  name: string;
  role: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  is_lead: boolean;
}

export interface Instrument {
  id: number;
  name: string;
  model: string | null;
  serial_number: string | null;
  certificate_number: string | null;
  certificate_link: string | null;
  responsible_technician_id: number | null;
  last_calibration_date: string | null;
  calibration_due_date: string | null;
  notes: string | null;
}

export interface AssetsPayload {
  technicians: Technician[];
  instruments: Instrument[];
}

export interface TechnicianInput {
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  isLead: boolean;
}

export interface InstrumentInput {
  name: string;
  model: string;
  serialNumber: string;
  certificateNumber: string;
  certificateLink: string;
  responsibleTechnicianId: number | "";
  lastCalibrationDate: string;
  calibrationDueDate: string;
  notes: string;
}

export function listAssets() {
  return api<AssetsPayload>("/assets");
}

export function createTechnician(input: TechnicianInput) {
  return api<Technician>("/assets/technicians", { method: "POST", body: JSON.stringify(input) });
}
export function updateTechnician(id: number, input: TechnicianInput) {
  return api<Technician>(`/assets/technicians/${id}`, { method: "PUT", body: JSON.stringify(input) });
}
export function deleteTechnician(id: number) {
  return api<void>(`/assets/technicians/${id}`, { method: "DELETE" });
}

export function createInstrument(input: InstrumentInput) {
  return api<Instrument>("/assets/instruments", { method: "POST", body: JSON.stringify(input) });
}
export function updateInstrument(id: number, input: InstrumentInput) {
  return api<Instrument>(`/assets/instruments/${id}`, { method: "PUT", body: JSON.stringify(input) });
}
export function deleteInstrument(id: number) {
  return api<void>(`/assets/instruments/${id}`, { method: "DELETE" });
}
