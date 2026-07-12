import { confirmDialog } from "../../components/ConfirmDialog";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import Pager from "../../components/sentinelgrid/Pager";

const PAGE_SIZE = 20;
import { listContracts } from "../../api/sentinelgrid/contracts";
import { listEquipmentTypes, listManufacturers, listModels } from "../../api/sentinelgrid/catalog";
import {
  CRITICALITY_OPTIONS,
  MAINTENANCE_TYPE_OPTIONS,
  PERIODICITY_OPTIONS,
  SgMaintenanceProgram,
  SgMaintenanceProgramInput,
  createMaintenanceProgram,
  deleteMaintenanceProgram,
  listMaintenancePrograms,
  updateMaintenanceProgram
} from "../../api/sentinelgrid/programs";
import GeneratePlansModal from "./GeneratePlansModal";

const EMPTY: SgMaintenanceProgramInput = {
  name: "",
  description: "",
  equipmentTypeId: null,
  manufacturerId: null,
  modelId: null,
  contractId: null,
  criticality: null,
  maintenanceType: "preventiva_sem_parada",
  periodicity: "semestral",
  planIntervalsMonths: [],
  active: true,
  scopeNotes: "",
  notes: ""
};

const parseIntervals = (raw: string): number[] =>
  Array.from(new Set(raw.split(/[,;\s]+/).map((s) => parseInt(s, 10)).filter((n) => Number.isInteger(n) && n > 0 && n <= 120))).sort((a, b) => a - b);

function toInput(p: SgMaintenanceProgram): SgMaintenanceProgramInput {
  return {
    name: p.name || "",
    description: p.description || "",
    equipmentTypeId: p.equipment_type_id ? Number(p.equipment_type_id) : null,
    manufacturerId: p.manufacturer_id ? Number(p.manufacturer_id) : null,
    modelId: p.model_id ? Number(p.model_id) : null,
    contractId: p.contract_id ? Number(p.contract_id) : null,
    criticality: p.criticality,
    maintenanceType: p.maintenance_type,
    periodicity: p.periodicity,
    planIntervalsMonths: p.plan_intervals_months || [],
    active: Boolean(p.active),
    scopeNotes: p.scope_notes || "",
    notes: p.notes || ""
  };
}

const labelOf = (items: readonly { value: string; label: string }[], value: string | null | undefined) =>
  items.find((item) => item.value === value)?.label || "-";

const criticalityVariant = (value: string | null | undefined) =>
  CRITICALITY_OPTIONS.find((item) => item.value === value)?.variant || "secondary";

