import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { EVENT_KIND_LABEL, SgAlertPriority } from "../../api/sentinelgrid/calendarMap";
import { getAlertAck, listAlerts, resetAlertAck } from "../../api/sentinelgrid/alerts";
import PriorityBadge from "../../components/sentinelgrid/PriorityBadge";
import { equipmentLabel, formatDate } from "../../utils/format";

const PRIORITY_ORDER: SgAlertPriority[] = ["emergencial", "critico", "importante", "atencao"];

function vencLabel(level: string | null, days: number): string {
  if (level === "vencida") return `Vencida há ${Math.abs(days)}d`;
  if (level === "proxima" || level === "critica") return `Vence em ${days}d`;
  return "—";
}

export default function AlertsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "alerts"],
    queryFn: () => listAlerts()
  });
  const ackQuery = useQuery({ queryKey: ["sentinelgrid", "alerts", "ack"], queryFn: getAlertAck });
  const reset = useMutation({
    mutationFn: resetAlertAck,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "alerts", "ack"] })
  });

  const alerts = data?.alerts || [];
  const byPriority = data?.byPriority || {};
  const ack = ackQuery.data;
  const untilLabel = ack?.until ? new Date(ack.until).toLocaleString() : "";

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid · Alertas</h2>
          <p className="text-muted mb-0 small">Ordens e pendências de manutenção por prioridade.</p>
        </div>
        <Link to="/sentinelgrid/calendar" className="small">Ver no calendário →</Link>
      </div>

      {ack?.acknowledged && (
        <Alert variant="secondary" className="py-2 mb-0 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <span className="small">🔕 Popup de alertas silenciado por 24h{untilLabel && <> · até {untilLabel}</>}.</span>
          <Button size="sm" variant="outline-primary" disabled={reset.isPending} onClick={() => reset.mutate()}>
            {reset.isPending ? "Reativando…" : "Reativar aviso agora"}
          </Button>
        </Alert>
      )}

      <Card>
        <Card.Body className="d-flex flex-wrap gap-3 align-items-center">
          <span className="fw-medium">Total: {data?.total ?? 0}</span>
          {PRIORITY_ORDER.map((p) => (
            <span key={p} className="d-flex align-items-center gap-1 small">
              <PriorityBadge priority={p} />
              {byPriority[p] ?? 0}
            </span>
          ))}
        </Card.Body>
      </Card>

      {isLoading ? (
        <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>
      ) : error ? (
        <Alert variant="danger">{(error as Error).message}</Alert>
      ) : (
        <Card>
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr><th>Prioridade</th><th>Tipo</th><th>Equipamento</th><th>Cliente / Site / Área</th><th>Data</th><th>Vencimento</th><th>Ação</th></tr>
            </thead>
            <tbody>
              {alerts.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum alerta no momento. 🎉</td></tr>}
              {alerts.map((e, i) => (
                <tr key={`${e.ref_table}-${e.ref_id}-${i}`}>
                  <td><PriorityBadge priority={e.priority} /></td>
                  <td className="small">{EVENT_KIND_LABEL[e.event_kind] || e.event_kind}</td>
                  <td className="fw-medium">{equipmentLabel(e.equipment_tag, e.client_name)}</td>
                  <td className="small text-muted">{e.client_name} / {e.site_name || "-"} / {e.area_name || "-"}</td>
                  <td className="small">{formatDate(e.event_date)}</td>
                  <td className="small">{vencLabel(e.alert_level, e.days_to_due)}</td>
                  <td className="small text-muted">{e.action_needed}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
