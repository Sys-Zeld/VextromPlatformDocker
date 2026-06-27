import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../components/IconAction";
import {
  TimesheetEntry,
  TimesheetInput,
  addTimesheet,
  deleteTimesheet,
  getOrderEditor,
  updateTimesheet
} from "../api/orderEditor";

const EMPTY: TimesheetInput = {
  activityDate: "", checkInBase: "", checkInClient: "", checkOutClient: "", checkOutBase: "", technicianName: "", notes: ""
};

function toInput(t: TimesheetEntry): TimesheetInput {
  return {
    activityDate: t.activity_date ? t.activity_date.slice(0, 10) : "",
    checkInBase: t.check_in_base ?? "",
    checkInClient: t.check_in_client ?? "",
    checkOutClient: t.check_out_client ?? "",
    checkOutBase: t.check_out_base ?? "",
    technicianName: t.technician_name ?? "",
    notes: t.notes ?? ""
  };
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
}

export default function OrderEditorPage() {
  const orderId = Number(useParams().id);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["order-editor", orderId], queryFn: () => getOrderEditor(orderId) });

  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<TimesheetInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["order-editor", orderId] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({ mutationFn: (input: TimesheetInput) => addTimesheet(orderId, input), onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mUpdate = useMutation({ mutationFn: (p: { id: number; input: TimesheetInput }) => updateTimesheet(orderId, p.id, p.input), onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: (entryId: number) => deleteTimesheet(orderId, entryId), onSuccess: invalidate, onError });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error || !data) {
    return <Alert variant="danger">Falha ao carregar a OS: {(error as Error)?.message}</Alert>;
  }

  const { order, timesheet, technicians, locked } = data;
  const totalHours = timesheet.reduce((sum, t) => sum + (Number(t.worked_hours) || 0), 0);

  const openNew = () => { setEditId(null); setForm(EMPTY); setActionError(null); setShow(true); };
  const openEdit = (t: TimesheetEntry) => { setEditId(t.id); setForm(toInput(t)); setActionError(null); setShow(true); };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };
  const saving = mCreate.isPending || mUpdate.isPending;

  return (
    <div className="d-flex flex-column gap-4">
      {/* Cabeçalho da OS */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>OS {order.os_number || order.service_order_code || `#${order.id}`} <Link to="/" className="ms-2 small">← Ordens</Link></span>
          <a className="btn btn-sm btn-outline-primary" href={`/admin/report-service/orders/${order.id}`}>Editor completo (legado)</a>
        </Card.Header>
        <Card.Body>
          {locked && <Alert variant="warning">OS aprovada — somente leitura.</Alert>}
          <dl className="row mb-0">
            <dt className="col-sm-2">Título</dt><dd className="col-sm-10">{order.title || "—"}</dd>
            <dt className="col-sm-2">Cliente</dt><dd className="col-sm-4">{order.customer_name}</dd>
            <dt className="col-sm-2">Site</dt><dd className="col-sm-4">{order.site_name || "—"}</dd>
            <dt className="col-sm-2">Status</dt><dd className="col-sm-4"><Badge bg="secondary">{order.status}</Badge></dd>
            <dt className="col-sm-2">Abertura</dt><dd className="col-sm-4">{fmtDate(order.opening_date)}</dd>
          </dl>
        </Card.Body>
      </Card>

      {/* Timesheet */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Apontamentos (timesheet) <Badge bg="light" text="dark" className="ms-2">{totalHours.toFixed(2)} h</Badge></span>
          {!locked && <Button size="sm" onClick={openNew}>Novo apontamento</Button>}
        </Card.Header>
        {actionError && !show && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
        <Table striped responsive hover className="mb-0 align-middle">
          <thead>
            <tr><th>Data</th><th>Técnico</th><th>Entrada (cli.)</th><th>Saída (cli.)</th><th>Horas</th><th>Obs.</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {timesheet.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum apontamento.</td></tr>}
            {timesheet.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.activity_date)}</td>
                <td>{t.technician_name}</td>
                <td>{t.check_in_client}</td>
                <td>{t.check_out_client}</td>
                <td>{t.worked_hours ?? "—"}</td>
                <td>{t.notes}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    {!locked && <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(t)} />}
                    {!locked && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm("Excluir este apontamento?")) mDelete.mutate(t.id); }} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Card.Footer className="text-muted small">
          Demais blocos do relatório (técnicos, seções, medições, imagens, assinaturas) chegam nas próximas fatias; por ora use o “Editor completo (legado)”.
        </Card.Footer>
      </Card>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar apontamento" : "Novo apontamento"}</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>Data</Form.Label>
                <Form.Control type="date" required value={form.activityDate} onChange={(e) => setForm({ ...form, activityDate: e.target.value })} />
              </div>
              <div className="col-md-8">
                <Form.Label>Técnico</Form.Label>
                <Form.Control list="tech-names" value={form.technicianName} onChange={(e) => setForm({ ...form, technicianName: e.target.value })} />
                <datalist id="tech-names">
                  {technicians.map((t) => <option key={t.id} value={t.name} />)}
                </datalist>
              </div>
              <div className="col-md-3">
                <Form.Label>Entrada base</Form.Label>
                <Form.Control type="time" value={form.checkInBase} onChange={(e) => setForm({ ...form, checkInBase: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Entrada cliente</Form.Label>
                <Form.Control type="time" value={form.checkInClient} onChange={(e) => setForm({ ...form, checkInClient: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Saída cliente</Form.Label>
                <Form.Control type="time" value={form.checkOutClient} onChange={(e) => setForm({ ...form, checkOutClient: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Saída base</Form.Label>
                <Form.Control type="time" value={form.checkOutBase} onChange={(e) => setForm({ ...form, checkOutBase: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Observações</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="col-12">
                <small className="text-muted">As horas trabalhadas são calculadas automaticamente a partir de Entrada/Saída cliente.</small>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
