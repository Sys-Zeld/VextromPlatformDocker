import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import {
  Tool,
  ToolCreateInput,
  createTechnicianTool,
  deleteTechnicianTool,
  listTechnicianTools,
  updateTechnicianTool
} from "../api/technicianTools";

const EMPTY: ToolCreateInput = { item: "", quantity: 1, description: "", serialNumber: "", notes: "" };

export default function TechnicianToolsPage() {
  const techId = Number(useParams().techId);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tools", techId],
    queryFn: () => listTechnicianTools(techId)
  });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ToolCreateInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tools", techId] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({ mutationFn: (input: ToolCreateInput) => createTechnicianTool(techId, input), onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mUpdate = useMutation({
    mutationFn: (p: { id: number; input: ToolCreateInput }) =>
      updateTechnicianTool(techId, p.id, { quantity: p.input.quantity, description: p.input.description, serialNumber: p.input.serialNumber, notes: p.input.notes }),
    onSuccess: () => { setShow(false); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: (id: number) => deleteTechnicianTool(techId, id), onSuccess: invalidate, onError });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar ferramentas: {(error as Error).message}</Alert>;
  }

  const tools = data?.tools ?? [];
  const technician = data?.technician;

  const openNew = () => { setEditId(null); setForm(EMPTY); setActionError(null); setShow(true); };
  const openEdit = (t: Tool) => {
    setEditId(t.id);
    setForm({ item: t.item, quantity: t.quantity, description: t.description ?? "", serialNumber: t.serial_number ?? "", notes: t.notes ?? "" });
    setActionError(null);
    setShow(true);
  };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };
  const saving = mCreate.isPending || mUpdate.isPending;

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Ferramentas — {technician?.name ?? `Técnico #${techId}`} <Link to="/assets" className="ms-2 small">← Equipe</Link></span>
        <Button size="sm" onClick={openNew}>Nova ferramenta</Button>
      </Card.Header>
      {actionError && !show && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table responsive hover className="mb-0 align-middle">
        <thead><tr><th>Item</th><th>Qtd.</th><th>Descrição</th><th>Nº de série</th><th className="text-end">Ações</th></tr></thead>
        <tbody>
          {tools.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhuma ferramenta.</td></tr>}
          {tools.map((t) => (
            <tr key={t.id}>
              <td>{t.item}</td>
              <td>{t.quantity}</td>
              <td>{t.description}</td>
              <td>{t.serial_number}</td>
              <td className="text-end">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => openEdit(t)}>Editar</Button>
                <Button size="sm" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir "${t.item}"?`)) mDelete.mutate(t.id); }}>Excluir</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar ferramenta" : "Nova ferramenta"}</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body className="d-flex flex-column gap-3">
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-8">
                <Form.Label>Item</Form.Label>
                <Form.Control required disabled={!!editId} value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
                {editId && <Form.Text className="text-muted">O nome do item não é editável (regra do legado).</Form.Text>}
              </div>
              <div className="col-4">
                <Form.Label>Quantidade</Form.Label>
                <Form.Control type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              </div>
            </div>
            <Form.Group>
              <Form.Label>Descrição</Form.Label>
              <Form.Control value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Nº de série</Form.Label>
              <Form.Control value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Observações</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
  );
}
