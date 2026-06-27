import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import {
  SparePart,
  SparePartInput,
  createSparePart,
  deleteSparePart,
  listSpareParts,
  updateSparePart
} from "../api/spareParts";

const EMPTY: SparePartInput = {
  description: "",
  manufacturer: "",
  equipmentModel: "",
  partNumber: "",
  leadTime: "",
  isObsolete: false,
  replacedByPartNumber: "",
  equipmentFamily: ""
};

function toInput(s: SparePart): SparePartInput {
  return {
    description: s.description ?? "",
    manufacturer: s.manufacturer ?? "",
    equipmentModel: s.equipment_model ?? "",
    partNumber: s.part_number ?? "",
    leadTime: s.lead_time ?? "",
    isObsolete: Boolean(s.is_obsolete),
    replacedByPartNumber: s.replaced_by_part_number ?? "",
    equipmentFamily: s.equipment_family ?? ""
  };
}

export default function SparePartsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["spare-parts"], queryFn: listSpareParts });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SparePartInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["spare-parts"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({ mutationFn: createSparePart, onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mUpdate = useMutation({
    mutationFn: (p: { id: number; input: SparePartInput }) => updateSparePart(p.id, p.input),
    onSuccess: () => { setShow(false); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteSparePart, onSuccess: invalidate, onError });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar peças: {(error as Error).message}</Alert>;
  }

  const all = data?.spareParts ?? [];
  const q = filter.trim().toLowerCase();
  const spareParts = q
    ? all.filter((s) =>
        [s.description, s.part_number, s.manufacturer, s.equipment_family]
          .some((v) => (v || "").toLowerCase().includes(q)))
    : all;

  const openNew = () => { setEditId(null); setForm(EMPTY); setActionError(null); setShow(true); };
  const openEdit = (s: SparePart) => { setEditId(s.id); setForm(toInput(s)); setActionError(null); setShow(true); };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };
  const saving = mCreate.isPending || mUpdate.isPending;

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center gap-2">
        <span>Spare Parts (catálogo)</span>
        <div className="d-flex gap-2">
          <Form.Control size="sm" placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 220 }} />
          <Button size="sm" onClick={openNew}>Nova peça</Button>
        </div>
      </Card.Header>
      {actionError && !show && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table responsive hover className="mb-0 align-middle">
        <thead>
          <tr><th>Descrição</th><th>Part Number</th><th>Fabricante</th><th>Família</th><th>Lead time</th><th>Status</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {spareParts.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhuma peça.</td></tr>}
          {spareParts.map((s) => (
            <tr key={s.id}>
              <td>{s.description}</td>
              <td>{s.part_number}</td>
              <td>{s.manufacturer}</td>
              <td>{s.equipment_family}</td>
              <td>{s.lead_time}</td>
              <td>{s.is_obsolete ? <Badge bg="danger">Obsoleta</Badge> : <Badge bg="success">Ativa</Badge>}</td>
              <td className="text-end">
                <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => openEdit(s)}>Editar</Button>
                <Button
                  size="sm"
                  variant="outline-danger"
                  disabled={mDelete.isPending}
                  onClick={() => { if (confirm(`Excluir a peça "${s.description}"?`)) mDelete.mutate(s.id); }}
                >Excluir</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card.Footer className="text-muted small">
        Vínculo por equipamento, import por IA/PDF e bulk import continuam no sistema legado por ora.
      </Card.Footer>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar peça" : "Nova peça"}</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-8">
                <Form.Label>Descrição</Form.Label>
                <Form.Control required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Part Number</Form.Label>
                <Form.Control value={form.partNumber} onChange={(e) => setForm({ ...form, partNumber: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Fabricante</Form.Label>
                <Form.Control value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Modelo do equipamento</Form.Label>
                <Form.Control value={form.equipmentModel} onChange={(e) => setForm({ ...form, equipmentModel: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Família</Form.Label>
                <Form.Control value={form.equipmentFamily} onChange={(e) => setForm({ ...form, equipmentFamily: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Lead time</Form.Label>
                <Form.Control value={form.leadTime} onChange={(e) => setForm({ ...form, leadTime: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Substituída por (PN)</Form.Label>
                <Form.Control value={form.replacedByPartNumber} onChange={(e) => setForm({ ...form, replacedByPartNumber: e.target.value })} />
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <Form.Check
                  type="switch"
                  label="Obsoleta"
                  checked={form.isObsolete}
                  onChange={(e) => setForm({ ...form, isObsolete: e.target.checked })}
                />
              </div>
            </div>
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
