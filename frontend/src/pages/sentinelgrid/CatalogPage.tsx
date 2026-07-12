import { confirmDialog } from "../../components/ConfirmDialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import Pager from "../../components/sentinelgrid/Pager";
import SgIcon from "../../components/sentinelgrid/SgIcon";
import {
  SgLookup,
  SgLookupInput,
  SgModel,
  SgModelInput,
  createEquipmentType,
  createManufacturer,
  createModel,
  deleteEquipmentType,
  deleteManufacturer,
  deleteModel,
  listEquipmentTypes,
  listManufacturers,
  listModels,
  updateEquipmentType,
  updateManufacturer,
  updateModel
} from "../../api/sentinelgrid/catalog";

const PAGE_SIZE = 20;

/** Seção genérica de lookup { name, notes } (Fabricantes, Tipos). */
function LookupSection(props: {
  title: string;
  qKey: string;
  load: () => Promise<SgLookup[]>;
  create: (i: SgLookupInput) => Promise<SgLookup>;
  update: (id: number, i: SgLookupInput) => Promise<SgLookup>;
  remove: (id: number) => Promise<void>;
}) {
  const { title, qKey, load, create, update, remove } = props;
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["sentinelgrid", qKey], queryFn: load });
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SgLookup | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", qKey] });
  const onError = (e: unknown) => setErr((e as Error).message);
  const mCreate = useMutation({ mutationFn: () => create({ name, notes }), onSuccess: () => { setName(""); setNotes(""); setErr(null); invalidate(); }, onError });
  const mUpdate = useMutation({ mutationFn: () => update(editing!.id, { name: editing!.name, notes: editing!.notes || "" }), onSuccess: () => { setEditing(null); setErr(null); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: remove, onSuccess: invalidate, onError });

  const items = data ?? [];
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Card>
      <Card.Header>{title}</Card.Header>
      <Card.Body>
        {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
        <Form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); mCreate.mutate(); }}>
          <div className="col-md-5">
            <Form.Label>Nome</Form.Label>
            <Form.Control required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="col-md-5">
            <Form.Label>Observações</Form.Label>
            <Form.Control value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="col-md-2 d-grid">
            <Button type="submit" disabled={mCreate.isPending || !name.trim()} className="d-inline-flex align-items-center gap-1"><SgIcon name="add-circle" size={16} className="sg-icon--mono" />Adicionar</Button>
          </div>
        </Form>
      </Card.Body>
      {isLoading ? (
        <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</Card.Body>
      ) : error ? (
        <Card.Body><Alert variant="danger" className="mb-0">{(error as Error).message}</Alert></Card.Body>
      ) : (
        <Table striped responsive hover className="mb-0">
          <thead><tr><th>Nome</th><th>Observações</th><th className="text-end">Ações</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={3} className="text-muted">Nenhum registro.</td></tr>}
            {pageItems.map((it) => (
              <tr key={it.id}>
                <td>{it.name}</td>
                <td>{it.notes}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="pencil" label="Editar" variant="outline-secondary" onClick={() => setEditing({ ...it })} />
                    <IconAction icon="trash" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir "${it.name}"?`)) mDelete.mutate(it.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {!isLoading && !error && <Pager page={safePage} pageSize={PAGE_SIZE} total={items.length} onPageChange={setPage} />}

      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton><Modal.Title>Editar</Modal.Title></Modal.Header>
        {editing && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdate.mutate(); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label>Nome</Form.Label>
                <Form.Control required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Observações</Form.Label>
                <Form.Control value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdate.isPending || !editing.name.trim()}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </Card>
  );
}

const EMPTY_MODEL: SgModelInput = { manufacturerId: 0, equipmentTypeId: 0, name: "", notes: "" };

function ModelsSection() {
  const qc = useQueryClient();
  const mans = useQuery({ queryKey: ["sentinelgrid", "manufacturers"], queryFn: () => listManufacturers() });
  const types = useQuery({ queryKey: ["sentinelgrid", "equipment-types"], queryFn: () => listEquipmentTypes() });
  const { data, isLoading, error } = useQuery({ queryKey: ["sentinelgrid", "models"], queryFn: () => listModels({ pageSize: 500 }) });

  const [novo, setNovo] = useState<SgModelInput>(EMPTY_MODEL);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SgModel | null>(null);
  const [editInput, setEditInput] = useState<SgModelInput>(EMPTY_MODEL);
  const [err, setErr] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "models"] });
  const onError = (e: unknown) => setErr((e as Error).message);
  const mCreate = useMutation({ mutationFn: () => createModel(novo), onSuccess: () => { setNovo({ ...EMPTY_MODEL }); setErr(null); invalidate(); }, onError });
  const mUpdate = useMutation({ mutationFn: () => updateModel(editing!.id, editInput), onSuccess: () => { setEditing(null); setErr(null); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: deleteModel, onSuccess: invalidate, onError });

  const openEdit = (m: SgModel) => {
    setEditing(m);
    setEditInput({ manufacturerId: Number(m.manufacturer_id), equipmentTypeId: Number(m.equipment_type_id), name: m.name, notes: m.notes || "" });
  };

  const manufacturers = mans.data ?? [];
  const equipmentTypes = types.data ?? [];
  const models = data?.models ?? [];
  const pageCount = Math.max(1, Math.ceil(models.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageModels = models.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Card>
      <Card.Header>Modelos de equipamento</Card.Header>
      <Card.Body>
        {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
        <Form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); mCreate.mutate(); }}>
          <div className="col-md-3">
            <Form.Label>Fabricante</Form.Label>
            <Form.Select required value={novo.manufacturerId || ""} onChange={(e) => setNovo({ ...novo, manufacturerId: Number(e.target.value) })}>
              <option value="">Selecione…</option>
              {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-3">
            <Form.Label>Tipo</Form.Label>
            <Form.Select required value={novo.equipmentTypeId || ""} onChange={(e) => setNovo({ ...novo, equipmentTypeId: Number(e.target.value) })}>
              <option value="">Selecione…</option>
              {equipmentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Label>Nome do modelo</Form.Label>
            <Form.Control required value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
          </div>
          <div className="col-md-2 d-grid">
            <Button type="submit" disabled={mCreate.isPending || !novo.manufacturerId || !novo.equipmentTypeId || !novo.name.trim()} className="d-inline-flex align-items-center gap-1"><SgIcon name="add-circle" size={16} className="sg-icon--mono" />Adicionar</Button>
          </div>
        </Form>
      </Card.Body>
      {isLoading ? (
        <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</Card.Body>
      ) : error ? (
        <Card.Body><Alert variant="danger" className="mb-0">{(error as Error).message}</Alert></Card.Body>
      ) : (
        <Table striped responsive hover className="mb-0">
          <thead><tr><th>Modelo</th><th>Fabricante</th><th>Tipo</th><th className="text-end">Ações</th></tr></thead>
          <tbody>
            {models.length === 0 && <tr><td colSpan={4} className="text-muted">Nenhum modelo.</td></tr>}
            {pageModels.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.manufacturer_name}</td>
                <td>{m.equipment_type_name}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="pencil" label="Editar" variant="outline-secondary" onClick={() => openEdit(m)} />
                    <IconAction icon="trash" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o modelo "${m.name}"?`)) mDelete.mutate(m.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {!isLoading && !error && <Pager page={safePage} pageSize={PAGE_SIZE} total={models.length} onPageChange={setPage} />}

      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton><Modal.Title>Editar modelo</Modal.Title></Modal.Header>
        {editing && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdate.mutate(); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              <div className="row g-3">
                <div className="col-6">
                  <Form.Label>Fabricante</Form.Label>
                  <Form.Select required value={editInput.manufacturerId || ""} onChange={(e) => setEditInput({ ...editInput, manufacturerId: Number(e.target.value) })}>
                    <option value="">Selecione…</option>
                    {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Form.Select>
                </div>
                <div className="col-6">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select required value={editInput.equipmentTypeId || ""} onChange={(e) => setEditInput({ ...editInput, equipmentTypeId: Number(e.target.value) })}>
                    <option value="">Selecione…</option>
                    {equipmentTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Form.Select>
                </div>
              </div>
              <Form.Group>
                <Form.Label>Nome do modelo</Form.Label>
                <Form.Control required value={editInput.name} onChange={(e) => setEditInput({ ...editInput, name: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Observações</Form.Label>
                <Form.Control as="textarea" rows={2} value={editInput.notes} onChange={(e) => setEditInput({ ...editInput, notes: e.target.value })} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdate.isPending || !editInput.manufacturerId || !editInput.equipmentTypeId || !editInput.name.trim()}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </Card>
  );
}

export default function CatalogPage() {
  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Catálogo</h2>
        <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
      </div>
      <LookupSection
        title="Fabricantes"
        qKey="manufacturers"
        load={() => listManufacturers("", 500)}
        create={createManufacturer}
        update={updateManufacturer}
        remove={deleteManufacturer}
      />
      <LookupSection
        title="Tipos de equipamento"
        qKey="equipment-types"
        load={() => listEquipmentTypes("", 500)}
        create={createEquipmentType}
        update={updateEquipmentType}
        remove={deleteEquipmentType}
      />
      <ModelsSection />
    </div>
  );
}
