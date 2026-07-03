import { api } from "./client";

export interface AlberLeitura {
  id: number;
  location_name: string;
  battery_name: string;
  model_number: string;
  total_strings: number;
  nome_arquivo: string;
  cell_count: number;
  created_at: string | null;
}
export interface UpsMeasure { id: number; seq_id: number; title: string; sections: number; rows: number }
export interface EventLogItem { id: number; seq_id: number; title: string; sections: number; rows: number }

export interface UpsDataPayload {
  alber: AlberLeitura[];
  upsMeasures: UpsMeasure[];
  eventLogs: EventLogItem[];
  locked: boolean;
}

export function getUpsData(orderId: number) {
  return api<UpsDataPayload>(`/orders/${orderId}/ups-data`);
}

function uploadRaw(path: string, file: File) {
  return api<{ ok: boolean; error?: string }>(path, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name)
    },
    body: file
  });
}

export function importAlber(orderId: number, file: File) {
  return uploadRaw(`/orders/${orderId}/ups-data/alber/import`, file);
}
export function deleteAlber(orderId: number, leituraId: number) {
  return api<void>(`/orders/${orderId}/ups-data/alber/${leituraId}`, { method: "DELETE" });
}
export function importUpsMeasures(orderId: number, file: File) {
  return uploadRaw(`/orders/${orderId}/ups-data/ups-measures/import`, file);
}
export function deleteUpsMeasures(orderId: number, upsId: number) {
  return api<void>(`/orders/${orderId}/ups-data/ups-measures/${upsId}`, { method: "DELETE" });
}
export function importEventLog(orderId: number, file: File) {
  return uploadRaw(`/orders/${orderId}/ups-data/event-logs/import`, file);
}
export function deleteEventLog(orderId: number, eventLogId: number) {
  return api<void>(`/orders/${orderId}/ups-data/event-logs/${eventLogId}`, { method: "DELETE" });
}
