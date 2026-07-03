import { api } from "../client";

export const CLIENT_STATUS = ["ativo", "inativo", "prospect"] as const;
export type ClientStatus = (typeof CLIENT_STATUS)[number];

export interface SgClient {
  id: number;
  name: string;
  tax_id: string;
  segment: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgClientInput {
  name: string;
  taxId: string;
  segment: string;
  status: string;
  notes: string;
}

export interface ClientListResult {
  clients: SgClient[];
  total: number;
  page: number;
  pageSize: number;
}

export function listClients(params: { search?: string; page?: number; pageSize?: number } = {}) {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return api<ClientListResult>(`/sentinelgrid/clients${qs ? `?${qs}` : ""}`);
}

export function createClient(input: SgClientInput) {
  return api<{ client: SgClient }>("/sentinelgrid/clients", { method: "POST", body: JSON.stringify(input) });
}

export function updateClient(id: number, input: SgClientInput) {
  return api<{ client: SgClient }>(`/sentinelgrid/clients/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteClient(id: number) {
  return api<void>(`/sentinelgrid/clients/${id}`, { method: "DELETE" });
}
