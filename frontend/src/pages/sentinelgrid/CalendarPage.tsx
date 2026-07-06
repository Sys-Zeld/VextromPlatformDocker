import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, ButtonGroup, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { listClients } from "../../api/sentinelgrid/clients";
import { listSites } from "../../api/sentinelgrid/sites";
import { listAreas } from "../../api/sentinelgrid/areas";
import { listEquipment, CRITICALITY } from "../../api/sentinelgrid/equipment";
import { listEquipmentTypes } from "../../api/sentinelgrid/catalog";
import { MAINTENANCE_TYPE_OPTIONS } from "../../api/sentinelgrid/programs";
import {
  COLOR_HEX,
  COLOR_LABEL,
  EVENT_KIND_LABEL,
  GENERAL_STATUS_META,
  PRIORITY_META,
  MapFilters,
  SgAlertRule,
  SgCalendarColor,
  SgMapEvent,
  highestPriority,
  getMapSummary,
  listAlertRules,
  listMapEvents,
  updateAlertRule
} from "../../api/sentinelgrid/calendarMap";
import { ackAlerts, getAlertAck, listAlerts } from "../../api/sentinelgrid/alerts";
import { sendOrderToReportService } from "../../api/sentinelgrid/maintenanceOrders";
import { equipmentLabel, formatDate } from "../../utils/format";

const CRIT_LABEL: Record<string, string> = Object.fromEntries(CRITICALITY.map((c) => [c.value, c.label]));

type View = "ano" | "mes" | "semana" | "dia";
type Mode = "cliente" | "equipamento";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Status curados (A.11) — cobrem OMs e entradas de calendário, as fontes majoritárias.
const STATUS_OPTIONS = [
  "planejada", "agendada", "aguardando_aprovacao", "aprovada", "em_execucao",
  "concluida", "concluida_com_pendencias", "reprogramada", "cancelada", "emergencial"
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ddmm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const startOfWeek = (d: Date) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };

function computeRange(view: View, anchor: Date): { from: string; to: string } {
  if (view === "ano") return { from: `${anchor.getFullYear()}-01-01`, to: `${anchor.getFullYear()}-12-31` };
  if (view === "mes") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { from: iso(first), to: iso(last) };
  }
  if (view === "semana") { const s = startOfWeek(anchor); return { from: iso(s), to: iso(addDays(s, 6)) }; }
  return { from: iso(anchor), to: iso(anchor) };
}

function rangeLabel(view: View, anchor: Date): string {
  if (view === "ano") return String(anchor.getFullYear());
  if (view === "mes") return `${MONTHS[anchor.getMonth()]}/${anchor.getFullYear()}`;
  if (view === "semana") { const s = startOfWeek(anchor); return `${ddmm(s)} – ${ddmm(addDays(s, 6))}`; }
  return `${pad(anchor.getDate())}/${pad(anchor.getMonth() + 1)}/${anchor.getFullYear()}`;
}

function step(view: View, anchor: Date, dir: number): Date {
  if (view === "ano") return addMonths(anchor, 12 * dir);
  if (view === "mes") return addMonths(anchor, dir);
  if (view === "semana") return addDays(anchor, 7 * dir);
  return addDays(anchor, dir);
}

// Conflito de agenda (A.6): 2+ atividades de manutenção no mesmo equipamento/dia.
const MAINT_KINDS = new Set(["planejada_sem_parada", "planejada_com_parada", "om_manutencao", "corretiva_aberta", "aprovacao_pendente"]);
const conflictKey = (e: SgMapEvent) => `${e.equipment_id}|${e.event_date}`;
function buildConflicts(events: SgMapEvent[]): Set<string> {
  const count = new Map<string, number>();
  for (const e of events) if (MAINT_KINDS.has(e.event_kind)) count.set(conflictKey(e), (count.get(conflictKey(e)) || 0) + 1);
  const set = new Set<string>();
  count.forEach((n, k) => { if (n > 1) set.add(k); });
  return set;
}

