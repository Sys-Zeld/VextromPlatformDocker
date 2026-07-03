import { api } from "./client";

export interface Measurement {
  id: number;
  seq_id: number;
  title: string;
  columns: string[];
  rows: string[][];
  notes: string;
  sort_order: number;
}

export interface MeasurementInput {
  measurementId?: number;
  title: string;
  columns: string[];
  rows: string[][];
  notes: string;
}

export function listMeasurements(orderId: number) {
  return api<{ measurements: Measurement[]; locked: boolean }>(`/orders/${orderId}/measurements`);
}

export function saveMeasurement(orderId: number, input: MeasurementInput) {
  return api<{ ok: boolean }>(`/orders/${orderId}/measurements`, { method: "POST", body: JSON.stringify(input) });
}

export function deleteMeasurement(orderId: number, measurementId: number) {
  return api<void>(`/orders/${orderId}/measurements/${measurementId}`, { method: "DELETE" });
}
