import { api } from "../client";

export type SgDemandStatus = "pendente" | "parcial" | "gerada";

export interface SgDemandTechnician {
  id: number;
  name: string;
}

export interface SgDemandOrder {
  orderId: number;
  orderNumber: string;
  equipmentId: number;
  equipmentTag: string;
  maintenanceType: string;
  priority: string;
  scope: string;
  executionDays: number;
  endDate: string;
  technicians: SgDemandTechnician[];
  rsServiceOrderId: number | null;
  rsServiceOrderCode: string;
}

// Grupo derivado de (cliente, site, dia): vira UMA Ordem de Serviço no Service Report.
export interface SgDemandGroup {
  groupKey: string;
  clientId: number;
  clientName: string;
  siteId: number;
  siteName: string;
  date: string;
  endDate: string;
  status: SgDemandStatus;
  rsServiceOrderId: number | null;
  rsServiceOrderCode: string;
  technicians: SgDemandTechnician[];
  orders: SgDemandOrder[];
}

export interface SgDemandGenerateResult {
  groupKey: string;
  ok: boolean;
  rsOrderId?: number;
  rsOrderCode?: string;
  reused?: boolean;
  orderIds?: number[];
  skipped?: number[];
  error?: string;
  errorCode?: string;
}

export const listScheduledDemands = (params: {
  from: string;
  to: string;
  clientId?: number;
  siteId?: number;
  search?: string;
}) => {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.clientId) query.set("clientId", String(params.clientId));
  if (params.siteId) query.set("siteId", String(params.siteId));
  if (params.search) query.set("search", params.search);
  return api<{ groups: SgDemandGroup[] }>(`/sentinelgrid/demands/scheduled?${query}`);
};

// A equipe é definida no grupo (a futura OS), não na OM: a lista enviada é a final e vale para
// todas as OMs do grupo. Se a OS já existe, a equipe dela é sincronizada junto.
export const setDemandGroupTechnicians = (input: { orderIds: number[]; technicianIds: number[] }) =>
  api<{ orderIds: number[]; technicianIds: number[]; rsOrderIds: number[] }>("/sentinelgrid/demands/technicians", {
    method: "PUT",
    body: JSON.stringify(input)
  });

// Duração é da OS (a mobilização), não do equipamento: o valor vale para todas as OMs do grupo.
// Não move a data de início — só os dias.
export const setDemandGroupDuration = (input: { orderIds: number[]; executionDays: number }) =>
  api<{ orderIds: number[]; executionDays: number }>("/sentinelgrid/demands/duration", {
    method: "PUT",
    body: JSON.stringify(input)
  });

export const generateDemands = (groups: Array<{ groupKey: string; orderIds: number[] }>) =>
  api<{ results: SgDemandGenerateResult[]; generated: number; failed: number }>("/sentinelgrid/demands/generate", {
    method: "POST",
    body: JSON.stringify({ groups })
  });
