import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import Pager from "../../components/sentinelgrid/Pager";
import { formatDate } from "../../utils/format";
import { listClients } from "../../api/sentinelgrid/clients";
import { listEquipment, SgEquipment } from "../../api/sentinelgrid/equipment";
import { getEquipmentPlan, listEquipmentPlans } from "../../api/sentinelgrid/plans";
import { listChecklists } from "../../api/sentinelgrid/checklists";
import { listManagers } from "../../api/sentinelgrid/managers";
import { MAINTENANCE_TYPE_OPTIONS, SgMaintenanceType } from "../../api/sentinelgrid/programs";
import {
  CORRECTIVE_CLASS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  SgCorrectiveClass,
  SgMaintenanceOrder,
  SgMaintenanceOrderInput,
  SgOrderApprovalInput,
  SgOrderFromPlanInput,
  SgOrderStatusInput,
  SgOrderStatus,
  createMaintenanceOrder,
  createMaintenanceOrderFromPlan,
  createMaintenanceOrdersFromPlans,
  createOrderApproval,
  deleteMaintenanceOrder,
  getMaintenanceOrder,
  listMaintenanceOrders,
  transitionMaintenanceOrderStatus,
  updateMaintenanceOrder
} from "../../api/sentinelgrid/maintenanceOrders";
import {
  CHECKLIST_RESULT_STATUS_OPTIONS,
  SgChecklistResultInput,
  getOrderChecklistExecution,
  saveOrderChecklistResult
} from "../../api/sentinelgrid/orderExecution";
import {
  SgMeasurementInput,
  SgPartInput,
  SgReportInput,
  createAssociatedReport,
  createAttachment,
  createMeasurement,
  createPart
} from "../../api/sentinelgrid/operations";

const EMPTY: SgMaintenanceOrderInput = {
  equipmentId: 0,
  planId: null,
  planItemId: null,
  checklistId: null,
  maintenanceType: "preventiva_sem_parada",
  status: undefined,
  priority: "normal",
  plannedDate: null,
  scheduledDate: null,
  executedDate: null,
  technicianId: "",
  clientManagerId: null,
  scope: "",
  finalCondition: "",
  notes: "",
  correctiveDetails: null
};

const EMPTY_FROM_PLAN: SgOrderFromPlanInput = {
  planId: 0,
  planItemId: null,
  checklistId: null,
  priority: "normal",
  plannedDate: null,
  scheduledDate: null,
  technicianId: "",
  clientManagerId: null,
  scope: "",
  notes: ""
};

const EMPTY_STATUS: SgOrderStatusInput = {
  status: "agendada",
  finalCondition: "",
  notes: ""
};

const EMPTY_CORRECTIVE = {
  symptom: "",
  alarm: "",
  operationalImpact: "",
  probableCause: "",
  rootCause: "",
  actionTaken: "",
  urgency: "",
  correctiveClass: "programada" as const
};

const EMPTY_APPROVAL: SgOrderApprovalInput = {
  clientManagerId: null,
  approverName: "",
  approvedAt: null,
  authorizedWindow: "",
  restrictions: "",
  releaseCondition: "",
  finalAccept: false,
  notes: ""
};

const EMPTY_MEASUREMENT: Omit<SgMeasurementInput, "orderId"> = {
  technicianId: "",
  measuredAt: null,
  metric: "",
  value: "",
  unit: "",
  notes: ""
};

const EMPTY_PART: Omit<SgPartInput, "orderId"> = {
  partDescription: "",
  partCode: "",
  manufacturer: "",
  quantity: 1,
  reason: "",
  removedCondition: "",
  newPartInstalled: true,
  evidence: ""
};

const EMPTY_REPORT: Omit<SgReportInput, "orderId"> = {
  reportCode: "",
  title: "",
  issuedAt: null,
  technician: "",
  reportType: "",
  fileRef: "",
  externalLink: "",
  externalId: "",
  notes: ""
};

const EMPTY_ATTACHMENT = {
  fileRef: "",
  kind: "",
  label: "",
  notes: ""
};

const labelOf = (items: readonly { value: string; label: string }[], value: string | null | undefined) =>
  items.find((item) => item.value === value)?.label || "-";

const statusMeta = (value: string) =>
  ORDER_STATUS_OPTIONS.find((item) => item.value === value) || { value, label: value, variant: "secondary" };

function equipmentLabel(e: SgEquipment) {
  const main = e.tag || e.serial_number || `Equipamento #${e.id}`;
  return `${main} - ${e.client_name || "-"} / ${e.site_name || "-"} / ${e.area_name || "-"}`;
}

