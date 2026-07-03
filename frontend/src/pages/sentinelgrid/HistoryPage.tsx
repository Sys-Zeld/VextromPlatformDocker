import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Form, Spinner, Table } from "react-bootstrap";
import { listEquipment } from "../../api/sentinelgrid/equipment";
import { listHistory } from "../../api/sentinelgrid/operations";

export default function HistoryPage() {
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const equipment = useQuery({ queryKey: ["sentinelgrid", "equipment", "history-select"], queryFn: () => listEquipment({ pageSize: 100 }) });
  const history = useQuery({
    queryKey: ["sentinelgrid", "history", equipmentId],
    queryFn: () => listHistory({ equipmentId: equipmentId === "" ? undefined : equipmentId })
  });
  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h2 className="h5 mb-1">SentinelGrid - Historico</h2>
        <p className="text-muted mb-0 small">Prontuario tecnico consolidado por equipamento.</p>
      </div>
      <Card><Card.Body>
        <Form.Label>Equipamento</Form.Label>
        <Form.Select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Todos</option>
          {(equipment.data?.equipment || []).map((e) => <option key={e.id} value={e.id}>{e.tag || e.serial_number || `#${e.id}`} - {e.client_name}</option>)}
        </Form.Select>
      </Card.Body></Card>
      {history.isLoading ? <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</div> : history.error ? (
        <Alert variant="danger">{(history.error as Error).message}</Alert>
      ) : (
        <Card>
          <Table responsive hover className="mb-0 align-middle">
            <thead><tr><th>Data</th><th>Equipamento</th><th>Tipo</th><th>Resumo</th><th>Ator</th></tr></thead>
            <tbody>
              {(history.data?.history || []).length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum historico.</td></tr>}
              {(history.data?.history || []).map((h) => (
                <tr key={h.id}><td>{new Date(h.occurred_at).toLocaleString()}</td><td>{h.equipment_tag || `#${h.equipment_id}`}</td><td>{h.event_kind}</td><td>{h.summary}</td><td>{h.actor || "-"}</td></tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