// Rota de origem do evento (A.12 — acesso à origem).
function originOf(e: SgMapEvent): { to?: string; label: string } {
  switch (e.ref_table) {
    case "sg_maintenance_orders": return { to: "/sentinelgrid/maintenance-orders", label: "Abrir em Ordens de manutenção" };
    case "sg_recommendations": return { to: "/sentinelgrid/recommendations", label: "Abrir em Recomendações" };
    case "sg_equipment": return { to: "/sentinelgrid/equipment", label: "Abrir cadastro do equipamento" };
    case "sg_calendar_entries": return { label: "Origem: entrada de calendário (plano)" };
    case "sg_events": return { label: "Origem: evento/alarme do equipamento" };
    default: return { label: `${e.ref_table} #${e.ref_id}` };
  }
}

const dot = (color: SgCalendarColor, size = 10) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: COLOR_HEX[color] }} />
);

// Tooltip do chip: nº da OM (título) + status. Ex.: "OM APRC-123 · agendada".
function chipTitle(e: SgMapEvent): string {
  const status = String(e.status || "").replace(/_/g, " ").trim();
  return status ? `${e.title} · ${status}` : e.title;
}

function Chip({ e, conflict, onClick }: { e: SgMapEvent; conflict: boolean; onClick: () => void }) {
  return (
    <span
      onClick={onClick}
      title={chipTitle(e)}
      style={{
        background: COLOR_HEX[e.color], color: "#fff", borderRadius: 4, padding: "1px 6px", fontSize: 11,
        whiteSpace: "nowrap", cursor: "pointer", border: conflict ? "2px solid #111" : "none"
      }}
    >
      {conflict && "⚠ "}{equipmentLabel(e.equipment_tag, e.client_name) || e.title}
    </span>
  );
}

function counters(events: SgMapEvent[]) {
  return {
    planejadas: events.filter((e) => ["planejada_sem_parada", "planejada_com_parada", "om_manutencao"].includes(e.event_kind) && !e.is_overdue).length,
    vencidas: events.filter((e) => e.alert_level === "vencida").length,
    corretivas: events.filter((e) => e.event_kind === "corretiva_aberta").length,
    recCriticas: events.filter((e) => e.event_kind === "recomendacao_critica").length,
    aprovacoes: events.filter((e) => e.event_kind === "aprovacao_pendente").length,
    relatorios: events.filter((e) => e.event_kind === "relatorio_pendente").length
  };
}

