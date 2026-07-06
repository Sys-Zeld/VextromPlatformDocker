import { api } from "../client";
import { SgAlertPriority, SgMapEvent } from "./calendarMap";

export interface AlertsResult {
  alerts: SgMapEvent[];
  total: number;
  byPriority: Partial<Record<SgAlertPriority, number>>;
}

export interface AckState {
  acknowledged: boolean;
  until: number | null;
}

function qs(params: Record<string, number | undefined>): string {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, String(v)); });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listAlerts(params: { clientId?: number; siteId?: number; equipmentId?: number } = {}) {
  return api<AlertsResult>(`/sentinelgrid/alerts${qs(params)}`);
}

export function getAlertAck() {
  return api<AckState>("/sentinelgrid/alerts/ack");
}

// Registra "ciente" — o popup some por 24h.
export function ackAlerts() {
  return api<AckState>("/sentinelgrid/alerts/ack", { method: "POST", body: JSON.stringify({}) });
}

// Reset — limpa o "ciente" (o popup volta a aparecer).
export function resetAlertAck() {
  return api<AckState>("/sentinelgrid/alerts/ack", { method: "DELETE" });
}
