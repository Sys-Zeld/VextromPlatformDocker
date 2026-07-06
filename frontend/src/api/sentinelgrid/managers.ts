import { api } from "../client";

export interface SgManager {
  id: number;
  client_id: number;
  client_name?: string;
  site_id: number | null;
  site_name?: string | null;
  area_id: number | null;
  area_name?: string | null;
  name: string;
  role_type: string;
  email: string;
  phone: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgManagerInput {
  clientId: number;
  siteId: number | null;
  areaId: number | null;
  name: string;
  roleType: string;
  email: string;
  phone: string;
  notes: string;
}

export function listManagers(params: { clientId?: number; search?: string } = {}) {
  const q = new URLSearchParams();
  if (params.clientId) q.set("clientId", String(params.clientId));
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return api<{ managers: SgManager[]; total: number }>(`/sentinelgrid/client-managers${qs ? `?${qs}` : ""}`);
}
export function createManager(input: SgManagerInput) {
  return api<{ manager: SgManager }>("/sentinelgrid/client-managers", { method: "POST", body: JSON.stringify(input) }).then((r) => r.manager);
}
export function updateManager(id: number, input: SgManagerInput) {
  return api<{ manager: SgManager }>(`/sentinelgrid/client-managers/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.manager);
}
export function deleteManager(id: number) {
  return api<void>(`/sentinelgrid/client-managers/${id}`, { method: "DELETE" });
}
