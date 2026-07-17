import { confirmDialog } from "../../components/ConfirmDialog";
import { Fragment, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import IconAction from "../../components/IconAction";
import Pager from "../../components/sentinelgrid/Pager";
import SgIcon from "../../components/sentinelgrid/SgIcon";

const PAGE_SIZE = 20;
import { listClients } from "../../api/sentinelgrid/clients";
import { listEquipment, SgEquipment } from "../../api/sentinelgrid/equipment";
import {
  MAINTENANCE_TYPE_OPTIONS,
  PERIODICITY_OPTIONS,
  SgMaintenanceProgram,
  listMaintenancePrograms
} from "../../api/sentinelgrid/programs";
import {
  SgEquipmentPlan,
  SgEquipmentPlanInput,
  createEquipmentPlan,
  deleteEquipmentPlan,
  listEquipmentPlans,
  updateEquipmentPlan
} from "../../api/sentinelgrid/plans";
import { ORDER_STATUS_OPTIONS, listAllOrdersByPlan } from "../../api/sentinelgrid/maintenanceOrders";

const EMPTY: SgEquipmentPlanInput = {
  equipmentId: 0,
  programId: null,
  name: "",
  maintenanceType: "preventiva_sem_parada",
  periodicity: "semestral",
  adjustments: {},
  active: true,
  notes: "",
  initialNextDueDate: null
};

const labelOf = (items: readonly { value: string; label: string }[], value: string | null | undefined) =>
  items.find((item) => item.value === value)?.label || "-";

function equipmentLabel(e: SgEquipment) {
  const main = e.tag || e.serial_number || `Equipamento #${e.id}`;
  return `${main} - ${e.client_name || "-"} / ${e.site_name || "-"} / ${e.area_name || "-"}`;
}

function toInput(p: SgEquipmentPlan): SgEquipmentPlanInput {
  return {
    equipmentId: Number(p.equipment_id),
    programId: p.program_id ? Number(p.program_id) : null,
    name: p.name,
    maintenanceType: p.maintenance_type,
    periodicity: p.periodicity,
    adjustments: p.adjustments || {},
    active: Boolean(p.active),
    notes: p.notes || "",
    initialNextDueDate: null
  };
}

const dateLabel = (value: string | null | undefined) => value ? value.slice(0, 10).split("-").reverse().join("/") : "-";

function PlanOrdersCascade({ planId }: { planId: number }) {
  const navigate = useNavigate();
  const ordersQuery = useQuery({
    queryKey: ["sentinelgrid", "plans", planId, "orders-cascade"],
    queryFn: () => listAllOrdersByPlan(planId)
  });
  if (ordersQuery.isLoading) {
    return <div className="p-3 text-muted small"><Spinner animation="border" size="sm" className="me-2" />Carregando ordens vinculadas...</div>;
  }
  if (ordersQuery.error) {
    return <Alert variant="danger" className="m-3 mb-0">Falha ao carregar as ordens: {(ordersQuery.error as Error).message}</Alert>;
  }
  const orders = ordersQuery.data ?? [];
  if (!orders.length) return <div className="p-3 text-muted small">Nenhuma ordem vinculada a este plano.</div>;
  return (
    <div className="p-3 sg-plan-cascade">
      <div className="small fw-semibold text-muted mb-2">Ordens vinculadas ({orders.length})</div>
      <Table size="sm" responsive hover className="mb-0 align-middle sg-plan-cascade__table">
        <thead><tr><th>Ordem</th><th>Item do plano</th><th>Data planejada</th><th>Agendamento</th><th>Prioridade</th><th>Status</th></tr></thead>
        <tbody>
          {orders.map((order) => {
            const status = ORDER_STATUS_OPTIONS.find((item) => item.value === order.status);
            return (
              <tr
                key={order.id}
                role="button"
                tabIndex={0}
                title={`Abrir ${order.order_number} em Ordens`}
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/sentinelgrid/maintenance-orders?order=${order.id}`)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); navigate(`/sentinelgrid/maintenance-orders?order=${order.id}`); } }}
              >
                <td><span className="fw-medium">{order.order_number}</span><span className="d-block small text-muted">{order.equipment_tag || order.equipment_serial_number || `#${order.equipment_id}`}</span></td>
                <td>{order.plan_item_title || order.scope || "-"}</td>
                <td>{dateLabel(order.planned_date)}</td>
                <td>{dateLabel(order.scheduled_date)}</td>
                <td>{order.priority || "-"}</td>
                <td><Badge bg={status?.variant || "secondary"}>{status?.label || order.status}</Badge></td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}

export default function PlansPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<number | "">("");
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SgEquipmentPlanInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandedPlans, setExpandedPlans] = useState<Set<number>>(new Set());

  const params = useMemo(() => ({
    search,
    clientId: clientId === "" ? undefined : clientId
  }), [search, clientId]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "plans", params, page],
    queryFn: () => listEquipmentPlans({ ...params, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });
  const clients = useQuery({ queryKey: ["sentinelgrid", "clients"], queryFn: () => listClients() });
  const equipment = useQuery({ queryKey: ["sentinelgrid", "equipment", "plan-select"], queryFn: () => listEquipment({ pageSize: 100 }) });
  const programs = useQuery({ queryKey: ["sentinelgrid", "programs", "active"], queryFn: () => listMaintenancePrograms({ active: true }) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "plans"] });
  const onError = (e: unknown) => setActionError((e as Error).message);
  const mCreate = useMutation({ mutationFn: createEquipmentPlan, onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mUpdate = useMutation({ mutationFn: (p: { id: number; input: SgEquipmentPlanInput }) => updateEquipmentPlan(p.id, p.input), onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: deleteEquipmentPlan, onSuccess: invalidate, onError });

  const applyProgram = (programId: number | null) => {
    const program = (programs.data?.programs || []).find((p) => Number(p.id) === Number(programId));
    setForm((cur) => ({
      ...cur,
      programId,
      name: program && !cur.name.trim() ? `Plano - ${program.name}` : cur.name,
      maintenanceType: program ? program.maintenance_type : cur.maintenanceType,
      periodicity: program ? program.periodicity : cur.periodicity
    }));
  };

  const openNew = () => { setEditId(null); setForm({ ...EMPTY }); setActionError(null); setShow(true); };
  const openEdit = (plan: SgEquipmentPlan) => { setEditId(plan.id); setForm(toInput(plan)); setActionError(null); setShow(true); };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };

  const plans = data?.plans || [];
  const saving = mCreate.isPending || mUpdate.isPending;
  const togglePlan = (id: number) => setExpandedPlans((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Planos do equipamento</h2>
          <p className="text-muted mb-0 small">Aplicacao de programas em ativos fisicos, com periodicidade e ajustes individuais.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/sentinelgrid/programs" className="btn btn-outline-secondary btn-sm">Programas</Link>
          <Button size="sm" onClick={openNew} className="d-inline-flex align-items-center gap-1"><SgIcon name="new-plan" size={17} />Novo plano</Button>
        </div>
      </div>

      <Card>
        <Card.Body>
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <Form.Label>Busca</Form.Label>
              <Form.Control value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Nome, TAG ou numero de serie" />
            </div>
            <div className="col-md-5">
              <Form.Label>Cliente</Form.Label>
              <Form.Select value={clientId} onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : ""); setPage(1); }}>
                <option value="">Todos</option>
                {(clients.data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-2 d-grid">
              <Button variant="outline-secondary" onClick={() => { setSearch(""); setClientId(""); setPage(1); }}>Limpar</Button>
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
            <thead><tr><th>Plano</th><th>Equipamento</th><th>Programa</th><th>Tipo</th><th>Periodicidade</th><th>Status</th><th className="text-end">Acoes</th></tr></thead>
            <tbody>
              {plans.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum plano cadastrado.</td></tr>}
              {plans.map((p) => {
                const expanded = expandedPlans.has(p.id);
                return (
                <Fragment key={p.id}>
                <tr
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  onClick={() => togglePlan(p.id)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); togglePlan(p.id); } }}
                  className={`sg-plan-row${expanded ? " is-expanded" : ""}`}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    <div className="fw-semibold d-flex align-items-center gap-2"><span aria-hidden="true" style={{ width: 12 }}>{expanded ? "▾" : "▸"}</span>{p.name}</div>
                    {p.notes && <div className="small text-muted">{p.notes}</div>}
                  </td>
                  <td>
                    <div>{p.equipment_tag || p.equipment_serial_number || `#${p.equipment_id}`}</div>
                    <div className="small text-muted">{p.client_name} / {p.site_name} / {p.area_name}</div>
                  </td>
                  <td>{p.program_name || "Manual"}</td>
                  <td>{labelOf(MAINTENANCE_TYPE_OPTIONS, p.maintenance_type)}</td>
                  <td>{labelOf(PERIODICITY_OPTIONS, p.periodicity)}</td>
                  <td><Badge bg={p.active ? "success" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge></td>
                  <td className="text-end">
                    <div className="vx-actions justify-content-end" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      <IconAction icon="edit-plan" label="Editar plano" variant="outline-secondary" onClick={() => openEdit(p)} />
                      <IconAction icon="delete-plan" label="Excluir plano" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o plano "${p.name}"?\n\nIsso também exclui as ordens geradas a partir dele.`)) mDelete.mutate(p.id); }} />
                    </div>
                  </td>
                </tr>
                {expanded && <tr className="sg-plan-cascade-row"><td colSpan={7} className="p-0"><PlanOrdersCascade planId={p.id} /></td></tr>}
                </Fragment>
              );})}
            </tbody>
          </Table>
        )}
        {!isLoading && !error && <Pager page={data?.page ?? page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />}
      </Card>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar plano" : "Novo plano"}</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-8">
                <Form.Label>Equipamento</Form.Label>
                <Form.Select required value={form.equipmentId || ""} onChange={(e) => setForm({ ...form, equipmentId: Number(e.target.value) })}>
                  <option value="">Selecione...</option>
                  {(equipment.data?.equipment || []).map((e) => <option key={e.id} value={e.id}>{equipmentLabel(e)}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4 d-flex align-items-end">
                <Form.Check type="switch" label="Plano ativo" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              </div>
              <div className="col-md-7">
                <Form.Label>Programa base</Form.Label>
                <Form.Select value={form.programId ?? ""} onChange={(e) => applyProgram(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Plano manual</option>
                  {(programs.data?.programs || []).map((p: SgMaintenanceProgram) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-5">
                <Form.Label>Proxima execucao</Form.Label>
                <Form.Control type="date" value={form.initialNextDueDate || ""} onChange={(e) => setForm({ ...form, initialNextDueDate: e.target.value || null })} disabled={Boolean(editId)} />
              </div>
              <div className="col-12">
                <Form.Label>Nome do plano</Form.Label>
                <Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Tipo de manutencao</Form.Label>
                <Form.Select required value={form.maintenanceType} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value as SgEquipmentPlanInput["maintenanceType"] })}>
                  {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Periodicidade</Form.Label>
                <Form.Select required value={form.periodicity} onChange={(e) => setForm({ ...form, periodicity: e.target.value as SgEquipmentPlanInput["periodicity"] })}>
                  {PERIODICITY_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Label>Ajustes / observacoes do plano</Form.Label>
                <Form.Control as="textarea" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !form.equipmentId || !form.name.trim()}>{saving ? "Salvando..." : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
