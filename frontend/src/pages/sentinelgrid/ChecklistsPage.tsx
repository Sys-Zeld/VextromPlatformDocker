import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import { listEquipmentTypes, listManufacturers, listModels } from "../../api/sentinelgrid/catalog";
import { MAINTENANCE_TYPE_OPTIONS, SgMaintenanceType, listMaintenancePrograms } from "../../api/sentinelgrid/programs";
import {
  CHECKLIST_ITEM_TYPE_OPTIONS,
  SgChecklist,
  SgChecklistInput,
  SgChecklistItem,
  SgChecklistItemInput,
  createChecklist,
  createChecklistItem,
  deleteChecklist,
  deleteChecklistItem,
  getChecklist,
  listChecklists,
  updateChecklist,
  updateChecklistItem
} from "../../api/sentinelgrid/checklists";

const EMPTY_CHECKLIST: SgChecklistInput = {
  name: "",
  description: "",
  equipmentTypeId: null,
  manufacturerId: null,
  modelId: null,
  programId: null,
  maintenanceType: "preventiva_sem_parada",
  active: true,
  notes: ""
};

const EMPTY_ITEM: SgChecklistItemInput = {
  title: "",
  itemType: "inspection",
  required: true,
  expectedValue: "",
  unit: "",
  acceptanceCriteria: "",
  orderIndex: 0,
  notes: ""
};

function toChecklistInput(checklist: SgChecklist): SgChecklistInput {
  return {
    name: checklist.name || "",
    description: checklist.description || "",
    equipmentTypeId: checklist.equipment_type_id ? Number(checklist.equipment_type_id) : null,
    manufacturerId: checklist.manufacturer_id ? Number(checklist.manufacturer_id) : null,
    modelId: checklist.model_id ? Number(checklist.model_id) : null,
    programId: checklist.program_id ? Number(checklist.program_id) : null,
    maintenanceType: checklist.maintenance_type,
    active: Boolean(checklist.active),
    notes: checklist.notes || ""
  };
}

function toItemInput(item: SgChecklistItem): SgChecklistItemInput {
  return {
    title: item.title || "",
    itemType: item.item_type,
    required: Boolean(item.required),
    expectedValue: item.expected_value || "",
    unit: item.unit || "",
    acceptanceCriteria: item.acceptance_criteria || "",
    orderIndex: Number(item.order_index) || 0,
    notes: item.notes || ""
  };
}

const labelOf = (items: readonly { value: string; label: string }[], value: string | null | undefined) =>
  items.find((item) => item.value === value)?.label || "-";