function toInput(order: SgMaintenanceOrder): SgMaintenanceOrderInput {
  return {
    equipmentId: Number(order.equipment_id),
    planId: order.plan_id ? Number(order.plan_id) : null,
    planItemId: order.plan_item_id ? Number(order.plan_item_id) : null,
    checklistId: order.checklist_id ? Number(order.checklist_id) : null,
    maintenanceType: order.maintenance_type,
    status: order.status,
    priority: order.priority || "normal",
    plannedDate: order.planned_date || null,
    scheduledDate: order.scheduled_date || null,
    executedDate: order.executed_date || null,
    technicianId: order.technician_id || "",
    clientManagerId: order.client_manager_id ? Number(order.client_manager_id) : null,
    scope: order.scope || "",
    finalCondition: order.final_condition || "",
    notes: order.notes || "",
    correctiveDetails: order.maintenance_type === "corretiva" ? {
      symptom: order.corrective_details?.symptom || "",
      alarm: order.corrective_details?.alarm || "",
      operationalImpact: order.corrective_details?.operational_impact || "",
      probableCause: order.corrective_details?.probable_cause || "",
      rootCause: order.corrective_details?.root_cause || "",
      actionTaken: order.corrective_details?.action_taken || "",
      urgency: order.corrective_details?.urgency || "",
      correctiveClass: order.corrective_details?.corrective_class || "programada"
    } : null
  };
}

const PAGE_SIZE = 20;

