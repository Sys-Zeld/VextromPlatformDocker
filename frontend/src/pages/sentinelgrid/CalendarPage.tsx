import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { generateCalendar, listCalendar } from "../../api/sentinelgrid/operations";

export default function CalendarPage() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | "">("");
  const entries = useQuery({
    queryKey: ["sentinelgrid", "calendar", year, month],
    queryFn: () => listCalendar({ year, month: month === "" ? undefined : month })
  });
  const generate = useMutation({
    mutationFn: () => generateCalendar({ year, equipmentId: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "calendar"] })
  });

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Calendario</h2>
          <p className="text-muted mb-0 small">Agenda gerada a partir dos planos de equipamento.</p>
        </div>
        <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>{generate.isPending ? "Gerando..." : "Gerar ano"}</Button>
      </div>
      <Card>
        <Card.Body className="row g-2 align-items-end">
          <div className="col-md-3"><Form.Label>Ano</Form.Label><Form.Control type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} /></div>
          <div className="col-md-3">
            <Form.Label>Mes</Form.Label>
            <Form.Select value={month} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Todos</option>
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
            </Form.Select>
          </div>
          {generate.data && <div className="col-md-6 text-muted small">Gerados: {generate.data.inserted} / analisados: {generate.data.scanned}</div>}
        </Card.Body>
      </Card>
      {entries.isLoading ? <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</div> : entries.error ? (
        <Alert variant="danger">{(entries.error as Error).message}</Alert>
      ) : (
        <Card>
          <Table responsive hover className="mb-0 align-middle">
            <thead><tr><th>Data</th><th>Equipamento</th><th>Cliente/Site</th><th>Tipo</th><th>Status</th></tr></thead>
            <tbody>
              {(entries.data?.entries || []).length === 0 && <tr><td colSpan={5} className="text-muted">Nenhuma entrada.</td></tr>}
              {(entries.data?.entries || []).map((e) => (
                <tr key={e.id}><td>{e.planned_date}</td><td>{e.equipment_tag || `#${e.equipment_id}`}</td><td>{e.client_name} / {e.site_name}</td><td>{e.maintenance_type}</td><td>{e.status}</td></tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
