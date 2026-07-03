// Client tipado do módulo SentinelGrid. Reaproveita o wrapper `api` (mesma
// sessão/CSRF do admin) — base já é /admin/api/v2, então os paths daqui começam
// em /sentinelgrid (façade montada em /admin/api/v2/sentinelgrid).
import { api } from "../client";

export interface SentinelHealth {
  module: string;
  status: string;
  migrations: number;
}

export function getSentinelHealth() {
  return api<SentinelHealth>("/sentinelgrid/health");
}