export default function ProgramsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<number | "">("");
  const [filterMaintenanceType, setFilterMaintenanceType] = useState("");
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SgMaintenanceProgramInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);
  const [genProgram, setGenProgram] = useState<SgMaintenanceProgram | null>(null);
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({
    search,
    equipmentTypeId: filterType === "" ? undefined : filterType,
    maintenanceType: filterMaintenanceType
  }), [search, filterType, filterMaintenanceType]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "programs", params, page],
    queryFn: () => listMaintenancePrograms({ ...params, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });
  const types = useQuery({ queryKey: ["sentinelgrid", "equipment-types"], queryFn: () => listEquipmentTypes() });
  const manufacturers = useQuery({ queryKey: ["sentinelgrid", "manufacturers"], queryFn: () => listManufacturers() });
  const models = useQuery({ queryKey: ["sentinelgrid", "models"], queryFn: () => listModels() });
  const contracts = useQuery({ queryKey: ["sentinelgrid", "contracts"], queryFn: () => listContracts() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "programs"] });
  const onError = (e: unknown) => setActionError((e as Error).message);
  const mCreate = useMutation({ mutationFn: createMaintenanceProgram, onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mUpdate = useMutation({ mutationFn: (p: { id: number; input: SgMaintenanceProgramInput }) => updateMaintenanceProgram(p.id, p.input), onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: deleteMaintenanceProgram, onSuccess: invalidate, onError });

  const openNew = () => { setEditId(null); setForm({ ...EMPTY }); setActionError(null); setShow(true); };
  const openEdit = (program: SgMaintenanceProgram) => { setEditId(program.id); setForm(toInput(program)); setActionError(null); setShow(true); };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };

  const programs = data?.programs ?? [];
  const saving = mCreate.isPending || mUpdate.isPending;

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Programas de manutencao</h2>
          <p className="text-muted mb-0 small">Modelos padrao que depois geram planos individuais por equipamento.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/sentinelgrid" className="btn btn-outline-secondary btn-sm">Inicio</Link>
          <Button size="sm" onClick={openNew}>Novo programa</Button>
        </div>
      </div>

      <Card>
        <Card.Body>
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <Form.Label>Busca</Form.Label>
              <Form.Control value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nome ou descricao" />
            </div>
            <div className="col-md-3">
              <Form.Label>Tipo de equipamento</Form.Label>
              <Form.Select value={filterType} onChange={(e) => { setFilterType(e.target.value ? Number(e.target.value) : ""); setPage(1); }}>
                <option value="">Todos</option>
                {(types.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Tipo de manutencao</Form.Label>
              <Form.Select value={filterMaintenanceType} onChange={(e) => { setFilterMaintenanceType(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-1 d-grid">
              <Button variant="outline-secondary" onClick={() => { setSearch(""); setFilterType(""); setFilterMaintenanceType(""); setPage(1); }}>Limpar</Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {actionError && !show && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        {isLoading ? (
          <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</Card.Body>
        ) : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{(error as Error).message}</Alert></Card.Body>
        ) : (
          <Table striped responsive hover className="mb-0 align-middle">
            <thead><tr><th>Programa</th><th>Escopo</th><th>Tipo</th><th>Periodicidade</th><th>Status</th><th className="text-end">Acoes</th></tr></thead>
            <tbody>
              {programs.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhum programa cadastrado.</td></tr>}
              {programs.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="fw-semibold">{p.name}</div>
                    {p.description && <div className="small text-muted">{p.description}</div>}
                  </td>
                  <td>
                    <div>{[p.equipment_type_name, p.manufacturer_name, p.model_name].filter(Boolean).join(" / ") || "Geral"}</div>
                    <div className="small text-muted">
                      {p.criticality ? <Badge bg={criticalityVariant(p.criticality) as string}>{labelOf(CRITICALITY_OPTIONS, p.criticality)}</Badge> : "Todas as criticidades"}
                      {p.contract_name ? <span className="ms-2">{p.contract_client_name} / {p.contract_name}</span> : null}
                    </div>
                  </td>
                  <td>{labelOf(MAINTENANCE_TYPE_OPTIONS, p.maintenance_type)}</td>
                  <td>{labelOf(PERIODICITY_OPTIONS, p.periodicity)}</td>
                  <td><Badge bg={p.active ? "success" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge></td>
                  <td className="text-end">
                    <div className="vx-actions justify-content-end">
                      <IconAction icon="calendar" label="Gerar planos" variant="outline-primary" disabled={!p.active} onClick={() => setGenProgram(p)} />
                      <IconAction icon="pencil" label="Editar" variant="outline-secondary" onClick={() => openEdit(p)} />
                      <IconAction icon="trash" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o programa "${p.name}"?\n\nIsso também exclui os planos vinculados e as ordens geradas a partir deles. Se o programa for usado por equipamentos de mais de um cliente, a exclusão é bloqueada.`)) mDelete.mutate(p.id); }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {!isLoading && !error && <Pager page={data?.page ?? page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />}
      </Card>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar programa" : "Novo programa"}</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-8">
                <Form.Label>Nome</Form.Label>
                <Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <Form.Check type="switch" label="Programa ativo" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Tipo de manutencao</Form.Label>
                <Form.Select required value={form.maintenanceType} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value as SgMaintenanceProgramInput["maintenanceType"] })}>
                  {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Periodicidade base</Form.Label>
                <Form.Select required value={form.periodicity} onChange={(e) => setForm({ ...form, periodicity: e.target.value as SgMaintenanceProgramInput["periodicity"] })}>
                  {PERIODICITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Intervalos de manutenção (meses)</Form.Label>
                <Form.Control
                  value={form.planIntervalsMonths.join(", ")}
                  onChange={(e) => setForm({ ...form, planIntervalsMonths: parseIntervals(e.target.value) })}
                  placeholder="ex.: 1, 3, 12"
                />
                <Form.Text className="text-muted">Cada intervalo gera um plano separado no "Gerar planos" (1 = mensal, 3 = trimestral…). Vazio usa a periodicidade base.</Form.Text>
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
              <div className="col-md-6">
                <Form.Label>Criticidade</Form.Label>
                <Form.Select value={form.criticality ?? ""} onChange={(e) => setForm({ ...form, criticality: e.target.value ? e.target.value as SgMaintenanceProgramInput["criticality"] : null })}>
                  <option value="">Todas</option>
                  {CRITICALITY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Contrato</Form.Label>
                <Form.Select value={form.contractId ?? ""} onChange={(e) => setForm({ ...form, contractId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem vinculo</option>
                  {(contracts.data?.contracts ?? []).map((c) => <option key={c.id} value={c.id}>{c.client_name} / {c.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Notas de escopo</Form.Label>
                <Form.Control value={form.scopeNotes} onChange={(e) => setForm({ ...form, scopeNotes: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Observacoes</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>{saving ? "Salvando..." : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {genProgram && <GeneratePlansModal program={genProgram} onHide={() => setGenProgram(null)} />}
    </div>
  );
}
