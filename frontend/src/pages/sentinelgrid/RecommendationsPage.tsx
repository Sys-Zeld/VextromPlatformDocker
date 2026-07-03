import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../../components/IconAction";
import { listEquipment } from "../../api/sentinelgrid/equipment";
import { listMaintenanceOrders } from "../../api/sentinelgrid/maintenanceOrders";
import {
  SgRecommendation,
  SgRecommendationInput,
  createRecommendation,
  listRecommendations,
  updateRecommendationStatus
} from "../../api/sentinelgrid/operations";

const EMPTY: SgRecommendationInput = {
  equipmentId: 0,
  orderId: null,
  reportId: null,
  description: "",
  technicalReason: "",
  criticality: "media",
  dueDate: null,
  responsible: "",
  status: "aberta",
  evidence: "",
  notes: ""
};

const STATUS = [
  ["aberta", "Aberta"],
  ["em_analise", "Em analise"],
  ["aprovada", "Aprovada"],
  ["rejeitada", "Rejeitada"],
  ["executada", "Executada"],
  ["vencida", "Vencida"],
  ["cancelada", "Cancelada"]
] as const;

const CRITICALITY = [
  ["baixa", "Baixa"],
  ["media", "Media"],
  ["alta", "Alta"],
  ["critica", "Critica"],
  ["missao_critica", "Missao critica"]
] as const;

const statusLabel = (value: string) => STATUS.find(([v]) => v === value)?.[1] || value;
const criticalityVariant = (value: string) => value === "critica" || value === "missao_critica" ? "danger" : value === "alta" ? "warning" : "secondary";

export default function RecommendationsPage() {
  const qc = useQueryClient();
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [status, setStatus] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState<SgRecommendationInput>(EMPTY);
  const [selected, setSelected] = useState<SgRecommendation | null>(null);
  const [nextStatus, setNextStatus] = useState("em_analise");
  const [statusNotes, setStatusNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => ({
    equipmentId: equipmentId === "" ? undefined : equipmentId,
    status
  }), [equipmentId, status]);

  const recommendations = useQuery({
    queryKey: ["sentinelgrid", "recommendations", params],
    queryFn: () => listRecommendations(params)
  });
  const equipment = useQuery({ queryKey: ["sentinelgrid", "equipment", "recommendation-select"], queryFn: () => listEquipment({ pageSize: 100 }) });
  const orders = useQuery({ queryKey: ["sentinelgrid", "maintenance-orders", "recommendation-select"], queryFn: () => listMaintenanceOrders({}) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "recommendations"] });
  const onError = (e: unknown) => setError((e as Error).message);
  const mCreate = useMutation({ mutationFn: createRecommendation, onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mStatus = useMutation({
    mutationFn: (p: { id: number; status: string; notes: string }) => updateRecommendationStatus(p.id, { status: p.status, notes: p.notes }),
    onSuccess: () => { setSelected(null); invalidate(); },
    onError
  });

  const openNew = () => {
    setForm({ ...EMPTY });
    setError(null);
    setShow(true);
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    mCreate.mutate(form);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Recomendacoes tecnicas</h2>
          <p className="text-muted mb-0 small">Pendencias tecnicas rastreaveis por equipamento, OM e relatorio.</p>
        </div>
        <Button size="sm" onClick={openNew}>Nova recomendacao</Button>
      </div>

      <Card>
        <Card.Body className="row g-2 align-items-end">
          <div className="col-md-6">
            <Form.Label>Equipamento</Form.Label>
            <Form.Select value={equipmentId} onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Todos</option>
              {(equipment.data?.equipment || []).map((e) => <option key={e.id} value={e.id}>{e.tag || e.serial_number || `#${e.id}`} - {e.client_name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Label>Status</Form.Label>
            <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-2 d-grid">
            <Button variant="outline-secondary" onClick={() => { setEquipmentId(""); setStatus(""); }}>Limpar</Button>
          </div>
        </Card.Body>
      </Card>

      {error && !show && !selected && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

      <Card>
        {recommendations.isLoading ? (
          <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</Card.Body>
        ) : recommendations.error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{(recommendations.error as Error).message}</Alert></Card.Body>
        ) : (
          <Table responsive hover className="mb-0 align-middle">
            <thead><tr><th>Equipamento</th><th>Descricao</th><th>Criticidade</th><th>Status</th><th>Prazo</th><th>Responsavel</th><th className="text-end">Acoes</th></tr></thead>
            <tbody>
              {(recommendations.data?.recommendations || []).length === 0 && <tr><td colSpan={7} className="text-muted">Nenhuma recomendacao cadastrada.</td></tr>}
              {(recommendations.data?.recommendations || []).map((r) => (
                <tr key={r.id}>
                  <td>
                    <div>{r.equipment_tag || `#${r.equipment_id}`}</div>
                    <div className="small text-muted">{r.order_number || r.report_code || "-"}</div>
                  </td>
                  <td>
                    <div className="fw-semibold">{r.description}</div>
                    <div className="small text-muted">{r.technical_reason || r.notes || "-"}</div>
                  </td>
                  <td><Badge bg={criticalityVariant(r.criticality)}>{r.criticality}</Badge></td>
                  <td>{statusLabel(r.status)}</td>
                  <td>{r.due_date || "-"}</td>
                  <td>{r.responsible || "-"}</td>
                  <td className="text-end">
                    <IconAction icon="published_with_changes" label="Alterar status" variant="outline-primary" onClick={() => { setSelected(r); setNextStatus(r.status); setStatusNotes(""); setError(null); }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Nova recomendacao</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
            <div className="row g-3">
              <div className="col-md-7">
                <Form.Label>Equipamento</Form.Label>
                <Form.Select required value={form.equipmentId || ""} onChange={(e) => setForm({ ...form, equipmentId: Number(e.target.value) })}>
                  <option value="">Selecione...</option>
                  {(equipment.data?.equipment || []).map((e) => <option key={e.id} value={e.id}>{e.tag || e.serial_number || `#${e.id}`} - {e.client_name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-5">
                <Form.Label>OM de origem</Form.Label>
                <Form.Select value={form.orderId ?? ""} onChange={(e) => setForm({ ...form, orderId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem vinculo</option>
                  {(orders.data?.orders || []).map((o) => <option key={o.id} value={o.id}>{o.order_number} - {o.equipment_tag || `#${o.equipment_id}`}</option>)}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Descricao</Form.Label>
                <Form.Control required as="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Justificativa tecnica</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.technicalReason} onChange={(e) => setForm({ ...form, technicalReason: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Criticidade</Form.Label>
                <Form.Select value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })}>
                  {CRITICALITY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Prazo sugerido</Form.Label>
                <Form.Control type="date" value={form.dueDate || ""} onChange={(e) => setForm({ ...form, dueDate: e.target.value || null })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Responsavel</Form.Label>
                <Form.Control value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Status</Form.Label>
                <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Evidencia / referencia</Form.Label>
                <Form.Control value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Observacoes</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={mCreate.isPending || !form.equipmentId}>{mCreate.isPending ? "Salvando..." : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={Boolean(selected)} onHide={() => setSelected(null)}>
        <Modal.Header closeButton><Modal.Title>Alterar status</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
          <Form.Label>Status</Form.Label>
          <Form.Select value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            {STATUS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Form.Select>
          <Form.Label className="mt-3">Observacao</Form.Label>
          <Form.Control as="textarea" rows={2} value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSelected(null)}>Cancelar</Button>
          <Button disabled={mStatus.isPending || !selected} onClick={() => selected && mStatus.mutate({ id: selected.id, status: nextStatus, notes: statusNotes })}>
            {mStatus.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
