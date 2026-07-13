import { api } from "../client";

// Fase 10 — Mapa Calendário. Contrato do evento normalizado (motor 10.1–10.3).
export type SgAlertLevel = "planejada" | "proxima" | "critica" | "vencida" | null;
export type SgCalendarColor = "verde" | "azul" | "amarelo" | "laranja" | "vermelho" | "roxo" | "cinza";
export type SgAlertPriority = "informativo" | "atencao" | "importante" | "critico" | "emergencial";
export type SgGeneralStatus = "normal" | "atencao" | "critico" | "emergencial";

export interface SgMapEvent {
  source_kind: string;
  ref_table: string;
  ref_id: number;
  event_kind: string;
  title: string;
  client_id: number;
  client_name: string;
  site_id: number | null;
  site_name: string | null;
  area_id: number | null;
  area_name: string | null;
  equipment_id: number;
  equipment_tag: string;
  equipment_type_id: number | null;
  maintenance_type: string;
  event_date: string; // YYYY-MM-DD
  status: string;
  criticality: string;
  responsible: string;
  action_needed: string;
  is_overdue: boolean;
  days_to_due: number;
  alert_level: SgAlertLevel;
  color: SgCalendarColor;
  priority: SgAlertPriority;
}

export interface SgMapClientSummary {
  client_id: number;
  client_name: string;
  total: number;
  overdue: number;
  upcoming: number;
  corrective_open: number;
  pending_approval: number;
  critical_rec: number;
  pending_report: number;
  restricted_equip: number;
  general_status: SgGeneralStatus;
}

export interface SgMapSummary {
  clients: SgMapClientSummary[];
  totals: Omit<SgMapClientSummary, "client_id" | "client_name" | "general_status">;
  general_status: SgGeneralStatus;
  events: number;
  range: { from: string | null; to: string | null };
}

export interface MapFilters {
  from?: string;
  to?: string;
  clientId?: number;
  siteId?: number;
  areaId?: number;
  equipmentId?: number;
  equipmentTypeId?: number;
  maintenanceType?: string;
  status?: string;
  criticality?: string;
  responsible?: string;
  onlyCriticalRec?: boolean;
  onlyPendingApproval?: boolean;
  onlyPendingReport?: boolean;
}

function qs(f: MapFilters): string {
  const q = new URLSearchParams();
  const set = (k: string, v: string | number | boolean | undefined) => {
    if (v === undefined || v === null || v === "" || v === false) return;
    q.set(k, String(v));
  };
  set("from", f.from);
  set("to", f.to);
  set("clientId", f.clientId);
  set("siteId", f.siteId);
  set("areaId", f.areaId);
  set("equipmentId", f.equipmentId);
  set("equipmentTypeId", f.equipmentTypeId);
  set("maintenanceType", f.maintenanceType);
  set("status", f.status);
  set("criticality", f.criticality);
  set("responsible", f.responsible);
  set("onlyCriticalRec", f.onlyCriticalRec ? 1 : undefined);
  set("onlyPendingApproval", f.onlyPendingApproval ? 1 : undefined);
  set("onlyPendingReport", f.onlyPendingReport ? 1 : undefined);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function listMapEvents(f: MapFilters = {}) {
  return api<{ events: SgMapEvent[]; range: { from: string | null; to: string | null }; total: number }>(
    `/sentinelgrid/calendar/map${qs(f)}`
  );
}

export function getMapSummary(f: MapFilters = {}) {
  return api<SgMapSummary>(`/sentinelgrid/calendar/map/summary${qs(f)}`);
}

export interface MoveCalendarEventsInput {
  sourceDate: string;
  targetDate: string;
  items: Array<{ refTable: string; refId: number }>;
}

export function moveCalendarEvents(input: MoveCalendarEventsInput) {
  return api<{ moved: number }>("/sentinelgrid/calendar/map/move", {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

// Regras de vencimento configuráveis (A.9 / Fatia 10.2).
export interface SgAlertRule {
  criticality: string;
  first_alert_days: number;
  critical_alert_days: number;
  critical_after_due: boolean;
  updated_by: string;
  updated_at: string;
}

export interface SgAlertRuleInput {
  firstAlertDays: number;
  criticalAlertDays: number;
  criticalAfterDue: boolean;
}

export function listAlertRules() {
  return api<{ rules: SgAlertRule[] }>("/sentinelgrid/calendar/alert-rules").then((r) => r.rules);
}

export function updateAlertRule(criticality: string, input: SgAlertRuleInput) {
  return api<{ rule: SgAlertRule }>(`/sentinelgrid/calendar/alert-rules/${criticality}`, {
    method: "PUT",
    body: JSON.stringify(input)
  }).then((r) => r.rule);
}

// Metadados de apresentação (A.7 cores / A.8 prioridades / A.10 status geral).
// Cores alinhadas à paleta de status da identidade Vextrom.
export const COLOR_HEX: Record<SgCalendarColor, string> = {
  verde: "#3F7D2A",
  azul: "#0E6BA8",
  amarelo: "#DFAE18",
  laranja: "#E6512E",
  vermelho: "#C93F3F",
  roxo: "#8B5CF6",
  cinza: "#9AA1A6"
};

export const COLOR_LABEL: Record<SgCalendarColor, string> = {
  verde: "Concluído / normal",
  azul: "Planejado / agendado",
  amarelo: "Próximo do vencimento",
  laranja: "Atenção / aprovação pendente",
  vermelho: "Vencido / crítico / corretiva",
  roxo: "Recomendação técnica",
  cinza: "Cancelado / desativado"
};

// Cores próprias da prioridade (A.8): escala crescente azul → amarelo → laranja →
// vermelho → vermelho profundo, ancorada na paleta de status da identidade.
export const PRIORITY_META: Record<SgAlertPriority, { label: string; hex: string; text: string }> = {
  informativo: { label: "Informativo", hex: "#0E6BA8", text: "#fff" },
  atencao: { label: "Atenção", hex: "#DFAE18", text: "#1F2529" },
  importante: { label: "Importante", hex: "#E6512E", text: "#fff" },
  critico: { label: "Crítico", hex: "#C93F3F", text: "#fff" },
  emergencial: { label: "Emergencial", hex: "#B71C1C", text: "#fff" }
};

export const EVENT_KIND_LABEL: Record<string, string> = {
  planejada_sem_parada: "Preventiva s/ parada (planejada)",
  planejada_com_parada: "Preventiva c/ parada (planejada)",
  om_manutencao: "Manutenção (OM)",
  corretiva_aberta: "Corretiva aberta",
  aprovacao_pendente: "Aprovação pendente",
  recomendacao_prazo: "Recomendação (prazo)",
  recomendacao_critica: "Recomendação crítica",
  relatorio_pendente: "Relatório pendente",
  evento_critico: "Evento crítico",
  equip_restrito: "Equipamento restrito"
};

export const GENERAL_STATUS_META: Record<SgGeneralStatus, { label: string; color: SgCalendarColor }> = {
  normal: { label: "Normal", color: "verde" },
  atencao: { label: "Atenção", color: "amarelo" },
  critico: { label: "Crítico", color: "vermelho" },
  emergencial: { label: "Emergencial", color: "vermelho" }
};

const PRIORITY_ORDER: SgAlertPriority[] = ["informativo", "atencao", "importante", "critico", "emergencial"];
export function highestPriority(events: SgMapEvent[]): SgAlertPriority {
  return events.reduce<SgAlertPriority>(
    (top, e) => (PRIORITY_ORDER.indexOf(e.priority) > PRIORITY_ORDER.indexOf(top) ? e.priority : top),
    "informativo"
  );
}
