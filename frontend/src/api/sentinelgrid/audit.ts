import { api } from "../client";

export type AuditCategory = "cumprida" | "em_aberto_atrasada" | "planejada" | "lacuna" | "futura";
export type AuditAdherence = "no_prazo" | "aproximado" | "fora_prazo" | "sem_data" | null;

export interface AuditOccurrenceOrder {
  id: number;
  orderNumber: string;
  status: string;
  plannedDate: string | null;
}

export interface AuditOccurrence {
  planId: number | null;
  planName: string | null;
  programName: string | null;
  itemId: number | null;
  itemTitle: string | null;
  maintenanceType: string | null;
  periodicity: string | null;
  expectedDate: string | null;
  order: AuditOccurrenceOrder | null;
  execDate: string | null;
  category: AuditCategory;
  adherence: AuditAdherence;
  deltaDays: number | null;
  pendencias: boolean;
}

export interface AuditSummary {
  total: number;
  esperadasPassado: number;
  cumpridas: number;
  noPrazo: number;
  aproximado: number;
  foraPrazo: number;
  comPendencias: number;
  emAberto: number;
  lacunas: number;
  planejadas: number;
  futuras: number;
  adherenceRate: number | null;
  executionRate: number | null;
}

export interface AuditEquipmentBrief {
  id: number;
  tag: string;
  criticality: string;
  operational_status: string;
  client_id: number;
  client_name: string;
  site_id: number;
  site_name: string;
  area_name: string;
}

export interface AuditEquipmentResult {
  equipment: AuditEquipmentBrief;
  from: string;
  to: string;
  summary: AuditSummary;
  occurrences: AuditOccurrence[];
}

export interface AuditClientEquipmentRow {
  equipment: {
    id: number;
    tag: string;
    criticality: string;
    operational_status: string;
    site_id: number;
    site_name: string;
    area_name: string;
  };
  summary: AuditSummary;
}

export interface AuditClientAggregate {
  equipamentos: number;
  esperadasPassado: number;
  cumpridas: number;
  noPrazo: number;
  aproximado: number;
  foraPrazo: number;
  comPendencias: number;
  emAberto: number;
  lacunas: number;
  adherenceRate: number | null;
  executionRate: number | null;
}

export interface AuditClientResult {
  clientId: number;
  siteId: number | null;
  from: string;
  to: string;
  equipments: AuditClientEquipmentRow[];
  aggregate: AuditClientAggregate;
}

function rangeQuery(from?: string, to?: string): string {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const qs = q.toString();
  return qs ? `&${qs}` : "";
}

export const auditEquipment = (equipmentId: number, from?: string, to?: string) => {
  const q = new URLSearchParams();
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const qs = q.toString();
  return api<AuditEquipmentResult>(`/sentinelgrid/audit/equipment/${equipmentId}${qs ? `?${qs}` : ""}`);
};

export const auditClient = (clientId: number, siteId?: number, from?: string, to?: string) =>
  api<AuditClientResult>(
    `/sentinelgrid/audit/client?clientId=${clientId}${siteId ? `&siteId=${siteId}` : ""}${rangeQuery(from, to)}`
  );
