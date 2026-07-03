import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import { listClients } from "../../api/sentinelgrid/clients";
import { listSites } from "../../api/sentinelgrid/sites";
import { listAreas } from "../../api/sentinelgrid/areas";
import { listEquipmentTypes, listManufacturers, listModels } from "../../api/sentinelgrid/catalog";
import {
  CRITICALITY,
  OPERATIONAL_STATUS,
  SgEquipment,
  SgEquipmentInput,
  createEquipment,
  criticalityMeta,
  deleteEquipment,
  listEquipment,
  statusMeta,
  updateEquipment
} from "../../api/sentinelgrid/equipment";

interface FormState extends SgEquipmentInput {
  clientId: number;
  siteId: number;
}

const EMPTY: FormState = {
  clientId: 0, siteId: 0, areaId: 0, tag: "", equipmentTypeId: null, manufacturerId: null, modelId: null,
  serialNumber: "", ratedPower: "", inputVoltage: "", outputVoltage: "", dcVoltage: "", frequency: "",
  redundancyConfig: "", moduleCount: null, batteryType: "", installDate: "", commissionDate: "",
  criticality: "media", operationalStatus: "operacional_normal", internalTechnician: "", notes: ""
};

const dateOnly = (v: string | null) => (v ? String(v).slice(0, 10) : "");

function toForm(e: SgEquipment): FormState {
  return {
    clientId: Number(e.client_id), siteId: Number(e.site_id), areaId: Number(e.area_id),
    tag: e.tag || "", equipmentTypeId: e.equipment_type_id ? Number(e.equipment_type_id) : null,
    manufacturerId: e.manufacturer_id ? Number(e.manufacturer_id) : null, modelId: e.model_id ? Number(e.model_id) : null,
    serialNumber: e.serial_number || "", ratedPower: e.rated_power || "", inputVoltage: e.input_voltage || "",
    outputVoltage: e.output_voltage || "", dcVoltage: e.dc_voltage || "", frequency: e.frequency || "",
    redundancyConfig: e.redundancy_config || "", moduleCount: e.module_count ?? null, batteryType: e.battery_type || "",
    installDate: dateOnly(e.install_date), commissionDate: dateOnly(e.commission_date),
    criticality: e.criticality || "media", operationalStatus: e.operational_status || "operacional_normal",
    internalTechnician: e.internal_technician || "", notes: e.notes || ""
  };
}

function toInput(f: FormState): SgEquipmentInput {
  const { clientId: _c, siteId: _s, ...rest } = f;
  return rest;
}

