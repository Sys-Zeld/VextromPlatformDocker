import { api } from "../client";

export interface SgContract {
  id: number;
  client_id: number;
  client_name?: string;
  name: string;
  valid_from: string | null;
  valid_to: string | null;
  maint_per_year: number | null;
  sla_corrective: string;
  requires_report: boolean;
  requires_approval: boolean;
  scope: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SgContractInput {
  clientId: number;
  name: string;
  validFrom: string;
  validTo: string;
  maintPerYear: number | null;
  slaCorrective: string;
  requiresReport: boolean;
  requiresApproval: boolean;
  scope: string;
  notes: string;
}

export function listContracts(params: { clientId?: number; search?: string } = {}) {
  const q = new URLSearchParams();
  if (params.clientId) q.set("clientId", String(params.clientId));
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return api<{ contracts: SgContract[]; total: number }>(`/sentinelgrid/contracts${qs ? `?${qs}` : ""}`);
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
