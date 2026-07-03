import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Form, Spinner } from "react-bootstrap";
import { listClients } from "../../api/sentinelgrid/clients";
import { getDashboard } from "../../api/sentinelgrid/operations";

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <Card.Body>
        <div className="text-muted small">{label}</div>
        <div className="h3 mb-0">{value}</div>
      </Card.Body>
    </Card>
  );
}

export default function DashboardPage() {
  const [clientId, setClientId] = useState<number | "">("");
  const clients = useQuery({ queryKey: ["sentinelgrid", "clients"], queryFn: () => listClients() });
  const dashboard = useQuery({
    queryKey: ["sentinelgrid", "dashboard", clientId],
    queryFn: () => getDashboard({ clientId: clientId === "" ? undefined : clientId })
  });
  const data = dashboard.data;

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h2 className="h5 mb-1">SentinelGrid - Dashboard</h2>
        <p className="text-muted mb-0 small">Indicadores de manutencao, risco e rastreabilidade.</p>
      </div>
      <Card>
        <Card.Body className="row g-2 align-items-end">
          <div className="col-md-5">
            <Form.Label>Cliente</Form.Label>
            <Form.Select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Todos</option>
              {(clients.data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </div>
        </Card.Body>
      </Card>
      {dashboard.isLoading ? <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</div> : dashboard.error ? (
        <Alert variant="danger">{(dashboard.error as Error).message}</Alert>
      ) : (
        <div className="row g-3">
          <div className="col-md-4"><Kpi label="Equipamentos" value={data?.equipment ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Ordens totais" value={data?.orders.total ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Ordens concluidas" value={data?.orders.done ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Corretivas" value={data?.orders.corrective ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Vencidas no calendario" value={data?.overdue ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Equipamentos sem plano" value={data?.equipmentWithoutPlan ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Eventos/Alarmes" value={data?.events ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Relatorios associados" value={data?.associatedReports ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Recomendacoes abertas" value={data?.recommendations.open ?? 0} /></div>
          <div className="col-md-4"><Kpi label="Recomendacoes criticas" value={data?.recommendations.critical ?? 0} /></div>
        </div>
      )}
    </div>
  );
}
