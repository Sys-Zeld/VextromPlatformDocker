import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, ButtonGroup, Card, Form, Spinner } from "react-bootstrap";
import { useHref, useLocation, useNavigate } from "react-router-dom";
import { listClients } from "../../api/sentinelgrid/clients";
import { listSites } from "../../api/sentinelgrid/sites";
import { listEquipment } from "../../api/sentinelgrid/equipment";
import { listMapEvents } from "../../api/sentinelgrid/calendarMap";
import { equipmentLabel } from "../../utils/format";
import { listTechnicianAgenda, listTechnicians } from "../../api/sentinelgrid/technicians";

type GroupMode = "equipment" | "client_site" | "technician";
type PeriodView = "year" | "month" | "day";
type ScheduleTask = { key: string; startDate: string; endDate: string; title: string; priority: string; orderId?: number };
type ScheduleRow = { key: string; title: string; subtitle: string; tasks: ScheduleTask[] };

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const PRIORITY_LABEL: Record<string, string> = {
  emergencial: "Emergencial", critico: "Crítico", importante: "Importante", atencao: "Atenção", informativo: "Informativo"
};

const iso = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

const queryId = (query: URLSearchParams, key: string): number | "" => {
  const value = Number(query.get(key));
  return Number.isInteger(value) && value > 0 ? value : "";
};