function AnnualView({ year, events }: { year: number; events: SgMapEvent[] }) {
  const byMonth = Array.from({ length: 12 }, (_, m) => events.filter((e) => Number(e.event_date.slice(5, 7)) === m + 1));
  return (
    <Card>
      <Table responsive hover className="mb-0 align-middle text-center">
        <thead>
          <tr>
            <th className="text-start">Mês</th>
            <th>Planejadas</th><th>Vencidas</th><th>Corretivas</th>
            <th>Rec. críticas</th><th>Aprovações</th><th>Relatórios</th>
          </tr>
        </thead>
        <tbody>
          {byMonth.map((evs, m) => {
            const c = counters(evs);
            return (
              <tr key={m} className={evs.length === 0 ? "text-muted" : undefined}>
                <td className="text-start fw-medium">{MONTHS[m]}/{year}</td>
                <td>{c.planejadas || "—"}</td>
                <td>{c.vencidas ? <Badge bg="danger">{c.vencidas}</Badge> : "—"}</td>
                <td>{c.corretivas ? <Badge bg="danger">{c.corretivas}</Badge> : "—"}</td>
                <td>{c.recCriticas ? <Badge bg="danger">{c.recCriticas}</Badge> : "—"}</td>
                <td>{c.aprovacoes ? <Badge bg="warning" text="dark">{c.aprovacoes}</Badge> : "—"}</td>
                <td>{c.relatorios ? <Badge bg="warning" text="dark">{c.relatorios}</Badge> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

function MonthView({ anchor, events, conflicts, onSelect }: { anchor: Date; events: SgMapEvent[]; conflicts: Set<string>; onSelect: (e: SgMapEvent) => void }) {
  const byDay = useMemo(() => {
    const map = new Map<string, SgMapEvent[]>();
    for (const e of events) { const k = e.event_date; if (!map.has(k)) map.set(k, []); map.get(k)!.push(e); }
    return map;
  }, [events]);

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  let cur = startOfWeek(first);
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) { row.push(cur); cur = addDays(cur, 1); }
    weeks.push(row);
    if (cur > new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)) break;
  }

  return (
    <Card>
      <Table bordered responsive className="mb-0 text-center" style={{ tableLayout: "fixed" }}>
        <thead><tr>{WEEKDAYS.map((w) => <th key={w} className="small">{w}</th>)}</tr></thead>
        <tbody>
          {weeks.map((row, wi) => (
            <tr key={wi}>
              {row.map((day) => {
                const inMonth = day.getMonth() === anchor.getMonth();
                const evs = byDay.get(iso(day)) || [];
                const top = evs.length ? highestPriority(evs) : null;
                return (
                  <td key={iso(day)} style={{ height: 90, verticalAlign: "top", opacity: inMonth ? 1 : 0.4, background: top ? `${PRIORITY_META[top].hex}22` : undefined }}>
                    <div className="d-flex justify-content-between align-items-center">
                      <span className="small text-muted">{day.getDate()}</span>
                      {evs.length > 0 && <Badge bg="secondary" pill>{evs.length}</Badge>}
                    </div>
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {evs.slice(0, 3).map((e, i) => <Chip key={i} e={e} conflict={conflicts.has(conflictKey(e))} onClick={() => onSelect(e)} />)}
                      {evs.length > 3 && <span className="small text-muted" style={{ cursor: "pointer" }} onClick={() => onSelect(evs[3])}>+{evs.length - 3}</span>}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function WeekView({ anchor, events, conflicts, onSelect }: { anchor: Date; events: SgMapEvent[]; conflicts: Set<string>; onSelect: (e: SgMapEvent) => void }) {
  const s = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(s, i));
  return (
    <Card>
      <div className="row g-0">
        {days.map((day) => {
          const evs = events.filter((e) => e.event_date === iso(day));
          return (
            <div key={iso(day)} className="col border p-2" style={{ minHeight: 160 }}>
              <div className="small fw-medium mb-2">{WEEKDAYS[(day.getDay() + 6) % 7]} {ddmm(day)}</div>
              <div className="d-flex flex-column gap-1">
                {evs.length === 0 && <span className="small text-muted">—</span>}
                {evs.map((e, i) => <Chip key={i} e={e} conflict={conflicts.has(conflictKey(e))} onClick={() => onSelect(e)} />)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function DayView({ events, conflicts, onSelect }: { events: SgMapEvent[]; conflicts: Set<string>; onSelect: (e: SgMapEvent) => void }) {
  return (
    <Card>
      <Table responsive hover className="mb-0 align-middle">
        <thead><tr><th></th><th>Equipamento</th><th>Cliente / Site</th><th>Evento</th><th>Status</th><th>Prioridade</th><th>Ação</th></tr></thead>
        <tbody>
          {events.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum evento no dia.</td></tr>}
          {events.map((e, i) => (
            <tr key={i} style={{ cursor: "pointer" }} onClick={() => onSelect(e)}>
              <td>{dot(e.color)}</td>
              <td className="fw-medium">{conflicts.has(conflictKey(e)) && <span title="Conflito de agenda">⚠ </span>}{equipmentLabel(e.equipment_tag, e.client_name)}</td>
              <td className="small">{e.client_name} / {e.site_name || "-"}</td>
              <td className="small">{e.event_kind}{e.alert_level ? ` · ${e.alert_level}` : ""}</td>
              <td className="small">{e.status}</td>
              <td><span className="badge" style={{ background: PRIORITY_META[e.priority].hex, color: PRIORITY_META[e.priority].text }}>{PRIORITY_META[e.priority].label}</span></td>
              <td className="small text-muted">{e.action_needed}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function EventCard({ e, conflict, onHide }: { e: SgMapEvent; conflict: boolean; onHide: () => void }) {
  const origin = originOf(e);
  const qc = useQueryClient();
  // Item 1/2/3 — Enviar OM (só para OM agendada) → cria/reabre a OS no Service Report.
  const canSend = e.event_kind === "om_manutencao" && e.status === "agendada";
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<{ rsOrderId: number; rsOrderCode: string; reused: boolean } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => sendOrderToReportService(e.ref_id),
    onSuccess: (r) => {
      setSent(r); setSendError(null); setConfirming(false);
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "map-events"] });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "alerts"] });
    },
    onError: (err) => setSendError((err as Error).message)
  });
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="d-flex justify-content-between gap-3 py-1 border-bottom">
      <span className="text-muted small">{k}</span><span className="small text-end">{v}</span>
    </div>
  );
  return (
    <Modal show onHide={onHide}>
      <Modal.Header closeButton>
        <Modal.Title className="d-flex align-items-center gap-2 h6 mb-0">{dot(e.color, 12)} {e.title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {conflict && <Alert variant="warning" className="py-2">⚠ Conflito de agenda: há outra atividade neste equipamento na mesma data.</Alert>}
        <Row k="Cliente" v={e.client_name} />
        <Row k="Site" v={e.site_name || "—"} />
        <Row k="Área" v={e.area_name || "—"} />
        <Row k="Equipamento" v={equipmentLabel(e.equipment_tag, e.client_name)} />
        <Row k="Data" v={formatDate(e.event_date)} />
        <Row k="Tipo" v={e.event_kind} />
        <Row k="Status" v={e.status} />
        <Row k="Criticidade" v={e.criticality} />
        <Row k="Prioridade" v={<span className="badge" style={{ background: PRIORITY_META[e.priority].hex, color: PRIORITY_META[e.priority].text }}>{PRIORITY_META[e.priority].label}</span>} />
        <Row k="Vencimento" v={e.alert_level ? `${e.alert_level} (${e.days_to_due}d)` : "—"} />
        <Row k="Responsável" v={e.responsible || "—"} />
        <Row k="Ação recomendada" v={e.action_needed} />
        {sent && (
          <Alert variant="success" className="py-2 mt-3 mb-0">
            OS {sent.reused ? "já existente" : "criada"} no Service Report: <strong>{sent.rsOrderCode || `#${sent.rsOrderId}`}</strong>.
          </Alert>
        )}
        {sendError && <Alert variant="danger" className="py-2 mt-3 mb-0">{sendError}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        {canSend && sent && <Link to={`/orders/${sent.rsOrderId}/editor`} className="btn btn-primary btn-sm">Abrir OS</Link>}
        {canSend && !sent && !confirming && <Button variant="success" size="sm" onClick={() => setConfirming(true)}>Enviar OM</Button>}
        {canSend && !sent && confirming && (
          <>
            <span className="small text-muted me-auto">Criar OS no Service Report e vincular o equipamento?</span>
            <Button variant="success" size="sm" onClick={() => send.mutate()} disabled={send.isPending}>{send.isPending ? "Enviando…" : "Confirmar envio"}</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => setConfirming(false)}>Cancelar</Button>
          </>
        )}
        {origin.to ? <Link to={origin.to} className="btn btn-outline-primary btn-sm">{origin.label}</Link> : <span className="small text-muted">{origin.label}</span>}
        <Button variant="secondary" size="sm" onClick={onHide}>Fechar</Button>
      </Modal.Footer>
    </Modal>
  );
}

// Edição das regras de vencimento configuráveis (A.9 / Fatia 10.6).
function AlertRulesModal({ onHide }: { onHide: () => void }) {
  const qc = useQueryClient();
  const rulesQuery = useQuery({ queryKey: ["sentinelgrid", "alert-rules"], queryFn: listAlertRules });
  const [draft, setDraft] = useState<Record<string, SgAlertRule>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rulesQuery.data) setDraft(Object.fromEntries(rulesQuery.data.map((r) => [r.criticality, { ...r }])));
  }, [rulesQuery.data]);

  const save = useMutation({
    mutationFn: (r: SgAlertRule) => updateAlertRule(r.criticality, {
      firstAlertDays: r.first_alert_days, criticalAlertDays: r.critical_alert_days, criticalAfterDue: r.critical_after_due
    }),
    onSuccess: () => {
      setError(null);
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "alert-rules"] });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "map-events"] });
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "map-summary"] });
    },
    onError: (e) => setError((e as Error).message)
  });

  const rows = Object.values(draft);
  const patch = (crit: string, field: keyof SgAlertRule, value: number | boolean) =>
    setDraft((d) => ({ ...d, [crit]: { ...d[crit], [field]: value } }));

  return (
    <Modal show onHide={onHide} size="lg">
      <Modal.Header closeButton><Modal.Title className="h6 mb-0">Regras de vencimento (por criticidade)</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-muted small">
          Janelas de alerta antes do vencimento. <strong>1º alerta</strong> pinta a manutenção de amarelo (próxima);
          <strong> alerta crítico</strong> pinta de vermelho. "Crítico só após vencimento" cobre o caso da criticidade baixa.
        </p>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {rulesQuery.isLoading ? (
          <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>
        ) : (
          <Table responsive className="align-middle mb-0">
            <thead><tr><th>Criticidade</th><th>1º alerta (dias)</th><th>Alerta crítico (dias)</th><th>Crítico só após venc.</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.criticality}>
                  <td className="fw-medium">{CRIT_LABEL[r.criticality] || r.criticality}</td>
                  <td style={{ maxWidth: 120 }}>
                    <Form.Control size="sm" type="number" min={0} value={r.first_alert_days}
                      onChange={(e) => patch(r.criticality, "first_alert_days", Number(e.target.value))} />
                  </td>
                  <td style={{ maxWidth: 120 }}>
                    <Form.Control size="sm" type="number" min={0} value={r.critical_alert_days}
                      onChange={(e) => patch(r.criticality, "critical_alert_days", Number(e.target.value))} />
                  </td>
                  <td>
                    <Form.Check type="switch" checked={r.critical_after_due}
                      onChange={(e) => patch(r.criticality, "critical_after_due", e.target.checked)} />
                  </td>
                  <td className="text-end">
                    <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(r)}>Salvar</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer><Button variant="secondary" size="sm" onClick={onHide}>Fechar</Button></Modal.Footer>
    </Modal>
  );
}

function Legend() {
  return (
    <Card>
      <Card.Body className="d-flex flex-wrap gap-3">
        {(Object.keys(COLOR_LABEL) as SgCalendarColor[]).map((c) => (
          <span key={c} className="d-flex align-items-center gap-2 small">{dot(c)} {COLOR_LABEL[c]}</span>
        ))}
        <span className="d-flex align-items-center gap-2 small"><span style={{ border: "2px solid #111", borderRadius: 4, padding: "0 4px" }}>⚠</span> Conflito de agenda</span>
      </Card.Body>
    </Card>
  );
}

export default function CalendarPage() {
  const [view, setView] = useState<View>("mes");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [mode, setMode] = useState<Mode>("cliente");
  const [showFilters, setShowFilters] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [selected, setSelected] = useState<SgMapEvent | null>(null);

  // Filtros (A.11).
  const [clientId, setClientId] = useState<number | "">("");
  const [siteId, setSiteId] = useState<number | "">("");
  const [areaId, setAreaId] = useState<number | "">("");
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [equipmentTypeId, setEquipmentTypeId] = useState<number | "">("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [status, setStatus] = useState("");
  const [criticality, setCriticality] = useState("");
  const [responsible, setResponsible] = useState("");
  const [onlyCriticalRec, setOnlyCriticalRec] = useState(false);
  const [onlyPendingApproval, setOnlyPendingApproval] = useState(false);
  const [onlyPendingReport, setOnlyPendingReport] = useState(false);

  const range = useMemo(() => computeRange(view, anchor), [view, anchor]);

  const filters: MapFilters = {
    from: range.from,
    to: range.to,
    clientId: clientId === "" ? undefined : clientId,
    siteId: siteId === "" ? undefined : siteId,
    areaId: areaId === "" ? undefined : areaId,
    equipmentId: mode === "equipamento" && equipmentId !== "" ? equipmentId : undefined,
    equipmentTypeId: equipmentTypeId === "" ? undefined : equipmentTypeId,
    maintenanceType: maintenanceType || undefined,
    status: status || undefined,
    criticality: criticality || undefined,
    responsible: responsible || undefined,
    onlyCriticalRec,
    onlyPendingApproval,
    onlyPendingReport
  };

  const clients = useQuery({ queryKey: ["sentinelgrid", "clients", "map"], queryFn: () => listClients({ pageSize: 200 }) });
  const sites = useQuery({ queryKey: ["sentinelgrid", "sites", "map", clientId], queryFn: () => listSites({ clientId: clientId === "" ? undefined : clientId, pageSize: 200 }) });
  const areas = useQuery({ queryKey: ["sentinelgrid", "areas", "map", siteId], queryFn: () => listAreas({ siteId: siteId === "" ? undefined : siteId, clientId: clientId === "" ? undefined : clientId, pageSize: 200 }) });
  const equipment = useQuery({ queryKey: ["sentinelgrid", "equipment", "map"], queryFn: () => listEquipment({ pageSize: 300 }) });
  const equipmentTypes = useQuery({ queryKey: ["sentinelgrid", "equipment-types", "map"], queryFn: () => listEquipmentTypes() });

  const eventsQuery = useQuery({ queryKey: ["sentinelgrid", "map-events", filters], queryFn: () => listMapEvents(filters) });
  const summaryQuery = useQuery({ queryKey: ["sentinelgrid", "map-summary", filters], queryFn: () => getMapSummary(filters) });

  // Alertas de manutenção: popup ao abrir o calendário (some por 24h via Redis).
  const qcAlerts = useQueryClient();
  const [alertDismissed, setAlertDismissed] = useState(false);
  const alertsQuery = useQuery({ queryKey: ["sentinelgrid", "alerts"], queryFn: () => listAlerts() });
  const ackQuery = useQuery({ queryKey: ["sentinelgrid", "alerts", "ack"], queryFn: getAlertAck });
  const ackMutation = useMutation({
    mutationFn: ackAlerts,
    onSuccess: () => { setAlertDismissed(true); qcAlerts.invalidateQueries({ queryKey: ["sentinelgrid", "alerts", "ack"] }); }
  });
  const alertItems = alertsQuery.data?.alerts || [];
  const showAlertPopup = !alertDismissed && !!ackQuery.data && !ackQuery.data.acknowledged && (alertsQuery.data?.total ?? 0) > 0;

  const events = eventsQuery.data?.events || [];
  const summary = summaryQuery.data;
  const conflicts = useMemo(() => buildConflicts(events), [events]);
  const equipList = (equipment.data?.equipment || []).filter((e) => (clientId === "" || Number(e.client_id) === clientId) && (siteId === "" || Number(e.site_id) === siteId));

  const onClient = (v: string) => { setClientId(v ? Number(v) : ""); setSiteId(""); setAreaId(""); setEquipmentId(""); };
  const onSite = (v: string) => { setSiteId(v ? Number(v) : ""); setAreaId(""); setEquipmentId(""); };

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid · Mapa Calendário</h2>
          <p className="text-muted mb-0 small">Planejamento, vencimento e risco por cliente e equipamento.</p>
        </div>
        <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
      </div>

      <Card>
        <Card.Body className="d-flex flex-wrap gap-3 align-items-end">
          <div>
            <div className="small text-muted mb-1">Período</div>
            <ButtonGroup size="sm">
              {(["ano", "mes", "semana", "dia"] as View[]).map((v) => (
                <Button key={v} variant={view === v ? "primary" : "outline-primary"} onClick={() => setView(v)} className="text-capitalize">{v}</Button>
              ))}
            </ButtonGroup>
          </div>
          <div>
            <div className="small text-muted mb-1">Navegação</div>
            <ButtonGroup size="sm">
              <Button variant="outline-secondary" onClick={() => setAnchor((a) => step(view, a, -1))}>‹</Button>
              <Button variant="outline-secondary" disabled style={{ minWidth: 140 }}>{rangeLabel(view, anchor)}</Button>
              <Button variant="outline-secondary" onClick={() => setAnchor((a) => step(view, a, 1))}>›</Button>
            </ButtonGroup>
            <Button size="sm" variant="link" className="ms-1" onClick={() => setAnchor(new Date())}>Hoje</Button>
          </div>
          <div>
            <div className="small text-muted mb-1">Modo</div>
            <ButtonGroup size="sm">
              <Button variant={mode === "cliente" ? "primary" : "outline-primary"} onClick={() => setMode("cliente")}>Por cliente</Button>
              <Button variant={mode === "equipamento" ? "primary" : "outline-primary"} onClick={() => setMode("equipamento")}>Por equipamento</Button>
            </ButtonGroup>
          </div>
          <Button size="sm" variant={showFilters ? "secondary" : "outline-secondary"} onClick={() => setShowFilters((s) => !s)}>Filtros</Button>
          <Button size="sm" variant="outline-secondary" onClick={() => setShowRules(true)}>Regras de vencimento</Button>
        </Card.Body>

        {showFilters && (
          <Card.Body className="border-top row g-2">
            <div className="col-md-3">
              <Form.Label className="small">Cliente</Form.Label>
              <Form.Select size="sm" value={clientId} onChange={(e) => onClient(e.target.value)}>
                <option value="">Todos</option>
                {(clients.data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Site</Form.Label>
              <Form.Select size="sm" value={siteId} onChange={(e) => onSite(e.target.value)}>
                <option value="">Todos</option>
                {(sites.data?.sites || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Área</Form.Label>
              <Form.Select size="sm" value={areaId} onChange={(e) => setAreaId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Todas</option>
                {(areas.data?.areas || []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Form.Select>
            </div>
            {mode === "equipamento" && (
              <div className="col-md-3">
                <Form.Label className="small">Equipamento</Form.Label>
                <Form.Select size="sm" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Selecione…</option>
                  {equipList.map((e) => <option key={e.id} value={e.id}>{e.tag || e.serial_number || `#${e.id}`}</option>)}
                </Form.Select>
              </div>
            )}
            <div className="col-md-3">
              <Form.Label className="small">Tipo de equipamento</Form.Label>
              <Form.Select size="sm" value={equipmentTypeId} onChange={(e) => setEquipmentTypeId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Todos</option>
                {(equipmentTypes.data || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Tipo de manutenção</Form.Label>
              <Form.Select size="sm" value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value)}>
                <option value="">Todos</option>
                {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Status</Form.Label>
              <Form.Select size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Criticidade</Form.Label>
              <Form.Select size="sm" value={criticality} onChange={(e) => setCriticality(e.target.value)}>
                <option value="">Todas</option>
                {CRITICALITY.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label className="small">Responsável</Form.Label>
              <Form.Control size="sm" value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="nome…" />
            </div>
            <div className="col-md-9 d-flex align-items-end gap-4 flex-wrap">
              <Form.Check type="switch" label="Só recomendação crítica" checked={onlyCriticalRec} onChange={(e) => setOnlyCriticalRec(e.target.checked)} />
              <Form.Check type="switch" label="Só aprovação pendente" checked={onlyPendingApproval} onChange={(e) => setOnlyPendingApproval(e.target.checked)} />
              <Form.Check type="switch" label="Só relatório pendente" checked={onlyPendingReport} onChange={(e) => setOnlyPendingReport(e.target.checked)} />
            </div>
          </Card.Body>
        )}
      </Card>

      {summary && (
        <Card>
          <Card.Body className="d-flex flex-wrap gap-3 align-items-center">
            <span className="d-flex align-items-center gap-2">
              <strong>Status geral:</strong>
              <span className="badge" style={{ background: COLOR_HEX[GENERAL_STATUS_META[summary.general_status].color] }}>{GENERAL_STATUS_META[summary.general_status].label}</span>
            </span>
            <span className="text-muted small">Total: <strong>{summary.totals.total}</strong></span>
            <span className="text-muted small">Vencidas: <strong className="text-danger">{summary.totals.overdue}</strong></span>
            <span className="text-muted small">Próximas: <strong>{summary.totals.upcoming}</strong></span>
            <span className="text-muted small">Corretivas: <strong>{summary.totals.corrective_open}</strong></span>
            <span className="text-muted small">Aprovações: <strong>{summary.totals.pending_approval}</strong></span>
            <span className="text-muted small">Rec. críticas: <strong>{summary.totals.critical_rec}</strong></span>
            <span className="text-muted small">Relatórios: <strong>{summary.totals.pending_report}</strong></span>
            <span className="text-muted small">Restritos: <strong>{summary.totals.restricted_equip}</strong></span>
          </Card.Body>
        </Card>
      )}

      {eventsQuery.isLoading ? (
        <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>
      ) : eventsQuery.error ? (
        <Alert variant="danger">{(eventsQuery.error as Error).message}</Alert>
      ) : mode === "equipamento" && equipmentId === "" ? (
        <Alert variant="info" className="mb-0">Selecione um equipamento (em Filtros) para ver o mapa focado.</Alert>
      ) : (
        <>
          {view === "ano" && <AnnualView year={anchor.getFullYear()} events={events} />}
          {view === "mes" && <MonthView anchor={anchor} events={events} conflicts={conflicts} onSelect={setSelected} />}
          {view === "semana" && <WeekView anchor={anchor} events={events} conflicts={conflicts} onSelect={setSelected} />}
          {view === "dia" && <DayView events={events} conflicts={conflicts} onSelect={setSelected} />}
        </>
      )}

      {mode === "cliente" && summary && summary.clients.length > 0 && (
        <Card>
          <Card.Header>Resumo por cliente</Card.Header>
          <Table responsive hover className="mb-0 align-middle">
            <thead><tr><th>Cliente</th><th>Status</th><th>Total</th><th>Vencidas</th><th>Próximas</th><th>Corretivas</th><th>Aprov.</th><th>Rec. crít.</th><th>Relat.</th><th>Restritos</th></tr></thead>
            <tbody>
              {summary.clients.map((c) => (
                <tr key={c.client_id} style={{ cursor: "pointer" }} onClick={() => setClientId(c.client_id)}>
                  <td className="fw-medium">{c.client_name}</td>
                  <td><span className="badge" style={{ background: COLOR_HEX[GENERAL_STATUS_META[c.general_status].color] }}>{GENERAL_STATUS_META[c.general_status].label}</span></td>
                  <td>{c.total}</td>
                  <td className={c.overdue ? "text-danger fw-medium" : "text-muted"}>{c.overdue}</td>
                  <td>{c.upcoming}</td>
                  <td>{c.corrective_open}</td>
                  <td>{c.pending_approval}</td>
                  <td>{c.critical_rec}</td>
                  <td>{c.pending_report}</td>
                  <td>{c.restricted_equip}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Legend />

      {selected && <EventCard e={selected} conflict={conflicts.has(conflictKey(selected))} onHide={() => setSelected(null)} />}
      {showRules && <AlertRulesModal onHide={() => setShowRules(false)} />}

      <Modal show={showAlertPopup} onHide={() => setAlertDismissed(true)}>
        <Modal.Header closeButton>
          <Modal.Title className="h6 mb-0">⚠ Alertas de manutenção ({alertsQuery.data?.total ?? 0})</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="small text-muted mb-2">Ordens e pendências que requerem atenção:</p>
          <div className="d-flex flex-column" style={{ maxHeight: 320, overflowY: "auto" }}>
            {alertItems.slice(0, 10).map((e, i) => (
              <div key={i} className="d-flex align-items-center gap-2 small border-bottom py-1">
                <span className="badge" style={{ background: PRIORITY_META[e.priority].hex, color: PRIORITY_META[e.priority].text }}>{PRIORITY_META[e.priority].label}</span>
                <span className="fw-medium">{equipmentLabel(e.equipment_tag, e.client_name)}</span>
                <span className="text-muted text-truncate">{EVENT_KIND_LABEL[e.event_kind] || e.event_kind}</span>
                <span className="ms-auto text-nowrap">{formatDate(e.event_date)}</span>
              </div>
            ))}
            {alertItems.length > 10 && <div className="small text-muted mt-1">+{alertItems.length - 10} outros…</div>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Link to="/sentinelgrid/alerts" className="btn btn-sm btn-outline-primary" onClick={() => setAlertDismissed(true)}>Ver todos</Link>
          <Button size="sm" onClick={() => ackMutation.mutate()} disabled={ackMutation.isPending}>
            {ackMutation.isPending ? "…" : "Ciente (não avisar por 24h)"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
