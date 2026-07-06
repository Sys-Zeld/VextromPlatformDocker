import { api } from "../client";

export interface SgContract {
  id: number;
  client_id: number;
  client_name?: string;
  name: string;
  contract_number: string;
  valid_from: string | null;
  valid_to: string | null;
  maint_per_year: number | null;
  sla_corrective: string;
  requires_report: boolean;
  requires_approval: boolean;
  contact_email: string;
  contact_phone: string;
  scope: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgContractInput {
  clientId: number;
  name: string;
  contractNumber: string;
  validFrom: string;
  validTo: string;
  maintPerYear: number | null;
  slaCorrective: string;
  requiresReport: boolean;
  requiresApproval: boolean;
  contactEmail: string;
  contactPhone: string;
  scope: string;
  notes: string;
}

export function listContracts(params: { clientId?: number; search?: string; page?: number; pageSize?: number } = {}) {
  const q = new URLSearchParams();
  if (params.clientId) q.set("clientId", String(params.clientId));
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return api<{ contracts: SgContract[]; total: number; page: number; pageSize: number }>(`/sentinelgrid/contracts${qs ? `?${qs}` : ""}`);
}
export function createContract(input: SgContractInput) {
  return api<{ contract: SgContract }>("/sentinelgrid/contracts", { method: "POST", body: JSON.stringify(input) }).then((r) => r.contract);
}
export function updateContract(id: number, input: SgContractInput) {
  return api<{ contract: SgContract }>(`/sentinelgrid/contracts/${id}`, { method: "PUT", body: JSON.stringify(input) }).then((r) => r.contract);
}
export function deleteContract(id: number) {
  return api<void>(`/sentinelgrid/contracts/${id}`, { method: "DELETE" });
}