export default function ChecklistsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<number | "">("");
  const [filterMaintenanceType, setFilterMaintenanceType] = useState("");
  const [showChecklist, setShowChecklist] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<SgChecklistInput>(EMPTY_CHECKLIST);
  const [itemEditId, setItemEditId] = useState<number | null>(null);
  const [itemForm, setItemForm] = useState<SgChecklistItemInput>(EMPTY_ITEM);
  const [actionError, setActionError] = useState<string | null>(null);

  const params = useMemo(() => ({
    search,
    equipmentTypeId: filterType === "" ? undefined : filterType,
    maintenanceType: filterMaintenanceType
  }), [search, filterType, filterMaintenanceType]);

  const { data, isLoading, error } = useQuery({ queryKey: ["sentinelgrid", "checklists", params], queryFn: () => listChecklists(params) });
  const selected = useQuery({
    queryKey: ["sentinelgrid", "checklist", selectedId],
    queryFn: () => getChecklist(selectedId as number),
    enabled: Boolean(selectedId)
  });
  const types = useQuery({ queryKey: ["sentinelgrid", "equipment-types"], queryFn: () => listEquipmentTypes() });
  const manufacturers = useQuery({ queryKey: ["sentinelgrid", "manufacturers"], queryFn: () => listManufacturers() });
  const models = useQuery({ queryKey: ["sentinelgrid", "models"], queryFn: () => listModels() });
  const programs = useQuery({ queryKey: ["sentinelgrid", "programs", "checklist-select"], queryFn: () => listMaintenancePrograms({ active: true }) });

  const invalidateList = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "checklists"] });
  const invalidateSelected = () => {
    if (selectedId) qc.invalidateQueries({ queryKey: ["sentinelgrid", "checklist", selectedId] });
  };
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({ mutationFn: createChecklist, onSuccess: () => { setShowChecklist(false); invalidateList(); }, onError });
  const mUpdate = useMutation({ mutationFn: (p: { id: number; input: SgChecklistInput }) => updateChecklist(p.id, p.input), onSuccess: () => { setShowChecklist(false); invalidateList(); invalidateSelected(); }, onError });
  const mDelete = useMutation({ mutationFn: deleteChecklist, onSuccess: invalidateList, onError });
  const mCreateItem = useMutation({ mutationFn: (p: { checklistId: number; input: SgChecklistItemInput }) => createChecklistItem(p.checklistId, p.input), onSuccess: () => { setItemForm(nextEmptyItem()); setItemEditId(null); invalidateSelected(); invalidateList(); }, onError });
  const mUpdateItem = useMutation({ mutationFn: (p: { checklistId: number; itemId: number; input: SgChecklistItemInput }) => updateChecklistItem(p.checklistId, p.itemId, p.input), onSuccess: () => { setItemForm(nextEmptyItem()); setItemEditId(null); invalidateSelected(); invalidateList(); }, onError });
  const mDeleteItem = useMutation({ mutationFn: (p: { checklistId: number; itemId: number }) => deleteChecklistItem(p.checklistId, p.itemId), onSuccess: () => { invalidateSelected(); invalidateList(); }, onError });

  const checklists = data?.checklists ?? [];
  const selectedChecklist = selected.data ?? null;
  const items = selectedChecklist?.items ?? [];
  const savingChecklist = mCreate.isPending || mUpdate.isPending;
  const savingItem = mCreateItem.isPending || mUpdateItem.isPending;

  function nextEmptyItem(): SgChecklistItemInput {
    const nextOrder = items.length ? Math.max(...items.map((item) => Number(item.order_index) || 0)) + 10 : 10;
    return { ...EMPTY_ITEM, orderIndex: nextOrder };
  }

  const openNew = () => { setEditId(null); setForm({ ...EMPTY_CHECKLIST }); setActionError(null); setShowChecklist(true); };
  const openEdit = (checklist: SgChecklist) => { setEditId(checklist.id); setForm(toChecklistInput(checklist)); setActionError(null); setShowChecklist(true); };
  const openItems = (checklist: SgChecklist) => {
    setSelectedId(checklist.id);
    setItemEditId(null);
    setItemForm({ ...EMPTY_ITEM, orderIndex: 10 });
    setActionError(null);
    setShowItems(true);
  };

  const submitChecklist = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };

  const submitItem = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedId) return;
    if (itemEditId) mUpdateItem.mutate({ checklistId: selectedId, itemId: itemEditId, input: itemForm });
    else mCreateItem.mutate({ checklistId: selectedId, input: itemForm });
  };

  const editItem = (item: SgChecklistItem) => {
    setItemEditId(item.id);
    setItemForm(toItemInput(item));
    setActionError(null);
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Checklists</h2>
          <p className="text-muted mb-0 small">Templates por tipo de equipamento, programa e tipo de manutencao.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/sentinelgrid" className="btn btn-outline-secondary btn-sm">Inicio</Link>
          <Button size="sm" onClick={openNew}>Novo checklist</Button>
        </div>
      </div>

      <Card>
        <Card.Body>
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <Form.Label>Busca</Form.Label>
              <Form.Control value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome ou descricao" />
            </div>
            <div className="col-md-3">
              <Form.Label>Tipo de equipamento</Form.Label>
              <Form.Select value={filterType} onChange={(e) => setFilterType(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Todos</option>
                {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Tipo de manutencao</Form.Label>
              <Form.Select value={filterMaintenanceType} onChange={(e) => setFilterMaintenanceType(e.target.value)}>
                <option value="">Todos</option>
                {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-1 d-grid">
              <Button variant="outline-secondary" onClick={() => { setSearch(""); setFilterType(""); setFilterMaintenanceType(""); }}>Limpar</Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {actionError && !showChecklist && !showItems && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        {isLoading ? (
          <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</Card.Body>
        ) : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{(error as Error).message}</Alert></Card.Body>
        ) : (
          <Table striped responsive hover className="mb-0 align-middle">
            <thead><tr><th>Checklist</th><th>Escopo</th><th>Tipo</th><th>Status</th><th className="text-end">Acoes</th></tr></thead>
            <tbody>
              {checklists.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum checklist cadastrado.</td></tr>}
              {checklists.map((checklist) => (
                <tr key={checklist.id}>
                  <td>
                    <div className="fw-semibold">{checklist.name}</div>
                    {checklist.description && <div className="small text-muted">{checklist.description}</div>}
                  </td>
                  <td>
                    <div>{[checklist.equipment_type_name, checklist.manufacturer_name, checklist.model_name].filter(Boolean).join(" / ") || "Geral"}</div>
                    {checklist.program_name && <div className="small text-muted">Programa: {checklist.program_name}</div>}
                  </td>
                  <td>{labelOf(MAINTENANCE_TYPE_OPTIONS, checklist.maintenance_type)}</td>
                  <td><Badge bg={checklist.active ? "success" : "secondary"}>{checklist.active ? "Ativo" : "Inativo"}</Badge></td>
                  <td className="text-end">
                    <div className="vx-actions justify-content-end">
                      <IconAction icon="playlist_add_check" label="Itens" variant="outline-primary" onClick={() => openItems(checklist)} />
                      <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(checklist)} />
                      <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir o checklist "${checklist.name}"?`)) mDelete.mutate(checklist.id); }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Modal show={showChecklist} onHide={() => setShowChecklist(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar checklist" : "Novo checklist"}</Modal.Title></Modal.Header>
        <Form onSubmit={submitChecklist}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-8">
                <Form.Label>Nome</Form.Label>
                <Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <Form.Check type="switch" label="Checklist ativo" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Tipo de manutencao</Form.Label>
                <Form.Select required value={form.maintenanceType} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value as SgMaintenanceType })}>
                  {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Programa</Form.Label>
                <Form.Select value={form.programId ?? ""} onChange={(e) => setForm({ ...form, programId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem vinculo</option>
                  {(programs.data?.programs ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Descricao</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Tipo de equipamento</Form.Label>
                <Form.Select value={form.equipmentTypeId ?? ""} onChange={(e) => setForm({ ...form, equipmentTypeId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Todos</option>
                  {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Fabricante</Form.Label>
                <Form.Select value={form.manufacturerId ?? ""} onChange={(e) => setForm({ ...form, manufacturerId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Todos</option>
                  {(manufacturers.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Modelo</Form.Label>
                <Form.Select value={form.modelId ?? ""} onChange={(e) => setForm({ ...form, modelId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Todos</option>
                  {(models.data?.models ?? []).map((m) => <option key={m.id} value={m.id}>{m.manufacturer_name} / {m.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Observacoes</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowChecklist(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingChecklist || !form.name.trim()}>{savingChecklist ? "Salvando..." : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showItems} onHide={() => setShowItems(false)} size="xl">
        <Modal.Header closeButton><Modal.Title>Itens do checklist{selectedChecklist ? ` - ${selectedChecklist.name}` : ""}</Modal.Title></Modal.Header>
        <Modal.Body>
          {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
          {selected.isLoading ? (
            <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando itens...</div>
          ) : (
            <div className="row g-4">
              <div className="col-lg-7">
                <Table responsive hover className="mb-0 align-middle">
                  <thead><tr><th>Ordem</th><th>Item</th><th>Tipo</th><th>Obrig.</th><th className="text-end">Acoes</th></tr></thead>
                  <tbody>
                    {items.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum item cadastrado.</td></tr>}
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.order_index}</td>
                        <td>
                          <div className="fw-semibold">{item.title}</div>
                          {(item.expected_value || item.unit || item.acceptance_criteria) && (
                            <div className="small text-muted">
                              {[item.expected_value, item.unit].filter(Boolean).join(" ")}
                              {item.acceptance_criteria ? ` - ${item.acceptance_criteria}` : ""}
                            </div>
                          )}
                        </td>
                        <td>{labelOf(CHECKLIST_ITEM_TYPE_OPTIONS, item.item_type)}</td>
                        <td>{item.required ? "Sim" : "Nao"}</td>
                        <td className="text-end">
                          <div className="vx-actions justify-content-end">
                            <IconAction icon="edit" label="Editar item" variant="outline-secondary" onClick={() => editItem(item)} />
                            <IconAction icon="delete" label="Excluir item" variant="outline-danger" disabled={mDeleteItem.isPending || !selectedId} onClick={() => { if (selectedId && confirm(`Excluir o item "${item.title}"?`)) mDeleteItem.mutate({ checklistId: selectedId, itemId: item.id }); }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="col-lg-5">
                <Card>
                  <Card.Header>{itemEditId ? "Editar item" : "Novo item"}</Card.Header>
                  <Card.Body>
                    <Form onSubmit={submitItem} className="d-flex flex-column gap-3">
                      <div>
                        <Form.Label>Titulo</Form.Label>
                        <Form.Control required value={itemForm.title} onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })} />
                      </div>
                      <div className="row g-2">
                        <div className="col-md-6">
                          <Form.Label>Tipo</Form.Label>
                          <Form.Select value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value as SgChecklistItemInput["itemType"] })}>
                            {CHECKLIST_ITEM_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </Form.Select>
                        </div>
                        <div className="col-md-3">
                          <Form.Label>Ordem</Form.Label>
                          <Form.Control type="number" min={0} value={itemForm.orderIndex} onChange={(e) => setItemForm({ ...itemForm, orderIndex: Number(e.target.value) || 0 })} />
                        </div>
                        <div className="col-md-3 d-flex align-items-end">
                          <Form.Check label="Obrig." checked={itemForm.required} onChange={(e) => setItemForm({ ...itemForm, required: e.target.checked })} />
                        </div>
                      </div>
                      <div className="row g-2">
                        <div className="col-md-8">
                          <Form.Label>Valor esperado</Form.Label>
                          <Form.Control value={itemForm.expectedValue} onChange={(e) => setItemForm({ ...itemForm, expectedValue: e.target.value })} />
                        </div>
                        <div className="col-md-4">
                          <Form.Label>Unidade</Form.Label>
                          <Form.Control value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Form.Label>Criterio de aceite</Form.Label>
                        <Form.Control as="textarea" rows={2} value={itemForm.acceptanceCriteria} onChange={(e) => setItemForm({ ...itemForm, acceptanceCriteria: e.target.value })} />
                      </div>
                      <div>
                        <Form.Label>Observacoes</Form.Label>
                        <Form.Control as="textarea" rows={2} value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} />
                      </div>
                      <div className="d-flex gap-2 justify-content-end">
                        {itemEditId && <Button variant="outline-secondary" onClick={() => { setItemEditId(null); setItemForm(nextEmptyItem()); }}>Cancelar edicao</Button>}
                        <Button type="submit" disabled={savingItem || !itemForm.title.trim()}>{savingItem ? "Salvando..." : "Salvar item"}</Button>
                      </div>
                    </Form>
                  </Card.Body>
                </Card>
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
