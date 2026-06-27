import { api } from "./client";
import type { Order } from "./orders";
import type { Equipment } from "./equipments";
import type { Instrument, Technician } from "./assets";

export interface OrderEquipment {
  equipment_id: number;
  type: string | null;
  serial_number: string | null;
  tag_number: string | null;
  manufacturer: string | null;
  model_family: string | null;
  customer_name: string | null;
  site_name: string | null;
}

export interface TimesheetEntry {
  id: number;
  service_order_id: number;
  activity_date: string | null;
  check_in_base: string | null;
  check_in_client: string | null;
  check_out_client: string | null;
  check_out_base: string | null;
  technician_name: string | null;
  worked_hours: number | string | null;
  notes: string | null;
}

export interface OrderEditorPayload {
  order: Order & { service_order_code?: string | null; description?: string | null; proposal_number?: string | null; closing_date?: string | null };
  report: { id: number; status?: string | null };
  timesheet: TimesheetEntry[];
  locked: boolean;
  orderEquipments: OrderEquipment[];
  availableEquipments: Equipment[];
  linkedTechnicians: Technician[];
  technicians: Technician[];
  availableTechnicians: Technician[];
  linkedInstruments: Instrument[];
  instruments: Instrument[];
  availableInstruments: Instrument[];
}

export interface TimesheetInput {
  activityDate: string;
  checkInBase: string;
  checkInClient: string;
  checkOutClient: string;
  checkOutBase: string;
  technicianName: string;
  notes: string;
}

export function getOrderEditor(id: number) {
  return api<OrderEditorPayload>(`/orders/${id}/editor`);
}

export function addTimesheet(id: number, input: TimesheetInput) {
  return api<TimesheetEntry>(`/orders/${id}/timesheet`, { method: "POST", body: JSON.stringify(input) });
}

export function updateTimesheet(id: number, entryId: number, input: TimesheetInput) {
  return api<TimesheetEntry>(`/orders/${id}/timesheet/${entryId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteTimesheet(id: number, entryId: number) {
  return api<void>(`/orders/${id}/timesheet/${entryId}`, { method: "DELETE" });
}

// ---- Equipamentos / técnicos / instrumentos da OS -----------------------
export function attachEquipment(id: number, equipmentId: number, notes = "") {
  return api<{ ok: boolean }>(`/orders/${id}/equipments`, { method: "POST", body: JSON.stringify({ equipmentId, notes }) });
}
export function detachEquipment(id: number, equipmentId: number) {
  return api<void>(`/orders/${id}/equipments/${equipmentId}`, { method: "DELETE" });
}
export function linkTechnician(id: number, technicianId: number) {
  return api<{ ok: boolean }>(`/orders/${id}/technicians`, { method: "POST", body: JSON.stringify({ technicianId }) });
}
export function unlinkTechnician(id: number, techId: number) {
  return api<void>(`/orders/${id}/technicians/${techId}`, { method: "DELETE" });
}
export function linkInstrument(id: number, instrumentId: number) {
  return api<{ ok: boolean }>(`/orders/${id}/instruments`, { method: "POST", body: JSON.stringify({ instrumentId }) });
}
export function unlinkInstrument(id: number, instrId: number) {
  return api<void>(`/orders/${id}/instruments/${instrId}`, { method: "DELETE" });
}