export default function EquipmentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState(0);
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const clientsQuery = useQuery({ queryKey: ["sentinelgrid", "clients", ""], queryFn: () => listClients({ pageSize: 200 }) });
  const sitesQuery = useQuery({ queryKey: ["sentinelgrid", "sites", 0, ""], queryFn: () => listSites({ pageSize: 200 }) });
  const areasQuery = useQuery({ queryKey: ["sentinelgrid", "areas", 0, ""], queryFn: () => listAreas({ pageSize: 200 }) });
  const typesQuery = useQuery({ queryKey: ["sentinelgrid", "equipment-types"], queryFn: () => listEquipmentTypes() });
  const mansQuery = useQuery({ queryKey: ["sentinelgrid", "manufacturers"], queryFn: () => listManufacturers() });
  const modelsQuery = useQuery({ queryKey: ["sentinelgrid", "models"], queryFn: () => listModels() });

  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "equipment", clientFilter, criticalityFilter, statusFilter, search],
    queryFn: () => listEquipment({ clientId: clientFilter || undefined, criticality: criticalityFilter || undefined, operationalStatus: statusFilter || undefined, search })
  });

  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "equipment"] });
  const onError = (e: unknown) => setActionError((e as Error).message);
  const mSave = useMutation({
    mutationFn: () => (editingId ? updateEquipment(editingId, toInput(form!)) : createEquipment(toInput(form!))),
    onSuccess: () => { setForm(null); setEditingId(null); setActionError(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteEquipment, onSuccess: invalidate, onError });

  const clients = clientsQuery.data?.clients ?? [];
  const sites = sitesQuery.data?.sites ?? [];
  const areas = areasQuery.data?.areas ?? [];
  const types = typesQuery.data ?? [];
  const manufacturers = mansQuery.data ?? [];
  const models = modelsQuery.data?.models ?? [];

  const sitesForClient = useMemo(() => (form ? sites.filter((s) => Number(s.client_id) === form.clientId) : []), [sites, form]);
  const areasForSite = useMemo(() => (form ? areas.filter((a) => Number(a.site_id) === form.siteId) : []), [areas, form]);
  const modelsForMan = useMemo(() => (form && form.manufacturerId ? models.filter((m) => Number(m.manufacturer_id) === form.manufacturerId) : models), [models, form]);

  const openNew = () => { setEditingId(null); setForm({ ...EMPTY }); setActionError(null); };
  const openEdit = (e: SgEquipment) => { setEditingId(e.id); setForm(toForm(e)); setActionError(null); };
  const patch = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar equipamentos: {(error as Error).message}</Alert>;
  }

  const equipment = data?.equipment ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Equipamentos</h2>
        <div className="d-flex align-items-center gap-2">
          <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
          <Button size="sm" onClick={openNew}>+ Novo equipamento</Button>
        </div>
      </div>

      {actionError && !form && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>Equipamentos ({data?.total ?? equipment.length})</span>
          <div className="d-flex flex-wrap gap-2">
            <Form.Select size="sm" style={{ maxWidth: 180 }} value={clientFilter || ""} onChange={(e) => setClientFilter(Number(e.target.value) || 0)}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
            <Form.Select size="sm" style={{ maxWidth: 160 }} value={criticalityFilter} onChange={(e) => setCriticalityFilter(e.target.value)}>
              <option value="">Criticidade</option>
              {CRITICALITY.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Form.Select>
            <Form.Select size="sm" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Status</option>
              {OPERATIONAL_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Form.Select>
            <Form.Control size="sm" style={{ maxWidth: 200 }} placeholder="Buscar TAG / série…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Card.Header>
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr><th>TAG</th><th>Tipo</th><th>Modelo</th><th>Cliente / Site / Área</th><th>Criticidade</th><th>Status</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {equipment.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum equipamento.</td></tr>}
            {equipment.map((e) => {
              const cm = criticalityMeta(e.criticality);
              const sm = statusMeta(e.operational_status);
              return (
                <tr key={e.id}>
                  <td>{e.tag || <span className="text-muted">—</span>}</td>
                  <td>{e.equipment_type_name || <span className="text-muted">—</span>}</td>
                  <td>{e.model_name || <span className="text-muted">—</span>}</td>
                  <td className="small">{e.client_name} / {e.site_name} / {e.area_name}</td>
                  <td><Badge bg={cm.variant}>{cm.label}</Badge></td>
                  <td><Badge bg={sm.variant}>{sm.label}</Badge></td>
                  <td className="text-end">
                    <div className="vx-actions justify-content-end">
                      <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(e)} />
                      <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir o equipamento "${e.tag || e.id}"?`)) mDelete.mutate(e.id); }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>

      <Modal show={!!form} onHide={() => setForm(null)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editingId ? "Editar equipamento" : "Novo equipamento"}</Modal.Title></Modal.Header>
        {form && (
          <Form onSubmit={(e) => { e.preventDefault(); mSave.mutate(); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

              <div className="fw-semibold small text-muted">Localização</div>
              <div className="row g-3">
                <div className="col-md-4">
                  <Form.Label>Cliente</Form.Label>
                  <Form.Select required value={form.clientId || ""} onChange={(e) => patch({ clientId: Number(e.target.value) || 0, siteId: 0, areaId: 0 })}>
                    <option value="">Selecione…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-4">
                  <Form.Label>Site</Form.Label>
                  <Form.Select required disabled={!form.clientId} value={form.siteId || ""} onChange={(e) => patch({ siteId: Number(e.target.value) || 0, areaId: 0 })}>
                    <option value="">Selecione…</option>
                    {sitesForClient.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-4">
                  <Form.Label>Área</Form.Label>
                  <Form.Select required disabled={!form.siteId} value={form.areaId || ""} onChange={(e) => patch({ areaId: Number(e.target.value) || 0 })}>
                    <option value="">Selecione…</option>
                    {areasForSite.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Form.Select>
                </div>
              </div>

              <div className="fw-semibold small text-muted mt-2">Identificação</div>
              <div className="row g-3">
                <div className="col-md-3">
                  <Form.Label>TAG</Form.Label>
                  <Form.Control value={form.tag} onChange={(e) => patch({ tag: e.target.value })} />
                </div>
                <div className="col-md-3">
                  <Form.Label>Nº de série</Form.Label>
                  <Form.Control value={form.serialNumber} onChange={(e) => patch({ serialNumber: e.target.value })} />
                </div>
                <div className="col-md-2">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Select value={form.equipmentTypeId || ""} onChange={(e) => patch({ equipmentTypeId: Number(e.target.value) || null })}>
                    <option value="">—</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-2">
                  <Form.Label>Fabricante</Form.Label>
                  <Form.Select value={form.manufacturerId || ""} onChange={(e) => patch({ manufacturerId: Number(e.target.value) || null, modelId: null })}>
                    <option value="">—</option>
                    {manufacturers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-2">
                  <Form.Label>Modelo</Form.Label>
                  <Form.Select value={form.modelId || ""} onChange={(e) => patch({ modelId: Number(e.target.value) || null })}>
                    <option value="">—</option>
                    {modelsForMan.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </Form.Select>
                </div>
              </div>

              <div className="fw-semibold small text-muted mt-2">Especificações elétricas</div>
              <div className="row g-3">
                <div className="col-md-3"><Form.Label>Potência</Form.Label><Form.Control value={form.ratedPower} onChange={(e) => patch({ ratedPower: e.target.value })} /></div>
                <div className="col-md-3"><Form.Label>Tensão entrada</Form.Label><Form.Control value={form.inputVoltage} onChange={(e) => patch({ inputVoltage: e.target.value })} /></div>
                <div className="col-md-3"><Form.Label>Tensão saída</Form.Label><Form.Control value={form.outputVoltage} onChange={(e) => patch({ outputVoltage: e.target.value })} /></div>
                <div className="col-md-3"><Form.Label>Tensão DC</Form.Label><Form.Control value={form.dcVoltage} onChange={(e) => patch({ dcVoltage: e.target.value })} /></div>
                <div className="col-md-3"><Form.Label>Frequência</Form.Label><Form.Control value={form.frequency} onChange={(e) => patch({ frequency: e.target.value })} /></div>
                <div className="col-md-3"><Form.Label>Redundância</Form.Label><Form.Control value={form.redundancyConfig} onChange={(e) => patch({ redundancyConfig: e.target.value })} /></div>
                <div className="col-md-3"><Form.Label>Nº módulos</Form.Label><Form.Control type="number" min={0} value={form.moduleCount ?? ""} onChange={(e) => patch({ moduleCount: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                <div className="col-md-3"><Form.Label>Tipo de bateria</Form.Label><Form.Control value={form.batteryType} onChange={(e) => patch({ batteryType: e.target.value })} /></div>
              </div>

              <div className="fw-semibold small text-muted mt-2">Datas & classificação</div>
              <div className="row g-3">
                <div className="col-md-3"><Form.Label>Instalação</Form.Label><Form.Control type="date" value={form.installDate} onChange={(e) => patch({ installDate: e.target.value })} /></div>
                <div className="col-md-3"><Form.Label>Comissionamento</Form.Label><Form.Control type="date" value={form.commissionDate} onChange={(e) => patch({ commissionDate: e.target.value })} /></div>
                <div className="col-md-3">
                  <Form.Label>Criticidade</Form.Label>
                  <Form.Select value={form.criticality} onChange={(e) => patch({ criticality: e.target.value })}>
                    {CRITICALITY.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-3">
                  <Form.Label>Status operacional</Form.Label>
                  <Form.Select value={form.operationalStatus} onChange={(e) => patch({ operationalStatus: e.target.value })}>
                    {OPERATIONAL_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-6"><Form.Label>Técnico responsável interno</Form.Label><Form.Control value={form.internalTechnician} onChange={(e) => patch({ internalTechnician: e.target.value })} /></div>
              </div>

              <Form.Group>
                <Form.Label>Observações técnicas</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setForm(null)}>Cancelar</Button>
              <Button type="submit" disabled={mSave.isPending || !form.areaId}>{editingId ? "Salvar" : "Criar"}</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