export default function SchedulePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fullscreenHref = useHref("/sentinelgrid/schedule/fullscreen");
  const standalone = location.pathname.endsWith("/fullscreen");
  const initialQuery = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const currentYear = new Date().getFullYear();
  const queryYear = Number(initialQuery.get("year"));
  const queryMonth = Number(initialQuery.get("month"));
  const queryPeriod = initialQuery.get("period");
  const queryMode = initialQuery.get("mode");
  const [year, setYear] = useState(Number.isInteger(queryYear) && queryYear >= 1900 && queryYear <= 2200 ? queryYear : currentYear);
  const [periodView, setPeriodView] = useState<PeriodView>(queryPeriod === "month" || queryPeriod === "day" ? queryPeriod : "year");
  const [month, setMonth] = useState(Number.isInteger(queryMonth) && queryMonth >= 1 && queryMonth <= 12 ? queryMonth : new Date().getMonth() + 1);
  const [mode, setMode] = useState<GroupMode>(queryMode === "client_site" || queryMode === "technician" ? queryMode : "equipment");
  const [clientId, setClientId] = useState<number | "">(() => queryId(initialQuery, "clientId"));
  const [siteId, setSiteId] = useState<number | "">(() => queryId(initialQuery, "siteId"));
  const [equipmentId, setEquipmentId] = useState<number | "">(() => queryId(initialQuery, "equipmentId"));
  const [technicianId, setTechnicianId] = useState<number | "">(() => queryId(initialQuery, "technicianId"));

  const monthLastDay = new Date(year, month, 0).getDate();
  const filters = useMemo(() => ({
    from: periodView === "year" ? iso(year, 1, 1) : iso(year, month, 1),
    to: periodView === "year" ? iso(year, 12, 31) : iso(year, month, monthLastDay),
    clientId: clientId === "" ? undefined : clientId,
    siteId: siteId === "" ? undefined : siteId,
    equipmentId: equipmentId === "" ? undefined : equipmentId
  }), [periodView, year, month, monthLastDay, clientId, siteId, equipmentId]);

  const periodColumns = useMemo(() => {
    if (periodView === "year") {
      return MONTHS.map((label, index) => {
        const start = iso(year, index + 1, 1); const end = iso(year, index + 1, new Date(year, index + 1, 0).getDate());
        return { key: `month-${index + 1}`, label, matches: (task: ScheduleTask) => task.startDate <= end && task.endDate >= start };
      });
    }
    if (periodView === "day") {
      return Array.from({ length: monthLastDay }, (_, index) => {
        const date = iso(year, month, index + 1);
        return { key: `day-${date}`, label: String(index + 1).padStart(2, "0"), matches: (task: ScheduleTask) => task.startDate <= date && task.endDate >= date };
      });
    }
    const count = Math.ceil(monthLastDay / 7);
    return Array.from({ length: count }, (_, index) => {
      const start = index * 7 + 1;
      const end = Math.min(monthLastDay, start + 6);
      return {
        key: `week-${index + 1}`,
        label: `Semana ${index + 1} (${String(start).padStart(2, "0")}–${String(end).padStart(2, "0")})`,
        matches: (task: ScheduleTask) => task.startDate <= iso(year, month, end) && task.endDate >= iso(year, month, start)
      };
    });
  }, [periodView, monthLastDay, year, month]);

  const eventsQuery = useQuery({ queryKey: ["sentinelgrid", "schedule", filters], queryFn: () => listMapEvents(filters) });
  const clientsQuery = useQuery({ queryKey: ["sentinelgrid", "clients", "schedule"], queryFn: () => listClients({ pageSize: 100 }) });
  const sitesQuery = useQuery({ queryKey: ["sentinelgrid", "sites", "schedule", clientId], queryFn: () => listSites({ clientId: clientId === "" ? undefined : clientId, pageSize: 100 }) });
  const equipmentQuery = useQuery({ queryKey: ["sentinelgrid", "equipment", "schedule", clientId], queryFn: () => listEquipment({ clientId: clientId === "" ? undefined : clientId, pageSize: 100 }) });
  const techniciansQuery = useQuery({ queryKey: ["sentinelgrid", "technicians"], queryFn: listTechnicians });
  const technicianAgendaQuery = useQuery({
    queryKey: ["sentinelgrid", "schedule-technicians", filters.from, filters.to, technicianId],
    queryFn: () => listTechnicianAgenda({ from: filters.from, to: filters.to, technicianId: technicianId === "" ? undefined : technicianId }),
    enabled: mode === "technician"
  });

  const rows = useMemo<ScheduleRow[]>(() => {
    const grouped = new Map<string, ScheduleRow>();
    if (mode === "technician") {
      const agendaItems = (technicianAgendaQuery.data?.agenda || []).filter((item) =>
        (clientId === "" || item.client_id === clientId) &&
        (siteId === "" || item.site_id === siteId) &&
        (equipmentId === "" || item.equipment_id === equipmentId)
      );
      for (const item of agendaItems) {
        const key = `technician-${item.technician_id}`;
        if (!grouped.has(key)) grouped.set(key, { key, title: item.technician_name, subtitle: "Agenda de ordens de manutenção", tasks: [] });
        grouped.get(key)!.tasks.push({
          key: `${item.order_id}-${item.technician_id}`, startDate: item.start_date, endDate: item.end_date,
          title: `${item.order_number} · ${item.equipment_tag || `#${item.equipment_id}`} · ${item.execution_days} dia(s)`,
          priority: item.priority || "informativo", orderId: item.order_id
        });
      }
      return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
    }
    for (const event of eventsQuery.data?.events ?? []) {
      const key = mode === "equipment" ? `equipment-${event.equipment_id}` : `scope-${event.client_id}-${event.site_id ?? 0}`;
      if (!grouped.has(key)) {
        grouped.set(key, mode === "equipment"
          ? {
              key,
              title: equipmentLabel(event.equipment_tag, event.client_name) || `Equipamento #${event.equipment_id}`,
              subtitle: `${event.client_name} / ${event.site_name || "-"} / ${event.area_name || "-"}`,
              tasks: []
            }
          : {
              key,
              title: event.client_name,
              subtitle: event.site_name || "Sem site",
              tasks: []
            });
      }
      grouped.get(key)!.tasks.push({
        key: `${event.ref_table}-${event.ref_id}-${event.event_date}`,
        startDate: event.event_date, endDate: event.event_date, title: event.title,
        priority: event.priority, orderId: event.ref_table === "sg_maintenance_orders" ? event.ref_id : undefined
      });
    }
    return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [eventsQuery.data, technicianAgendaQuery.data, mode, clientId, siteId, equipmentId]);

  const onClient = (value: string) => { setClientId(value ? Number(value) : ""); setSiteId(""); setEquipmentId(""); };
  const onSite = (value: string) => { setSiteId(value ? Number(value) : ""); setEquipmentId(""); };
  const availableEquipment = (equipmentQuery.data?.equipment ?? []).filter((item) => siteId === "" || Number(item.site_id) === siteId);

  const openTask = (task: ScheduleTask) => { if (task.orderId) navigate(`/sentinelgrid/maintenance-orders?order=${task.orderId}`); };
  const loading = mode === "technician" ? technicianAgendaQuery.isLoading : eventsQuery.isLoading;
  const queryError = mode === "technician" ? technicianAgendaQuery.error : eventsQuery.error;
  const periodTitle = periodView === "year" ? String(year) : `${MONTHS[month - 1]} / ${year}`;
  const periodDescription = periodView === "year" ? "anual" : periodView === "month" ? "mensal" : "diário";

  useEffect(() => {
    if (!standalone) return undefined;
    const previousTitle = document.title;
    document.title = `Cronograma ${periodTitle} - SentinelGrid`;
    return () => { document.title = previousTitle; };
  }, [periodTitle, standalone]);

  const currentFilterQuery = useMemo(() => {
    const query = new URLSearchParams({
      period: periodView,
      year: String(year),
      month: String(month),
      mode
    });
    if (clientId !== "") query.set("clientId", String(clientId));
    if (siteId !== "") query.set("siteId", String(siteId));
    if (equipmentId !== "") query.set("equipmentId", String(equipmentId));
    if (technicianId !== "") query.set("technicianId", String(technicianId));
    return query.toString();
  }, [periodView, year, month, mode, clientId, siteId, equipmentId, technicianId]);

  useEffect(() => {
    if (!standalone) return;
    const nextSearch = `?${currentFilterQuery}`;
    if (location.search === nextSearch) return;
    navigate({ pathname: location.pathname, search: nextSearch }, { replace: true });
  }, [currentFilterQuery, location.pathname, location.search, navigate, standalone]);

  const openFullscreen = () => {
    window.open(`${fullscreenHref}?${currentFilterQuery}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`d-flex flex-column gap-3 sg-schedule-page${standalone ? " sg-schedule-page--standalone" : ""}`}>
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap sg-schedule-print-header">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Cronograma {periodTitle}</h2>
          <p className="text-muted small mb-0">Planejamento {periodDescription} por equipamento, Cliente/Site ou técnico.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap sg-no-print">
          {!standalone && <Button variant="primary" size="sm" onClick={openFullscreen}>
            <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 18 }}>open_in_new</span>Abrir em tela cheia
          </Button>}
          <Button variant="outline-primary" size="sm" onClick={() => window.print()}>
            <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 18 }}>print</span>Imprimir cronograma
          </Button>
        </div>
      </div>

      <Card className="sg-no-print sg-schedule-filter-card">
        <Card.Body>
          <div className="row g-2 align-items-end sg-schedule-filters">
            <div className="col-md-2 sg-schedule-filter sg-schedule-filter--period">
              <Form.Label>Período</Form.Label>
              <ButtonGroup className="w-100">
                <Button size="sm" variant={periodView === "year" ? "primary" : "outline-primary"} onClick={() => setPeriodView("year")}>Ano</Button>
                <Button size="sm" variant={periodView === "month" ? "primary" : "outline-primary"} onClick={() => setPeriodView("month")}>Mês</Button>
                <Button size="sm" variant={periodView === "day" ? "primary" : "outline-primary"} onClick={() => setPeriodView("day")}>Dia</Button>
              </ButtonGroup>
            </div>
            <div className="col-md-2 sg-schedule-filter sg-schedule-filter--date">
              <Form.Label>Ano</Form.Label>
              <div className="d-flex gap-1">
                <Button size="sm" variant="outline-secondary" onClick={() => setYear((value) => value - 1)}>‹</Button>
                <Form.Control type="number" value={year} onChange={(event) => setYear(Number(event.target.value) || new Date().getFullYear())} />
                <Button size="sm" variant="outline-secondary" onClick={() => setYear((value) => value + 1)}>›</Button>
              </div>
            </div>
            {periodView !== "year" && <div className="col-md-2 sg-schedule-filter sg-schedule-filter--date">
              <Form.Label>Mês</Form.Label>
              <Form.Select value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</Form.Select>
            </div>}
            <div className="col-md-4 sg-schedule-filter sg-schedule-filter--group">
              <Form.Label>Organizar planilha por</Form.Label>
              <ButtonGroup className="w-100">
                <Button size="sm" variant={mode === "equipment" ? "primary" : "outline-primary"} onClick={() => setMode("equipment")}>Equipamento</Button>
                <Button size="sm" variant={mode === "client_site" ? "primary" : "outline-primary"} onClick={() => setMode("client_site")}>Cliente/Site</Button>
                <Button size="sm" variant={mode === "technician" ? "primary" : "outline-primary"} onClick={() => setMode("technician")}>Técnico</Button>
              </ButtonGroup>
            </div>
            <div className="col-md-2 sg-schedule-filter">
              <Form.Label>Cliente</Form.Label>
              <Form.Select value={clientId} onChange={(event) => onClient(event.target.value)}><option value="">Todos</option>{(clientsQuery.data?.clients ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Form.Select>
            </div>
            <div className="col-md-2 sg-schedule-filter">
              <Form.Label>Site</Form.Label>
              <Form.Select value={siteId} onChange={(event) => onSite(event.target.value)}><option value="">Todos</option>{(sitesQuery.data?.sites ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Form.Select>
            </div>
            <div className="col-md-3 sg-schedule-filter sg-schedule-filter--equipment">
              <Form.Label>Equipamento</Form.Label>
              <Form.Select value={equipmentId} onChange={(event) => setEquipmentId(event.target.value ? Number(event.target.value) : "")}><option value="">Todos</option>{availableEquipment.map((item) => <option key={item.id} value={item.id}>{equipmentLabel(item.tag, item.client_name) || `#${item.id}`}</option>)}</Form.Select>
            </div>
            {mode === "technician" && <div className="col-md-3 sg-schedule-filter">
              <Form.Label>Técnico</Form.Label>
              <Form.Select value={technicianId} onChange={(event) => setTechnicianId(event.target.value ? Number(event.target.value) : "")}><option value="">Todos</option>{(techniciansQuery.data?.technicians || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Form.Select>
            </div>}
          </div>
        </Card.Body>
      </Card>

      {loading ? <div className="text-muted"><Spinner animation="border" size="sm" /> Gerando cronograma...</div>
        : queryError ? <Alert variant="danger">{(queryError as Error).message}</Alert>
        : rows.length === 0 ? <Alert variant="secondary">Nenhuma atividade encontrada para os filtros e o período selecionado.</Alert>
        : (
          <Card className="sg-schedule-sheet-card">
            <div className="sg-schedule-scroll">
              <table className={`sg-schedule-sheet${periodView === "month" ? " sg-schedule-sheet--month" : ""}${periodView === "day" ? " sg-schedule-sheet--day" : ""}`}>
                <thead><tr><th className="sg-schedule-sheet__identity">{mode === "equipment" ? "Equipamento" : mode === "client_site" ? "Cliente / Site" : "Técnico"}</th>{periodColumns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <th className="sg-schedule-sheet__identity"><span>{row.title}</span><small>{row.subtitle}</small></th>
                      {periodColumns.map((column) => {
                        const columnTasks = row.tasks.filter(column.matches).sort((a, b) => a.startDate.localeCompare(b.startDate));
                        return <td key={column.key}>{columnTasks.map((task) => (
                          <button
                            key={`${task.key}-${column.key}`}
                            type="button"
                            className={`sg-schedule-task sg-schedule-task--${task.priority}${task.orderId ? " is-clickable" : ""}`}
                            onClick={() => openTask(task)}
                            title={`${task.title} - ${PRIORITY_LABEL[task.priority] || task.priority}`}
                          >
                            <span className="sg-schedule-task__date">{task.startDate.slice(8, 10)}</span>
                            <span className="sg-schedule-task__title">{task.title}</span>
                          </button>
                        ))}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
    </div>
  );
}
