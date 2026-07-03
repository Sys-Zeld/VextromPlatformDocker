import { api } from "../client";

export interface SgArea {
  id: number;
  site_id: number;
  site_name?: string;
  client_id?: number;
  client_name?: string;
  name: string;
  area_type: string;
  classification: string;
  access_restrictions: string;
  env_conditions: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgAreaInput {
  siteId: number;
  name: string;
  areaType: string;
  classification: string;
  accessRestrictions: string;
  envConditions: string;
  notes: string;
}

export interface AreaListResult {
  areas: SgArea[];
  total: number;
  page: number;
  pageSize: number;
}

export function listAreas(params: { siteId?: number; clientId?: number; search?: string; page?: number; pageSize?: number } = {}) {
  const q = new URLSearchParams();
  if (params.siteId) q.set("siteId", String(params.siteId));
  if (params.clientId) q.set("clientId", String(params.clientId));
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return api<AreaListResult>(`/sentinelgrid/areas${qs ? `?${qs}` : ""}`);
}

export function createArea(input: SgAreaInput) {
  return api<{ area: SgArea }>("/sentinelgrid/areas", { method: "POST", body: JSON.stringify(input) });
}

export function updateArea(id: number, input: SgAreaInput) {
  return api<{ area: SgArea }>(`/sentinelgrid/areas/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteArea(id: number) {
  return api<void>(`/sentinelgrid/areas/${id}`, { method: "DELETE" });
}
