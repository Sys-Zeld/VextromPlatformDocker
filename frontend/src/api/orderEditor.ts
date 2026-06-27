import { api } from "./client";
import type { Order, Technician } from "./orders";

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
  technicians: Technician[];
  locked: boolean;
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
