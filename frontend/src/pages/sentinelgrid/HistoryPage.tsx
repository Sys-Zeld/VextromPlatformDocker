import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Form, Spinner, Table } from "react-bootstrap";
import { listClients } from "../../api/sentinelgrid/clients";
import { listSites } from "../../api/sentinelgrid/sites";
import { listEquipment } from "../../api/sentinelgrid/equipment";
import { listHistory } from "../../api/sentinelgrid/operations";
import { formatDate } from "../../utils/format";

export default function HistoryPage() {
  const [clientId, setClientId] = useState<number | "">("");
  const [siteId, setSiteId] = useState<number | "">("");
  const [equipmentId, setEquipmentId] = useState<number | "">("");

  const clients = useQuery({ queryKey: ["sentinelgrid", "clients", "history-select"], queryFn: () => listClients({ pageSize: 200 }) });
  const sites = useQuery({ queryKey: ["sentinelgrid", "sites", "history-select"], queryFn: () => listSites({ pageSize: 200 }) });
  const equipment = useQuery({ queryKey: ["sentinelgrid", "equipment", "history-select"], queryFn: () => listEquipment({ pageSize: 200 }) });

  const history = useQuery({
    queryKey: ["sentinelgrid", "history", clientId, siteId, equipmentId],
    queryFn: () => listHistory({
      clientId: clientId === "" ? undefined : clientId,
      siteId: siteId === "" ? undefined : siteId,
      equipmentId: equipmentId === "" ? undefined : equipmentId
    })
  });

  const sitesForClient = (sites.data?.sites || []).filter((s) => clientId === "" || Number(s.client_id) === clientId);
  const equipmentFiltered = (equipment.data?.equipment || []).filter(
    (e) => (clientId === "" || Number(e.client_id) === clientId) && (siteId === "" || Number(e.site_id) === siteId)
  );

  const onClient = (v: string) => { setClientId(v ? Number(v) : ""); setSiteId(""); setEquipmentId(""); };
  const onSite = (v: string) => { setSiteId(v ? Number(v) : ""); setEquipmentId(""); };

  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h2 className="h5 mb-1">SentinelGrid - Historico</h2>
        <p className="text-muted mb-0 small">Prontuario tecnico consolidado por equipamento.</p>
      </div>
      <Card><Card.Body>
        <div className="row g-3">
          <div className="col-md-4">
            <Form.Label>Cliente</Form.Label>
            <Form.Select value={clientId} onChange={(e) => onClient(e.target.value)}>
              <option value="">Todos</option>
              {(clients.data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Label>Site</Form.Label>
            <Form.Select value={siteId} onChange={(e) => onSite(e.target.value)}>
              <option value="">Todos</option>
              {sitesForClient.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Label>Equipamento</Form.Label>
            <Form.Select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Todos</option>
              {equipmentFiltered.map((e) => <option key={e.id} value={e.id}>{e.tag || e.serial_number || `#${e.id}`}{e.site_name ? ` — ${e.site_name}` : ""}</option>)}
            </Form.Select>
          </div>
        </div>
      </Card.Body></Card>
      {history.isLoading ? <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</div> : history.error ? (
        <Alert variant="danger">{(history.error as Error).message}</Alert>
      ) : (
        <Card>
          <Table responsive hover className="mb-0 align-middle">
            <thead><tr><th>Data</th><th>Equipamento</th><th>Cliente</th><th>Site</th><th>Tipo</th><th>Resumo</th><th>Ator</th></tr></thead>
            <tbody>
              {(history.data?.history || []).length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum historico.</td></tr>}
              {(history.data?.history || []).map((h) => (
                <tr key={h.id}>
                  <td>{formatDate(h.occurred_at)}</td>
                  <td>{h.equipment_tag || `#${h.equipment_id}`}</td>
                  <td>{h.client_name || "-"}</td>
                  <td>{h.site_name || "-"}</td>
                  <td>{h.event_kind}</td>
                  <td>{h.summary}</td>
                  <td>{h.actor || "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