export default function MaintenanceOrdersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<number | "">("");
  const [status, setStatus] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("");
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<SgMaintenanceOrderInput>(EMPTY);
  const [fromPlanForm, setFromPlanForm] = useState<SgOrderFromPlanInput>(EMPTY_FROM_PLAN);
  const [approvalForm, setApprovalForm] = useState<SgOrderApprovalInput>(EMPTY_APPROVAL);
  const [transitionForm, setTransitionForm] = useState<SgOrderStatusInput>(EMPTY_STATUS);
  const [selectedOrder, setSelectedOrder] = useState<SgMaintenanceOrder | null>(null);
  const [showFromPlan, setShowFromPlan] = useState(false);
  const [fromPlanAll, setFromPlanAll] = useState(false);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showApproval, setShowApproval] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showExecution, setShowExecution] = useState(false);
  const [checklistDrafts, setChecklistDrafts] = useState<Record<number, SgChecklistResultInput>>({});
  const [measurementForm, setMeasurementForm] = useState(EMPTY_MEASUREMENT);
  const [partForm, setPartForm] = useState(EMPTY_PART);
  const [reportForm, setReportForm] = useState(EMPTY_REPORT);
  const [attachmentForm, setAttachmentForm] = useState(EMPTY_ATTACHMENT);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [page, setPage] = useState(1);

  const params = useMemo(() => ({
    search,
    clientId: clientId === "" ? undefined : clientId,
    status,
    maintenanceType
  }), [search, clientId, status, maintenanceType]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "maintenance-orders", params, page],
    queryFn: () => listMaintenanceOrders({ ...params, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });
  const clients = useQuery({ queryKey: ["sentinelgrid", "clients"], queryFn: () => listClients() });
  const equipment = useQuery({ queryKey: ["sentinelgrid", "equipment", "order-select"], queryFn: () => listEquipment({ pageSize: 100 }) });
  const plans = useQuery({ queryKey: ["sentinelgrid", "plans", "order-select"], queryFn: () => listEquipmentPlans({ active: true }) });
  const checklists = useQuery({ queryKey: ["sentinelgrid", "checklists", "order-select"], queryFn: () => listChecklists({ active: true }) });
  const managers = useQuery({ queryKey: ["sentinelgrid", "managers", "order-approval"], queryFn: () => listManagers() });
  const selectedPlan = useQuery({
    queryKey: ["sentinelgrid", "plans", "order-generate", fromPlanForm.planId],
    queryFn: () => getEquipmentPlan(fromPlanForm.planId),
    enabled: Boolean(fromPlanForm.planId)
  });
  const checklistExecution = useQuery({
    queryKey: ["sentinelgrid", "order-checklist-execution", selectedOrder?.id],
    queryFn: () => getOrderChecklistExecution(selectedOrder!.id),
    enabled: Boolean(showChecklist && selectedOrder?.id)
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "maintenance-orders"] });
  const onError = (e: unknown) => setActionError((e as Error).message);
  const mCreate = useMutation({ mutationFn: createMaintenanceOrder, onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mCreateFromPlan = useMutation({ mutationFn: createMaintenanceOrderFromPlan, onSuccess: () => { setShowFromPlan(false); invalidate(); }, onError });
  const mCreateFromPlanAll = useMutation({
    mutationFn: (planId: number) => createMaintenanceOrdersFromPlans({
      planIds: [planId],
      checklistId: fromPlanForm.checklistId,
      priority: fromPlanForm.priority,
      technicianId: fromPlanForm.technicianId,
      notes: fromPlanForm.notes
    }),
    onSuccess: (r) => {
      setShowFromPlan(false);
      setInfoMsg(`Geradas ${r.created} ordem(ns) do plano${r.skipped ? ` · ${r.skipped} já existia(m)` : ""}.`);
      invalidate();
    },
    onError
  });
  const mUpdate = useMutation({ mutationFn: (p: { id: number; input: SgMaintenanceOrderInput }) => updateMaintenanceOrder(p.id, p.input), onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: deleteMaintenanceOrder, onSuccess: invalidate, onError });
  const mTransition = useMutation({ mutationFn: (p: { id: number; input: SgOrderStatusInput }) => transitionMaintenanceOrderStatus(p.id, p.input), onSuccess: () => { setShowTransition(false); setSelectedOrder(null); invalidate(); }, onError });
  const mApproval = useMutation({ mutationFn: (p: { id: number; input: SgOrderApprovalInput }) => createOrderApproval(p.id, p.input), onSuccess: () => { setShowApproval(false); setSelectedOrder(null); invalidate(); }, onError });
  const mSaveChecklist = useMutation({ mutationFn: (p: { orderId: number; input: SgChecklistResultInput }) => saveOrderChecklistResult(p.orderId, p.input), onSuccess: () => { if (selectedOrder?.id) qc.invalidateQueries({ queryKey: ["sentinelgrid", "order-checklist-execution", selectedOrder.id] }); }, onError });
  const mMeasurement = useMutation({ mutationFn: (input: SgMeasurementInput) => createMeasurement(input), onSuccess: () => setMeasurementForm({ ...EMPTY_MEASUREMENT }), onError });
  const mPart = useMutation({ mutationFn: (input: SgPartInput) => createPart(input), onSuccess: () => setPartForm({ ...EMPTY_PART }), onError });
  const mReport = useMutation({ mutationFn: (input: SgReportInput) => createAssociatedReport(input), onSuccess: () => setReportForm({ ...EMPTY_REPORT }), onError });
  const mAttachment = useMutation({
    mutationFn: (input: typeof EMPTY_ATTACHMENT & { entityType: "order"; entityId: number }) => createAttachment(input),
    onSuccess: () => setAttachmentForm({ ...EMPTY_ATTACHMENT }),
    onError
  });

  const orders = data?.orders ?? [];
  const saving = mCreate.isPending || mUpdate.isPending;

  useEffect(() => {
    if (!checklistExecution.data) return;
    const next: Record<number, SgChecklistResultInput> = {};
    checklistExecution.data.items.forEach((item) => {
      next[item.checklist_item_id] = {
        checklistItemId: item.checklist_item_id,
        value: item.value || "",
        status: item.status || "pendente",
        notes: item.notes || ""
      };
    });
    setChecklistDrafts(next);
  }, [checklistExecution.data]);

  const setType = (next: SgMaintenanceType) => {
    setForm((cur) => ({
      ...cur,
      maintenanceType: next,
      status: cur.status,
      correctiveDetails: next === "corretiva" ? (cur.correctiveDetails || { ...EMPTY_CORRECTIVE }) : null
    }));
  };

  const openNew = () => {
    setEditId(null);
    setForm({ ...EMPTY });
    setActionError(null);
    setShow(true);
  };

  const openFromPlan = () => {
    setFromPlanAll(false);
    setFromPlanForm({ ...EMPTY_FROM_PLAN });
    setActionError(null);
    setShowFromPlan(true);
  };

  const openEdit = async (order: SgMaintenanceOrder) => {
    setLoadingEdit(true);
    setActionError(null);
    try {
      const full = await getMaintenanceOrder(order.id);
      setEditId(full.id);
      setForm(toInput(full));
      setShow(true);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setLoadingEdit(false);
    }
  };

  const openApproval = (order: SgMaintenanceOrder) => {
    setSelectedOrder(order);
    setApprovalForm({ ...EMPTY_APPROVAL, clientManagerId: order.client_manager_id || null });
    setActionError(null);
    setShowApproval(true);
  };

  const openTransition = (order: SgMaintenanceOrder) => {
    setSelectedOrder(order);
    setTransitionForm({ status: order.status, finalCondition: order.final_condition || "", notes: "" });
    setActionError(null);
    setShowTransition(true);
  };

  const openChecklist = (order: SgMaintenanceOrder) => {
    setSelectedOrder(order);
    setActionError(null);
    setShowChecklist(true);
  };

  const openExecution = (order: SgMaintenanceOrder) => {
    setSelectedOrder(order);
    setMeasurementForm({ ...EMPTY_MEASUREMENT, technicianId: order.technician_id || "" });
    setPartForm({ ...EMPTY_PART });
    setReportForm({ ...EMPTY_REPORT, technician: order.technician_id || "" });
    setAttachmentForm({ ...EMPTY_ATTACHMENT });
    setActionError(null);
    setShowExecution(true);
  };

  const submitApproval = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOrder) return;
    mApproval.mutate({ id: selectedOrder.id, input: approvalForm });
  };

  const submitTransition = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOrder) return;
    mTransition.mutate({ id: selectedOrder.id, input: transitionForm });
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };

  const setChecklistDraft = (itemId: number, patch: Partial<SgChecklistResultInput>) => {
    setChecklistDrafts((cur) => ({
      ...cur,
      [itemId]: { ...(cur[itemId] || { checklistItemId: itemId, value: "", status: "pendente", notes: "" }), ...patch }
    }));
  };

  const saveChecklistItem = (itemId: number) => {
    if (!selectedOrder) return;
    const input = checklistDrafts[itemId];
    if (!input) return;
    mSaveChecklist.mutate({ orderId: selectedOrder.id, input });
  };

  const submitFromPlan = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (fromPlanAll) mCreateFromPlanAll.mutate(fromPlanForm.planId);
    else mCreateFromPlan.mutate(fromPlanForm);
  };

  const submitMeasurement = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOrder) return;
    mMeasurement.mutate({ orderId: selectedOrder.id, ...measurementForm });
  };

  const submitPart = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOrder) return;
    mPart.mutate({ orderId: selectedOrder.id, ...partForm });
  };

  const submitReport = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOrder) return;
    mReport.mutate({ orderId: selectedOrder.id, ...reportForm });
  };

  const submitAttachment = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!selectedOrder) return;
    mAttachment.mutate({ entityType: "order", entityId: selectedOrder.id, ...attachmentForm });
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Ordens de manutencao</h2>
          <p className="text-muted mb-0 small">Criacao manual de OMs vinculadas a equipamento, plano e checklist.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/sentinelgrid/plans" className="btn btn-outline-secondary btn-sm">Planos</Link>
          <Button size="sm" variant="outline-primary" onClick={openFromPlan}>Gerar por plano</Button>
          <Button size="sm" onClick={openNew}>Nova OM</Button>
        </div>
      </div>

      <Card>
        <Card.Body>
          <div className="row g-2 align-items-end">
            <div className="col-md-4">
              <Form.Label>Busca</Form.Label>
              <Form.Control value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Numero, TAG ou escopo" />
            </div>
            <div className="col-md-3">
              <Form.Label>Cliente</Form.Label>
              <Form.Select value={clientId} onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : ""); setPage(1); }}>
                <option value="">Todos</option>
                {(clients.data?.clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-2">
              <Form.Label>Status</Form.Label>
              <Form.Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {ORDER_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-2">
              <Form.Label>Tipo</Form.Label>
              <Form.Select value={maintenanceType} onChange={(e) => { setMaintenanceType(e.target.value); setPage(1); }}>
                <option value="">Todos</option>
                {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-1 d-grid">
              <Button variant="outline-secondary" onClick={() => { setSearch(""); setClientId(""); setStatus(""); setMaintenanceType(""); setPage(1); }}>Limpar</Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {infoMsg && <Alert variant="success" dismissible onClose={() => setInfoMsg(null)}>{infoMsg}</Alert>}
      {actionError && !show && !showFromPlan && !showApproval && !showTransition && !showChecklist && !showExecution && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        {isLoading ? (
          <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando...</Card.Body>
        ) : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{(error as Error).message}</Alert></Card.Body>
        ) : (
          <Table striped responsive hover className="mb-0 align-middle">
            <thead><tr><th>OM</th><th>Equipamento</th><th>Tipo</th><th>Status</th><th>Planejada</th><th>Escopo</th><th className="text-end">Acoes</th></tr></thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhuma OM cadastrada.</td></tr>}
              {orders.map((order) => {
                const meta = statusMeta(order.status);
                return (
                  <tr key={order.id}>
                    <td>
                      <div className="fw-semibold">{order.order_number}</div>
                      <div className="small text-muted">{order.priority || "normal"}</div>
                    </td>
                    <td>
                      <div>{order.equipment_tag || order.equipment_serial_number || `#${order.equipment_id}`}</div>
                      <div className="small text-muted">{order.client_name} / {order.site_name} / {order.area_name}</div>
                    </td>
                    <td>{labelOf(MAINTENANCE_TYPE_OPTIONS, order.maintenance_type)}</td>
                    <td><Badge bg={meta.variant as string}>{meta.label}</Badge></td>
                    <td>{formatDate(order.planned_date)}</td>
                    <td>{order.scope || order.plan_name || order.checklist_name || "-"}</td>
                    <td className="text-end">
                      <div className="vx-actions justify-content-end">
                        <IconAction icon="checklist" label="Executar checklist" variant="outline-success" disabled={!order.checklist_id} onClick={() => openChecklist(order)} />
                        <IconAction icon="engineering" label="Execucao tecnica" variant="outline-success" onClick={() => openExecution(order)} />
                        <IconAction icon="published_with_changes" label="Alterar status" variant="outline-primary" disabled={mTransition.isPending} onClick={() => openTransition(order)} />
                        {order.maintenance_type === "preventiva_com_parada" && (
                          <IconAction icon="check_circle" label="Aprovar parada" variant="outline-success" disabled={mApproval.isPending} onClick={() => openApproval(order)} />
                        )}
                        <IconAction icon="edit" label="Editar" variant="outline-secondary" disabled={loadingEdit} onClick={() => openEdit(order)} />
                        <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir a OM "${order.order_number}"?`)) mDelete.mutate(order.id); }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {!isLoading && !error && <Pager page={data?.page ?? page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />}
      </Card>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar OM" : "Nova OM"}</Modal.Title></Modal.Header>
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
              <div className="col-md-4">
                <Form.Label>Data planejada</Form.Label>
                <Form.Control type="date" value={form.plannedDate || ""} onChange={(e) => setForm({ ...form, plannedDate: e.target.value || null })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Tipo de manutencao</Form.Label>
                <Form.Select required value={form.maintenanceType} onChange={(e) => setType(e.target.value as SgMaintenanceType)}>
                  {MAINTENANCE_TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Status</Form.Label>
                <Form.Select value={form.status || ""} onChange={(e) => setForm({ ...form, status: e.target.value ? e.target.value as SgOrderStatus : undefined })}>
                  <option value="">Automatico</option>
                  {ORDER_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Plano</Form.Label>
                <Form.Select value={form.planId ?? ""} onChange={(e) => setForm({ ...form, planId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem vinculo</option>
                  {(plans.data?.plans || []).map((p) => <option key={p.id} value={p.id}>{p.equipment_tag || `#${p.equipment_id}`} / {p.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Checklist</Form.Label>
                <Form.Select value={form.checklistId ?? ""} onChange={(e) => setForm({ ...form, checklistId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem vinculo</option>
                  {(checklists.data?.checklists || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Prioridade</Form.Label>
                <Form.Control value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} placeholder="normal, alta, critica..." />
              </div>
              <div className="col-md-6">
                <Form.Label>Tecnico / equipe</Form.Label>
                <Form.Control value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Escopo</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
              </div>
              {form.maintenanceType === "corretiva" && form.correctiveDetails && (
                <>
                  <div className="col-md-6">
                    <Form.Label>Sintoma</Form.Label>
                    <Form.Control required value={form.correctiveDetails.symptom} onChange={(e) => setForm({ ...form, correctiveDetails: { ...form.correctiveDetails!, symptom: e.target.value } })} />
                  </div>
                  <div className="col-md-6">
                    <Form.Label>Alarme</Form.Label>
                    <Form.Control value={form.correctiveDetails.alarm} onChange={(e) => setForm({ ...form, correctiveDetails: { ...form.correctiveDetails!, alarm: e.target.value } })} />
                  </div>
                  <div className="col-md-8">
                    <Form.Label>Impacto operacional</Form.Label>
                    <Form.Control required value={form.correctiveDetails.operationalImpact} onChange={(e) => setForm({ ...form, correctiveDetails: { ...form.correctiveDetails!, operationalImpact: e.target.value } })} />
                  </div>
                  <div className="col-md-4">
                    <Form.Label>Classe</Form.Label>
                    <Form.Select value={form.correctiveDetails.correctiveClass} onChange={(e) => setForm({ ...form, correctiveDetails: { ...form.correctiveDetails!, correctiveClass: e.target.value as SgCorrectiveClass } })}>
                      {CORRECTIVE_CLASS_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </Form.Select>
                  </div>
                  <div className="col-md-6">
                    <Form.Label>Causa provavel</Form.Label>
                    <Form.Control value={form.correctiveDetails.probableCause} onChange={(e) => setForm({ ...form, correctiveDetails: { ...form.correctiveDetails!, probableCause: e.target.value } })} />
                  </div>
                  <div className="col-md-6">
                    <Form.Label>Acao tomada</Form.Label>
                    <Form.Control value={form.correctiveDetails.actionTaken} onChange={(e) => setForm({ ...form, correctiveDetails: { ...form.correctiveDetails!, actionTaken: e.target.value } })} />
                  </div>
                </>
              )}
              <div className="col-12">
                <Form.Label>Observacoes</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !form.equipmentId}>{saving ? "Salvando..." : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showFromPlan} onHide={() => setShowFromPlan(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Gerar OM por plano</Modal.Title></Modal.Header>
        <Form onSubmit={submitFromPlan}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-12">
                <Form.Label>Plano</Form.Label>
                <Form.Select required value={fromPlanForm.planId || ""} onChange={(e) => setFromPlanForm({ ...fromPlanForm, planId: Number(e.target.value), planItemId: null })}>
                  <option value="">Selecione...</option>
                  {(plans.data?.plans || []).map((p) => <option key={p.id} value={p.id}>{p.equipment_tag || `#${p.equipment_id}`} / {p.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-12">
                <Form.Check
                  type="switch"
                  label="Gerar OMs de todos os itens do plano"
                  checked={fromPlanAll}
                  onChange={(e) => setFromPlanAll(e.target.checked)}
                />
              </div>
              {fromPlanAll ? (
                <div className="col-12">
                  <Alert variant="info" className="py-2 mb-0 small">
                    Serão geradas OMs para <strong>todos os {(selectedPlan.data?.items || []).length} itens</strong> do plano, cada uma na data do item. Itens que já têm OM são ignorados.
                  </Alert>
                </div>
              ) : (
                <>
                  <div className="col-md-8">
                    <Form.Label>Item do plano</Form.Label>
                    <Form.Select value={fromPlanForm.planItemId ?? ""} disabled={!fromPlanForm.planId || selectedPlan.isLoading} onChange={(e) => setFromPlanForm({ ...fromPlanForm, planItemId: e.target.value ? Number(e.target.value) : null })}>
                      <option value="">Primeiro item ativo</option>
                      {(selectedPlan.data?.items || []).map((item) => <option key={item.id} value={item.id}>{item.order_index} - {item.title}</option>)}
                    </Form.Select>
                  </div>
                  <div className="col-md-4">
                    <Form.Label>Data planejada</Form.Label>
                    <Form.Control type="date" value={fromPlanForm.plannedDate || ""} onChange={(e) => setFromPlanForm({ ...fromPlanForm, plannedDate: e.target.value || null })} />
                  </div>
                </>
              )}
              <div className="col-md-6">
                <Form.Label>Prioridade</Form.Label>
                <Form.Control value={fromPlanForm.priority} onChange={(e) => setFromPlanForm({ ...fromPlanForm, priority: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Checklist</Form.Label>
                <Form.Select value={fromPlanForm.checklistId ?? ""} onChange={(e) => setFromPlanForm({ ...fromPlanForm, checklistId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Sem vinculo</option>
                  {(checklists.data?.checklists || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Tecnico / equipe</Form.Label>
                <Form.Control value={fromPlanForm.technicianId} onChange={(e) => setFromPlanForm({ ...fromPlanForm, technicianId: e.target.value })} />
              </div>
              {!fromPlanAll && (
                <div className="col-md-6">
                  <Form.Label>Escopo gerado</Form.Label>
                  <Form.Control value={fromPlanForm.scope} onChange={(e) => setFromPlanForm({ ...fromPlanForm, scope: e.target.value })} placeholder="Se vazio, usa Plano - Item" />
                </div>
              )}
              <div className="col-12">
                <Form.Label>Observacoes</Form.Label>
                <Form.Control as="textarea" rows={2} value={fromPlanForm.notes} onChange={(e) => setFromPlanForm({ ...fromPlanForm, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowFromPlan(false)}>Cancelar</Button>
            <Button type="submit" disabled={mCreateFromPlan.isPending || mCreateFromPlanAll.isPending || !fromPlanForm.planId}>
              {mCreateFromPlan.isPending || mCreateFromPlanAll.isPending ? "Gerando..." : (fromPlanAll ? "Gerar OMs dos itens" : "Gerar OM")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showChecklist} onHide={() => setShowChecklist(false)} size="xl">
        <Modal.Header closeButton><Modal.Title>Executar checklist{selectedOrder ? ` - ${selectedOrder.order_number}` : ""}</Modal.Title></Modal.Header>
        <Modal.Body>
          {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
          {checklistExecution.isLoading ? (
            <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando checklist...</div>
          ) : checklistExecution.error ? (
            <Alert variant="danger" className="mb-0">{(checklistExecution.error as Error).message}</Alert>
          ) : (
            <Table responsive hover className="mb-0 align-middle">
              <thead><tr><th style={{ width: 56 }}>#</th><th>Item</th><th style={{ width: 150 }}>Status</th><th style={{ width: 190 }}>Valor</th><th>Notas</th><th className="text-end">Salvar</th></tr></thead>
              <tbody>
                {(checklistExecution.data?.items || []).map((item) => {
                  const draft = checklistDrafts[item.checklist_item_id] || { checklistItemId: item.checklist_item_id, value: "", status: "pendente", notes: "" };
                  return (
                    <tr key={item.checklist_item_id}>
                      <td>{item.order_index}</td>
                      <td>
                        <div className="fw-semibold">{item.title}</div>
                        <div className="small text-muted">
                          {[item.expected_value, item.unit].filter(Boolean).join(" ")}
                          {item.acceptance_criteria ? ` - ${item.acceptance_criteria}` : ""}
                        </div>
                      </td>
                      <td>
                        <Form.Select size="sm" value={draft.status} onChange={(e) => setChecklistDraft(item.checklist_item_id, { status: e.target.value as SgChecklistResultInput["status"] })}>
                          {CHECKLIST_RESULT_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </Form.Select>
                      </td>
                      <td><Form.Control size="sm" value={draft.value} onChange={(e) => setChecklistDraft(item.checklist_item_id, { value: e.target.value })} /></td>
                      <td><Form.Control size="sm" value={draft.notes} onChange={(e) => setChecklistDraft(item.checklist_item_id, { notes: e.target.value })} /></td>
                      <td className="text-end">
                        <IconAction icon="save" label="Salvar item" variant="outline-primary" disabled={mSaveChecklist.isPending} onClick={() => saveChecklistItem(item.checklist_item_id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Modal.Body>
      </Modal>

      <Modal show={showExecution} onHide={() => setShowExecution(false)} size="xl">
        <Modal.Header closeButton><Modal.Title>Execucao tecnica{selectedOrder ? ` - ${selectedOrder.order_number}` : ""}</Modal.Title></Modal.Header>
        <Modal.Body>
          {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
          <div className="row g-3">
            <div className="col-lg-6">
              <Card className="h-100">
                <Card.Header>Medicao tecnica</Card.Header>
                <Card.Body>
                  <Form onSubmit={submitMeasurement} className="row g-2">
                    <div className="col-md-6">
                      <Form.Label>Metrica</Form.Label>
                      <Form.Control required value={measurementForm.metric} onChange={(e) => setMeasurementForm({ ...measurementForm, metric: e.target.value })} placeholder="tensao_saida" />
                    </div>
                    <div className="col-md-3">
                      <Form.Label>Valor</Form.Label>
                      <Form.Control required value={measurementForm.value} onChange={(e) => setMeasurementForm({ ...measurementForm, value: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <Form.Label>Unidade</Form.Label>
                      <Form.Control value={measurementForm.unit} onChange={(e) => setMeasurementForm({ ...measurementForm, unit: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Tecnico</Form.Label>
                      <Form.Control value={measurementForm.technicianId} onChange={(e) => setMeasurementForm({ ...measurementForm, technicianId: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Data/hora</Form.Label>
                      <Form.Control type="datetime-local" value={measurementForm.measuredAt ? measurementForm.measuredAt.slice(0, 16) : ""} onChange={(e) => setMeasurementForm({ ...measurementForm, measuredAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                    </div>
                    <div className="col-12">
                      <Form.Label>Notas</Form.Label>
                      <Form.Control as="textarea" rows={2} value={measurementForm.notes} onChange={(e) => setMeasurementForm({ ...measurementForm, notes: e.target.value })} />
                    </div>
                    <div className="col-12 text-end">
                      <Button size="sm" type="submit" disabled={mMeasurement.isPending}>{mMeasurement.isPending ? "Salvando..." : "Salvar medicao"}</Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </div>

            <div className="col-lg-6">
              <Card className="h-100">
                <Card.Header>Peca substituida</Card.Header>
                <Card.Body>
                  <Form onSubmit={submitPart} className="row g-2">
                    <div className="col-md-7">
                      <Form.Label>Descricao</Form.Label>
                      <Form.Control required value={partForm.partDescription} onChange={(e) => setPartForm({ ...partForm, partDescription: e.target.value })} />
                    </div>
                    <div className="col-md-3">
                      <Form.Label>Codigo</Form.Label>
                      <Form.Control value={partForm.partCode} onChange={(e) => setPartForm({ ...partForm, partCode: e.target.value })} />
                    </div>
                    <div className="col-md-2">
                      <Form.Label>Qtd.</Form.Label>
                      <Form.Control type="number" min="0.01" step="0.01" value={partForm.quantity} onChange={(e) => setPartForm({ ...partForm, quantity: Number(e.target.value) })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Fabricante</Form.Label>
                      <Form.Control value={partForm.manufacturer} onChange={(e) => setPartForm({ ...partForm, manufacturer: e.target.value })} />
                    </div>
                    <div className="col-md-6 d-flex align-items-end">
                      <Form.Check label="Peca nova instalada" checked={partForm.newPartInstalled} onChange={(e) => setPartForm({ ...partForm, newPartInstalled: e.target.checked })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Motivo</Form.Label>
                      <Form.Control as="textarea" rows={2} value={partForm.reason} onChange={(e) => setPartForm({ ...partForm, reason: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Condicao removida</Form.Label>
                      <Form.Control as="textarea" rows={2} value={partForm.removedCondition} onChange={(e) => setPartForm({ ...partForm, removedCondition: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <Form.Label>Evidencia</Form.Label>
                      <Form.Control value={partForm.evidence} onChange={(e) => setPartForm({ ...partForm, evidence: e.target.value })} />
                    </div>
                    <div className="col-12 text-end">
                      <Button size="sm" type="submit" disabled={mPart.isPending}>{mPart.isPending ? "Salvando..." : "Salvar peca"}</Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </div>

            <div className="col-lg-6">
              <Card className="h-100">
                <Card.Header>Relatorio associado</Card.Header>
                <Card.Body>
                  <Form onSubmit={submitReport} className="row g-2">
                    <div className="col-md-4">
                      <Form.Label>Codigo</Form.Label>
                      <Form.Control value={reportForm.reportCode} onChange={(e) => setReportForm({ ...reportForm, reportCode: e.target.value })} />
                    </div>
                    <div className="col-md-8">
                      <Form.Label>Titulo</Form.Label>
                      <Form.Control required value={reportForm.title} onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Data de emissao</Form.Label>
                      <Form.Control type="datetime-local" value={reportForm.issuedAt ? reportForm.issuedAt.slice(0, 16) : ""} onChange={(e) => setReportForm({ ...reportForm, issuedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Tecnico</Form.Label>
                      <Form.Control value={reportForm.technician} onChange={(e) => setReportForm({ ...reportForm, technician: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Tipo</Form.Label>
                      <Form.Control value={reportForm.reportType} onChange={(e) => setReportForm({ ...reportForm, reportType: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>ID externo</Form.Label>
                      <Form.Control value={reportForm.externalId} onChange={(e) => setReportForm({ ...reportForm, externalId: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Arquivo / ref</Form.Label>
                      <Form.Control value={reportForm.fileRef} onChange={(e) => setReportForm({ ...reportForm, fileRef: e.target.value })} />
                    </div>
                    <div className="col-md-6">
                      <Form.Label>Link externo</Form.Label>
                      <Form.Control value={reportForm.externalLink} onChange={(e) => setReportForm({ ...reportForm, externalLink: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <Form.Label>Notas</Form.Label>
                      <Form.Control as="textarea" rows={2} value={reportForm.notes} onChange={(e) => setReportForm({ ...reportForm, notes: e.target.value })} />
                    </div>
                    <div className="col-12 text-end">
                      <Button size="sm" type="submit" disabled={mReport.isPending}>{mReport.isPending ? "Salvando..." : "Associar relatorio"}</Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </div>

            <div className="col-lg-6">
              <Card className="h-100">
                <Card.Header>Anexo da OM</Card.Header>
                <Card.Body>
                  <Form onSubmit={submitAttachment} className="row g-2">
                    <div className="col-md-8">
                      <Form.Label>Arquivo / referencia</Form.Label>
                      <Form.Control required value={attachmentForm.fileRef} onChange={(e) => setAttachmentForm({ ...attachmentForm, fileRef: e.target.value })} />
                    </div>
                    <div className="col-md-4">
                      <Form.Label>Tipo</Form.Label>
                      <Form.Control value={attachmentForm.kind} onChange={(e) => setAttachmentForm({ ...attachmentForm, kind: e.target.value })} placeholder="foto, pdf, log..." />
                    </div>
                    <div className="col-12">
                      <Form.Label>Rotulo</Form.Label>
                      <Form.Control value={attachmentForm.label} onChange={(e) => setAttachmentForm({ ...attachmentForm, label: e.target.value })} />
                    </div>
                    <div className="col-12">
                      <Form.Label>Notas</Form.Label>
                      <Form.Control as="textarea" rows={2} value={attachmentForm.notes} onChange={(e) => setAttachmentForm({ ...attachmentForm, notes: e.target.value })} />
                    </div>
                    <div className="col-12 text-end">
                      <Button size="sm" type="submit" disabled={mAttachment.isPending}>{mAttachment.isPending ? "Salvando..." : "Salvar anexo"}</Button>
                    </div>
                  </Form>
                </Card.Body>
              </Card>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      <Modal show={showTransition} onHide={() => setShowTransition(false)}>
        <Modal.Header closeButton><Modal.Title>Alterar status{selectedOrder ? ` - ${selectedOrder.order_number}` : ""}</Modal.Title></Modal.Header>
        <Form onSubmit={submitTransition}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <Form.Label>Novo status</Form.Label>
            <Form.Select value={transitionForm.status} onChange={(e) => setTransitionForm({ ...transitionForm, status: e.target.value as SgOrderStatus })}>
              {ORDER_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Form.Select>
            {["concluida", "concluida_com_pendencias"].includes(transitionForm.status) && (
              <>
                <Form.Label className="mt-3">Condicao final</Form.Label>
                <Form.Control as="textarea" rows={2} value={transitionForm.finalCondition} onChange={(e) => setTransitionForm({ ...transitionForm, finalCondition: e.target.value })} />
                <Form.Label className="mt-3">Observacao da transicao</Form.Label>
                <Form.Control as="textarea" rows={2} value={transitionForm.notes} onChange={(e) => setTransitionForm({ ...transitionForm, notes: e.target.value })} />
              </>
            )}
            {selectedOrder?.maintenance_type === "preventiva_com_parada" && (
              <div className="small text-muted mt-2">
                Para aprovar ou executar uma preventiva com parada, registre a aprovacao do cliente primeiro.
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowTransition(false)}>Cancelar</Button>
            <Button type="submit" disabled={mTransition.isPending}>{mTransition.isPending ? "Salvando..." : "Alterar status"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <Modal show={showApproval} onHide={() => setShowApproval(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Aprovacao do cliente{selectedOrder ? ` - ${selectedOrder.order_number}` : ""}</Modal.Title></Modal.Header>
        <Form onSubmit={submitApproval}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Label>Gestor cadastrado</Form.Label>
                <Form.Select value={approvalForm.clientManagerId ?? ""} onChange={(e) => setApprovalForm({ ...approvalForm, clientManagerId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">Nao vincular</option>
                  {(managers.data?.managers || [])
                    .filter((m) => !selectedOrder || Number(m.client_id) === Number(selectedOrder.client_id))
                    .map((m) => <option key={m.id} value={m.id}>{m.name} - {m.role_type}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Nome do aprovador</Form.Label>
                <Form.Control value={approvalForm.approverName} onChange={(e) => setApprovalForm({ ...approvalForm, approverName: e.target.value })} placeholder="Obrigatorio se nao selecionar gestor" />
              </div>
              <div className="col-md-6">
                <Form.Label>Data/hora da aprovacao</Form.Label>
                <Form.Control type="datetime-local" value={approvalForm.approvedAt ? approvalForm.approvedAt.slice(0, 16) : ""} onChange={(e) => setApprovalForm({ ...approvalForm, approvedAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <Form.Check label="Aceite final do cliente" checked={approvalForm.finalAccept} onChange={(e) => setApprovalForm({ ...approvalForm, finalAccept: e.target.checked })} />
              </div>
              <div className="col-12">
                <Form.Label>Janela autorizada</Form.Label>
                <Form.Control value={approvalForm.authorizedWindow} onChange={(e) => setApprovalForm({ ...approvalForm, authorizedWindow: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Restricoes</Form.Label>
                <Form.Control as="textarea" rows={2} value={approvalForm.restrictions} onChange={(e) => setApprovalForm({ ...approvalForm, restrictions: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Condicao de liberacao</Form.Label>
                <Form.Control as="textarea" rows={2} value={approvalForm.releaseCondition} onChange={(e) => setApprovalForm({ ...approvalForm, releaseCondition: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Observacoes</Form.Label>
                <Form.Control as="textarea" rows={2} value={approvalForm.notes} onChange={(e) => setApprovalForm({ ...approvalForm, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowApproval(false)}>Cancelar</Button>
            <Button type="submit" disabled={mApproval.isPending || (!approvalForm.clientManagerId && !approvalForm.approverName.trim())}>{mApproval.isPending ? "Salvando..." : "Registrar aprovacao"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
}
