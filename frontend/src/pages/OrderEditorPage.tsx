import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import IconAction from "../components/IconAction";
import RichTextEditor from "../components/RichTextEditor";
import ComponentsStyleModal from "../components/ComponentsStyleModal";
import AttachmentsPanel from "../components/AttachmentsPanel";
import SendOsEmailPanel from "../components/SendOsEmailPanel";
import MeasurementsPanel from "../components/MeasurementsPanel";
import UpsDataPanel from "../components/UpsDataPanel";
import {
  Component,
  ComponentInput,
  DailyLog,
  DailyLogInput,
  TimesheetEntry,
  TimesheetInput,
  addComponent,
  addTimesheet,
  attachEquipment,
  deleteComponent,
  deleteDailyLog,
  deleteTimesheet,
  detachEquipment,
  generateConclusion,
  getOrderEditor,
  linkInstrument,
  linkTechnician,
  reviseDailyLogText,
  revalidateOrder,
  saveDailyLog,
  unlinkInstrument,
  unlinkTechnician,
  updateComponent,
  updateTimesheet,
  validateOrder
} from "../api/orderEditor";

function stripHtml(html: string | null): string {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

const EMPTY_LOG: DailyLogInput = { activityDate: "", title: "", content: "", notes: "", sortOrder: 0 };

const EMPTY_COMPONENT: ComponentInput = { category: "", equipmentId: "", quantity: "", description: "", partNumber: "", notes: "" };

function toComponentInput(c: Component): ComponentInput {
  return {
    category: c.category ?? "",
    equipmentId: c.equipment_id ?? "",
    quantity: c.quantity ?? "",
    description: c.description ?? "",
    partNumber: c.part_number ?? "",
    notes: c.notes ?? ""
  };
}

interface LinkItem { id: number; label: string }

function LinkListCard(props: {
  title: string;
  linked: LinkItem[];
  available: LinkItem[];
  addLabel: string;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
  locked: boolean;
  busy: boolean;
}) {
  const [sel, setSel] = useState<string>("");
  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>{props.title}</span>
        <Badge bg="light" text="dark">{props.linked.length}</Badge>
      </Card.Header>
      {!props.locked && (
        <Card.Body className="d-flex gap-2">
          <Form.Select size="sm" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="">{props.addLabel}</option>
            {props.available.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </Form.Select>
          <Button size="sm" disabled={!sel || props.busy} onClick={() => { props.onAdd(Number(sel)); setSel(""); }}>Vincular</Button>
        </Card.Body>
      )}
      <Table striped responsive hover className="mb-0 align-middle">
        <tbody>
          {props.linked.length === 0 && <tr><td className="text-muted">Nenhum vínculo.</td></tr>}
          {props.linked.map((l) => (
            <tr key={l.id}>
              <td>{l.label}</td>
              <td className="text-end" style={{ width: 60 }}>
                {!props.locked && (
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="link_off" label="Remover" variant="outline-danger" disabled={props.busy} onClick={() => props.onRemove(l.id)} />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

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

  const mAttachEq = useMutation({ mutationFn: (id: number) => attachEquipment(orderId, id), onSuccess: invalidate, onError });
  const mDetachEq = useMutation({ mutationFn: (id: number) => detachEquipment(orderId, id), onSuccess: invalidate, onError });
  const mLinkTech = useMutation({ mutationFn: (id: number) => linkTechnician(orderId, id), onSuccess: invalidate, onError });
  const mUnlinkTech = useMutation({ mutationFn: (id: number) => unlinkTechnician(orderId, id), onSuccess: invalidate, onError });
  const mLinkInstr = useMutation({ mutationFn: (id: number) => linkInstrument(orderId, id), onSuccess: invalidate, onError });
  const mUnlinkInstr = useMutation({ mutationFn: (id: number) => unlinkInstrument(orderId, id), onSuccess: invalidate, onError });

  // Diário de bordo
  const [logShow, setLogShow] = useState(false);
  const [logEditId, setLogEditId] = useState<number | null>(null);
  const [logForm, setLogForm] = useState<DailyLogInput>(EMPTY_LOG);
  const [revising, setRevising] = useState(false);
  const mSaveLog = useMutation({
    mutationFn: (input: DailyLogInput) => saveDailyLog(orderId, input),
    onSuccess: () => { setLogShow(false); invalidate(); },
    onError
  });
  const mDeleteLog = useMutation({ mutationFn: (logId: number) => deleteDailyLog(orderId, logId), onSuccess: invalidate, onError });
  const mConclusion = useMutation({ mutationFn: () => generateConclusion(orderId), onSuccess: invalidate, onError });

  // Componentes (tabela)
  const [cmpShow, setCmpShow] = useState(false);
  const [cmpEditId, setCmpEditId] = useState<number | null>(null);
  const [cmpForm, setCmpForm] = useState<ComponentInput>(EMPTY_COMPONENT);
  const [pnSuggestionsOpen, setPnSuggestionsOpen] = useState(false);
  const [activePnIndex, setActivePnIndex] = useState(-1);
  const mCreateCmp = useMutation({ mutationFn: (input: ComponentInput) => addComponent(orderId, input), onSuccess: () => { setCmpShow(false); invalidate(); }, onError });
  const mUpdateCmp = useMutation({ mutationFn: (p: { id: number; input: ComponentInput }) => updateComponent(orderId, p.id, p.input), onSuccess: () => { setCmpShow(false); invalidate(); }, onError });
  const mDeleteCmp = useMutation({ mutationFn: (componentId: number) => deleteComponent(orderId, componentId), onSuccess: invalidate, onError });
  const [cmpStyleShow, setCmpStyleShow] = useState(false);

  // Validar / Revalidar OS
  const mValidate = useMutation({
    mutationFn: () => validateOrder(orderId),
    onSuccess: invalidate,
    onError: (e: unknown) => {
      const err = e as Error & { missing?: string[] };
      setActionError(Array.isArray(err.missing) && err.missing.length ? err.missing.join(" ") : err.message);
    }
  });
  const mRevalidate = useMutation({ mutationFn: () => revalidateOrder(orderId), onSuccess: invalidate, onError });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error || !data) {
    return <Alert variant="danger">Falha ao carregar a OS: {(error as Error)?.message}</Alert>;
  }

  const {
    order, timesheet, dailyLogs, technicians, locked,
    orderEquipments, availableEquipments,
    linkedTechnicians, availableTechnicians,
    linkedInstruments, availableInstruments,
    components, componentCategories, spareParts, componentsHasStyle,
    validation, isSystemAdmin
  } = data;
  const status = String(order.status || "").toLowerCase();
  const statusVariant = status === "valid" ? "success" : status === "approved" ? "primary" : "secondary";

  const openNewLog = () => { setLogEditId(null); setLogForm(EMPTY_LOG); setActionError(null); setLogShow(true); };
  const openEditLog = (l: DailyLog) => {
    setLogEditId(l.id);
    setLogForm({ activityDate: l.activity_date ? l.activity_date.slice(0, 10) : "", title: l.title ?? "", content: l.content ?? "", notes: l.notes ?? "", sortOrder: l.sort_order ?? 0 });
    setActionError(null);
    setLogShow(true);
  };
  const submitLog = (ev: React.FormEvent) => {
    ev.preventDefault();
    mSaveLog.mutate(logEditId ? { ...logForm, dailyLogId: logEditId } : logForm);
  };
  const reviseLog = async () => {
    if (!stripHtml(logForm.content)) return;
    setRevising(true);
    setActionError(null);
    try {
      const r = await reviseDailyLogText(orderId, stripHtml(logForm.content));
      setLogForm((f) => ({ ...f, content: r.revisedHtml || r.revisedText || f.content }));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setRevising(false);
    }
  };
  const totalHours = timesheet.reduce((sum, t) => sum + (Number(t.worked_hours) || 0), 0);

  const openNewCmp = () => { setCmpEditId(null); setCmpForm({ ...EMPTY_COMPONENT, category: componentCategories[0] ?? "" }); setPnSuggestionsOpen(false); setActivePnIndex(-1); setActionError(null); setCmpShow(true); };
  const openEditCmp = (c: Component) => { setCmpEditId(c.id); setCmpForm(toComponentInput(c)); setPnSuggestionsOpen(false); setActivePnIndex(-1); setActionError(null); setCmpShow(true); };
  const submitCmp = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (cmpEditId) mUpdateCmp.mutate({ id: cmpEditId, input: cmpForm });
    else mCreateCmp.mutate(cmpForm);
  };
  const savingCmp = mCreateCmp.isPending || mUpdateCmp.isPending;
  const normalizedPnSearch = cmpForm.partNumber.trim().toLocaleLowerCase("pt-BR");
  const pnSuggestions = spareParts
    .filter((spare) => {
      if (!spare.part_number) return false;
      if (!normalizedPnSearch) return true;
      return spare.part_number.toLocaleLowerCase("pt-BR").includes(normalizedPnSearch)
        || String(spare.description || "").toLocaleLowerCase("pt-BR").includes(normalizedPnSearch);
    })
    .slice(0, 50);
  const selectPnSuggestion = (index: number) => {
    const spare = pnSuggestions[index];
    if (!spare?.part_number) return;
    setCmpForm((current) => ({
      ...current,
      partNumber: spare.part_number || current.partNumber,
      description: spare.description || current.description
    }));
    setPnSuggestionsOpen(false);
    setActivePnIndex(-1);
  };
  const closePnSuggestions = () => {
    const exactIndex = pnSuggestions.findIndex(
      (spare) => String(spare.part_number || "").trim().toLocaleLowerCase("pt-BR") === normalizedPnSearch
    );
    if (exactIndex >= 0) selectPnSuggestion(exactIndex);
    else {
      setPnSuggestionsOpen(false);
      setActivePnIndex(-1);
    }
  };
  const eqTag = (equipmentId: number | null): string => {
    if (equipmentId == null) return "—";
    const e = orderEquipments.find((x) => x.equipment_id === equipmentId);
    return e?.tag_number || "—";
  };

  const eqLinked: LinkItem[] = orderEquipments.map((e) => ({ id: e.equipment_id, label: `${e.type ?? ""}${e.serial_number ? ` — ${e.serial_number}` : ""}${e.tag_number ? ` [${e.tag_number}]` : ""}`.trim() }));
  const eqAvail: LinkItem[] = availableEquipments.map((e) => ({ id: e.id, label: `${e.type ?? ""}${e.serial_number ? ` — ${e.serial_number}` : ""}${e.tag_number ? ` [${e.tag_number}]` : ""}`.trim() }));
  const techLinked: LinkItem[] = linkedTechnicians.map((t) => ({ id: t.id, label: `${t.name}${t.role ? ` — ${t.role}` : ""}` }));
  const techAvail: LinkItem[] = availableTechnicians.map((t) => ({ id: t.id, label: t.name }));
  const instrLinked: LinkItem[] = linkedInstruments.map((i) => ({ id: i.id, label: `${i.name}${i.model ? ` (${i.model})` : ""}` }));
  const instrAvail: LinkItem[] = availableInstruments.map((i) => ({ id: i.id, label: `${i.name}${i.model ? ` (${i.model})` : ""}` }));

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
          <div className="d-flex gap-2">
            {status !== "approved" && (
              <Button size="sm" variant="success" disabled={!validation.valid || mValidate.isPending} onClick={() => mValidate.mutate()} title={validation.valid ? "Validar OS" : "Complete os requisitos para validar"}>
                {mValidate.isPending ? "Validando…" : "Validar OS"}
              </Button>
            )}
            {status === "approved" && isSystemAdmin && (
              <Button size="sm" variant="warning" disabled={mRevalidate.isPending} onClick={async () => { if (await confirmDialog("Revalidar a OS aprovada? Ela volta para 'valid' e a revisão do relatório é incrementada.")) mRevalidate.mutate(); }}>
                {mRevalidate.isPending ? "Revalidando…" : "Revalidar OS"}
              </Button>
            )}
            <Link className="btn btn-sm btn-primary" to={`/orders/${orderId}/report`}>Editor de relatório</Link>
            <a className="btn btn-sm btn-outline-secondary" href={`/admin/report-service/orders/${order.id}`}>Editor completo (legado)</a>
          </div>
        </Card.Header>
        <Card.Body>
          {locked && <Alert variant="warning">OS aprovada — somente leitura.</Alert>}
          <dl className="row mb-0">
            <dt className="col-sm-2">Título</dt><dd className="col-sm-10">{order.title || "—"}</dd>
            <dt className="col-sm-2">Cliente</dt><dd className="col-sm-4">{order.customer_name}</dd>
            <dt className="col-sm-2">Site</dt><dd className="col-sm-4">{order.site_name || "—"}</dd>
            <dt className="col-sm-2">Status</dt><dd className="col-sm-4"><Badge bg={statusVariant}>{order.status}</Badge></dd>
            <dt className="col-sm-2">Abertura</dt><dd className="col-sm-4">{fmtDate(order.opening_date)}</dd>
          </dl>

          {/* Requisitos de validação — só quando ainda não aprovada */}
          {status !== "approved" && (
            <div className="mt-3">
              <div className="small fw-semibold mb-1">
                Requisitos para validar {validation.valid
                  ? <Badge bg="success" className="ms-1">completos</Badge>
                  : <Badge bg="secondary" className="ms-1">{validation.missing.length} pendente(s)</Badge>}
              </div>
              <ul className="list-unstyled mb-0 small">
                {[
                  { ok: validation.hasEquipment, label: "Pelo menos 1 equipamento associado" },
                  { ok: validation.hasTimesheet, label: "Pelo menos 1 registro de timesheet" },
                  { ok: validation.hasDailyDescription, label: "Pelo menos 1 descrição diária" },
                  { ok: validation.hasConclusion, label: "Pelo menos 1 conclusão geral" },
                  { ok: validation.hasTechnicalTeam, label: "Pelo menos 1 pessoa na equipe técnica" }
                ].map((r) => (
                  <li key={r.label} className={r.ok ? "text-success" : "text-muted"}>
                    {r.ok ? "✓" : "○"} {r.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Abas de funcionalidades da OS */}
      <Tabs defaultActiveKey="diario" id="order-editor-tabs" className="mb-3" mountOnEnter>
        {/* Aba inicial: Diário de bordo + Apontamentos */}
        <Tab eventKey="diario" title="Diário de bordo">
          <div className="d-flex flex-column gap-4">
            {/* Diário de bordo */}
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center gap-2">
                <span>Diário de bordo <Badge bg="light" text="dark" className="ms-2">{dailyLogs.length}</Badge></span>
                {!locked && (
                  <div className="d-flex gap-2">
                    <Button size="sm" variant="outline-primary" disabled={mConclusion.isPending} onClick={async () => { if (await confirmDialog("Gerar/atualizar a conclusão geral a partir dos registros via IA?")) mConclusion.mutate(); }}>
                      {mConclusion.isPending ? "Gerando…" : "Gerar conclusão (IA)"}
                    </Button>
                    <Button size="sm" onClick={openNewLog}>Novo registro</Button>
                  </div>
                )}
              </Card.Header>
              <Table striped responsive hover className="mb-0 align-middle">
                <thead><tr><th>Data</th><th>Título</th><th>Conteúdo</th><th></th><th className="text-end">Ações</th></tr></thead>
                <tbody>
                  {dailyLogs.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum registro.</td></tr>}
                  {dailyLogs.map((l) => (
                    <tr key={l.id}>
                      <td>{fmtDate(l.activity_date)}</td>
                      <td>{l.title}</td>
                      <td className="text-truncate" style={{ maxWidth: 380 }}>{stripHtml(l.content)}</td>
                      <td>{l.notes === "conclusaogeral" && <Badge bg="info">conclusão</Badge>}</td>
                      <td className="text-end">
                        {!locked && (
                          <div className="vx-actions justify-content-end">
                            <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEditLog(l)} />
                            <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteLog.isPending} onClick={async () => { if (await confirmDialog("Excluir este registro?")) mDeleteLog.mutate(l.id); }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
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
                          {!locked && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog("Excluir este apontamento?")) mDelete.mutate(t.id); }} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </Tab>

        {/* Técnicos da OS */}
        <Tab eventKey="tecnicos" title="Técnicos">
          <LinkListCard
            title="Técnicos da OS"
            linked={techLinked}
            available={techAvail}
            addLabel="Vincular técnico…"
            onAdd={(id) => mLinkTech.mutate(id)}
            onRemove={(id) => mUnlinkTech.mutate(id)}
            locked={locked}
            busy={mLinkTech.isPending || mUnlinkTech.isPending}
          />
        </Tab>

        {/* Componentes: equipamentos + instrumentos */}
        <Tab eventKey="componentes" title="Componentes">
          <div className="d-flex flex-column gap-4">
            <LinkListCard
              title="Equipamentos da OS"
              linked={eqLinked}
              available={eqAvail}
              addLabel="Vincular equipamento…"
              onAdd={(id) => mAttachEq.mutate(id)}
              onRemove={(id) => mDetachEq.mutate(id)}
              locked={locked}
              busy={mAttachEq.isPending || mDetachEq.isPending}
            />
            <LinkListCard
              title="Instrumentos da OS"
              linked={instrLinked}
              available={instrAvail}
              addLabel="Vincular instrumento…"
              onAdd={(id) => mLinkInstr.mutate(id)}
              onRemove={(id) => mUnlinkInstr.mutate(id)}
              locked={locked}
              busy={mLinkInstr.isPending || mUnlinkInstr.isPending}
            />

            {/* Componentes (tabela) */}
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center gap-2">
                <span>Componentes (tabela) <Badge bg="light" text="dark" className="ms-2">{components.length}</Badge></span>
                <div className="d-flex gap-2">
                  <Button size="sm" variant="outline-secondary" onClick={() => setCmpStyleShow(true)}>
                    🎨 Visual{componentsHasStyle && <Badge bg="success" className="ms-1" style={{ fontSize: 9 }}>custom</Badge>}
                  </Button>
                  {!locked && <Button size="sm" onClick={openNewCmp}>Novo componente</Button>}
                </div>
              </Card.Header>
              <Table striped responsive hover className="mb-0 align-middle">
                <thead>
                  <tr><th>Categoria</th><th>TAG</th><th>Descrição</th><th>P/N</th><th>Qtd</th><th className="text-end">Ações</th></tr>
                </thead>
                <tbody>
                  {components.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhum componente.</td></tr>}
                  {components.map((c) => (
                    <tr key={c.id}>
                      <td>{c.category || "—"}</td>
                      <td>{c.equipment_tag || eqTag(c.equipment_id)}</td>
                      <td>{c.description || "—"}</td>
                      <td>{c.part_number || "—"}</td>
                      <td>{c.quantity ?? "—"}</td>
                      <td className="text-end">
                        {!locked && (
                          <div className="vx-actions justify-content-end">
                            <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEditCmp(c)} />
                            <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteCmp.isPending} onClick={async () => { if (await confirmDialog("Excluir este componente?")) mDeleteCmp.mutate(c.id); }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>
        </Tab>

        {/* Ensaios / Medições */}
        <Tab eventKey="ensaios" title="Ensaios/Medições">
          <MeasurementsPanel orderId={orderId} />
        </Tab>

        {/* Dados UPS: Alber + Medições UPS + Event Logs */}
        <Tab eventKey="dados-ups" title="Dados UPS">
          <UpsDataPanel orderId={orderId} />
        </Tab>

        {/* Anexos da OS */}
        <Tab eventKey="anexos" title="Anexos">
          <AttachmentsPanel orderId={orderId} />
        </Tab>

        {/* Enviar OS por e-mail */}
        <Tab eventKey="enviar" title="Enviar">
          <SendOsEmailPanel orderId={orderId} technicians={linkedTechnicians} />
        </Tab>
      </Tabs>

      <div className="text-muted small">
        Demais blocos do relatório (seções, medições, imagens, assinaturas) chegam nas próximas fatias; por ora use o “Editor completo (legado)”.
      </div>

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

      {/* Modal diário de bordo */}
      <Modal show={logShow} onHide={() => setLogShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{logEditId ? "Editar registro" : "Novo registro"}</Modal.Title></Modal.Header>
        <Form onSubmit={submitLog}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>Data</Form.Label>
                <Form.Control type="date" value={logForm.activityDate} onChange={(e) => setLogForm({ ...logForm, activityDate: e.target.value })} />
              </div>
              <div className="col-md-8">
                <Form.Label>Título</Form.Label>
                <Form.Control value={logForm.title} onChange={(e) => setLogForm({ ...logForm, title: e.target.value })} />
              </div>
              <div className="col-12">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <Form.Label className="mb-0">Conteúdo</Form.Label>
                  <Button size="sm" variant="outline-primary" disabled={revising || !stripHtml(logForm.content)} onClick={reviseLog}>
                    {revising ? "Revisando…" : "Revisar com IA"}
                  </Button>
                </div>
                <RichTextEditor value={logForm.content} onChange={(html) => setLogForm({ ...logForm, content: html })} placeholder="Descreva as atividades do dia…" />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setLogShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={mSaveLog.isPending}>{mSaveLog.isPending ? "Salvando…" : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Modal componente */}
      <Modal show={cmpShow} onHide={() => setCmpShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{cmpEditId ? "Editar componente" : "Novo componente"}</Modal.Title></Modal.Header>
        <Form onSubmit={submitCmp}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>Categoria</Form.Label>
                <Form.Select value={cmpForm.category} onChange={(e) => setCmpForm({ ...cmpForm, category: e.target.value })}>
                  {componentCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Equipamento (TAG)</Form.Label>
                <Form.Select value={cmpForm.equipmentId} onChange={(e) => setCmpForm({ ...cmpForm, equipmentId: e.target.value ? Number(e.target.value) : "" })}>
                  <option value="">Sem equipamento</option>
                  {orderEquipments.map((e) => <option key={e.equipment_id} value={e.equipment_id}>{e.tag_number || "—"}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Quantidade</Form.Label>
                <Form.Control type="number" min={1} step={1} value={cmpForm.quantity} onChange={(e) => setCmpForm({ ...cmpForm, quantity: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Descrição</Form.Label>
                <Form.Control list="cmp-descriptions" required value={cmpForm.description} onChange={(e) => setCmpForm({ ...cmpForm, description: e.target.value })} />
                <datalist id="cmp-descriptions">
                  {spareParts.filter((s) => s.description).map((s) => <option key={`d${s.id}`} value={s.description as string} />)}
                </datalist>
              </div>
              <div className="col-md-6">
                <Form.Label>Part Number</Form.Label>
                <div className="position-relative">
                  <Form.Control
                    value={cmpForm.partNumber}
                    placeholder="Digite para pesquisar na base"
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={pnSuggestionsOpen}
                    aria-controls="cmp-part-number-suggestions"
                    onFocus={() => { setPnSuggestionsOpen(true); setActivePnIndex(-1); }}
                    onBlur={closePnSuggestions}
                    onChange={(e) => {
                      setCmpForm({ ...cmpForm, partNumber: e.target.value });
                      setPnSuggestionsOpen(true);
                      setActivePnIndex(-1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setPnSuggestionsOpen(true);
                        if (pnSuggestions.length) setActivePnIndex((current) => (current + 1) % pnSuggestions.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setPnSuggestionsOpen(true);
                        if (pnSuggestions.length) setActivePnIndex((current) => (current - 1 + pnSuggestions.length) % pnSuggestions.length);
                      } else if (e.key === "Enter" && pnSuggestionsOpen && activePnIndex >= 0) {
                        e.preventDefault();
                        selectPnSuggestion(activePnIndex);
                      } else if (e.key === "Escape") {
                        setPnSuggestionsOpen(false);
                        setActivePnIndex(-1);
                      }
                    }}
                  />
                  {pnSuggestionsOpen && (
                    <div
                      id="cmp-part-number-suggestions"
                      className="list-group position-absolute start-0 end-0 mt-1 shadow overflow-auto"
                      role="listbox"
                      style={{ zIndex: 1080, maxHeight: 260 }}
                    >
                      {pnSuggestions.length === 0 && (
                        <div className="list-group-item small text-muted">Nenhum PN encontrado. O valor digitado será mantido.</div>
                      )}
                      {pnSuggestions.map((spare, index) => (
                        <button
                          key={spare.id}
                          className={`list-group-item list-group-item-action text-start ${index === activePnIndex ? "active" : ""}`}
                          type="button"
                          role="option"
                          aria-selected={index === activePnIndex}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectPnSuggestion(index)}
                          onMouseEnter={() => setActivePnIndex(index)}
                        >
                          <span className="fw-semibold">{spare.part_number}</span>
                          <span className={`d-block small ${index === activePnIndex ? "text-white-50" : "text-muted"}`}>{spare.description || "Sem descrição"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-12">
                <Form.Label>Notas</Form.Label>
                <Form.Control as="textarea" rows={2} value={cmpForm.notes} onChange={(e) => setCmpForm({ ...cmpForm, notes: e.target.value })} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setCmpShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={savingCmp}>{savingCmp ? "Salvando…" : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <ComponentsStyleModal show={cmpStyleShow} orderId={orderId} onHide={() => setCmpStyleShow(false)} onSaved={invalidate} />
    </div>
  );
}
