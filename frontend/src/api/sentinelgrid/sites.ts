import { api } from "../client";

export interface SgSite {
  id: number;
  client_id: number;
  client_name?: string;
  name: string;
  site_type: string;
  location: string;
  local_contact: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgSiteInput {
  clientId: number;
  name: string;
  siteType: string;
  location: string;
  localContact: string;
  notes: string;
}

export interface SiteListResult {
  sites: SgSite[];
  total: number;
  page: number;
  pageSize: number;
}

export function listSites(params: { clientId?: number; search?: string; page?: number; pageSize?: number } = {}) {
  const q = new URLSearchParams();
  if (params.clientId) q.set("clientId", String(params.clientId));
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return api<SiteListResult>(`/sentinelgrid/sites${qs ? `?${qs}` : ""}`);
}

export function createSite(input: SgSiteInput) {
  return api<{ site: SgSite }>("/sentinelgrid/sites", { method: "POST", body: JSON.stringify(input) });
}

export function updateSite(id: number, input: SgSiteInput) {
  return api<{ site: SgSite }>(`/sentinelgrid/sites/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteSite(id: number) {
  return api<void>(`/sentinelgrid/sites/${id}`, { method: "DELETE" });
}
