import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Pagination, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import EquipmentSparesPanel from "../components/EquipmentSparesPanel";
import SparePartsImportModal from "../components/SparePartsImportModal";
import IconAction from "../components/IconAction";

const PAGE_SIZE = 20;

// Gera os números de página com reticências (janela ao redor da página atual).
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}
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
  const [page, setPage] = useState(1);
  const [showImport, setShowImport] = useState(false);

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

  const totalPages = Math.max(1, Math.ceil(spareParts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = spareParts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstIndex = spareParts.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastIndex = (currentPage - 1) * PAGE_SIZE + pageItems.length;

  const openNew = () => { setEditId(null); setForm(EMPTY); setActionError(null); setShow(true); };
  const openEdit = (s: SparePart) => { setEditId(s.id); setForm(toInput(s)); setActionError(null); setShow(true); };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };
  const saving = mCreate.isPending || mUpdate.isPending;

  return (
    <Tabs defaultActiveKey="catalog" className="mb-3">
      <Tab eventKey="catalog" title="Catálogo">
        <Card>
      <Card.Header className="d-flex justify-content-between align-items-center gap-2">
        <span>Spare Parts (catálogo)</span>
        <div className="d-flex gap-2">
          <Form.Control size="sm" placeholder="Filtrar…" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} style={{ maxWidth: 220 }} />
          <Button size="sm" variant="outline-secondary" onClick={() => setShowImport(true)}>Importar IA/PDF</Button>
          <Button size="sm" onClick={openNew}>Nova peça</Button>
        </div>
      </Card.Header>
      {actionError && !show && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table striped responsive hover className="mb-0 align-middle">
        <thead>
          <tr><th>Descrição</th><th>Part Number</th><th>Fabricante</th><th>Família</th><th>Lead time</th><th>Status</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {spareParts.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhuma peça.</td></tr>}
          {pageItems.map((s) => (
            <tr key={s.id}>
              <td>{s.description}</td>
              <td>{s.part_number}</td>
              <td>{s.manufacturer}</td>
              <td>{s.equipment_family}</td>
              <td>{s.lead_time}</td>
              <td>{s.is_obsolete ? <Badge bg="danger">Obsoleta</Badge> : <Badge bg="success">Ativa</Badge>}</td>
              <td className="text-end">
                <div className="vx-actions justify-content-end">
                  <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(s)} />
                  <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir a peça "${s.description}"?`)) mDelete.mutate(s.id); }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card.Footer className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span className="text-muted small">
          {spareParts.length > 0
            ? `Mostrando ${firstIndex}–${lastIndex} de ${spareParts.length} peça(s)`
            : "Nenhuma peça"}
        </span>
        {totalPages > 1 && (
          <Pagination size="sm" className="mb-0">
            <Pagination.Prev disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} />
            {pageWindow(currentPage, totalPages).map((p, i) =>
              p === "…" ? (
                <Pagination.Ellipsis key={`e${i}`} disabled />
              ) : (
                <Pagination.Item key={p} active={p === currentPage} onClick={() => setPage(p)}>{p}</Pagination.Item>
              )
            )}
            <Pagination.Next disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} />
          </Pagination>
        )}
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

      <SparePartsImportModal show={showImport} onHide={() => setShowImport(false)} onImported={invalidate} customers={data?.customers ?? []} equipments={data?.equipments ?? []} />
        </Card>
      </Tab>
      <Tab eventKey="equipment" title="Por equipamento">
        <EquipmentSparesPanel />
      </Tab>
    </Tabs>
  );
}
