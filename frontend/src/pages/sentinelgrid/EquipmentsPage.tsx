import { confirmDialog } from "../../components/ConfirmDialog";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import Pager from "../../components/sentinelgrid/Pager";
import IconAction from "../../components/IconAction";
import SgIcon from "../../components/sentinelgrid/SgIcon";
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
import { AddToGroupModal, GroupsModal } from "./EquipmentGroupsModals";
import { listEquipments } from "../../api/equipments";
import RegistrySuggestField, { RegistrySuggestItem } from "../../components/sentinelgrid/RegistrySuggestField";
import RegistrySyncModal, { SyncPickItem } from "../../components/sentinelgrid/RegistrySyncModal";
import { importEquipmentFromReportService, listRsImportableEquipment } from "../../api/sentinelgrid/integration";

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

const PAGE_SIZE = 20;

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
  const [page, setPage] = useState(1);

  const clientsQuery = useQuery({ queryKey: ["sentinelgrid", "clients", ""], queryFn: () => listClients({ pageSize: 200 }) });
  const sitesQuery = useQuery({ queryKey: ["sentinelgrid", "sites", 0, ""], queryFn: () => listSites({ pageSize: 200 }) });
  const areasQuery = useQuery({ queryKey: ["sentinelgrid", "areas", 0, ""], queryFn: () => listAreas({ pageSize: 200 }) });
  const typesQuery = useQuery({ queryKey: ["sentinelgrid", "equipment-types"], queryFn: () => listEquipmentTypes() });
  const mansQuery = useQuery({ queryKey: ["sentinelgrid", "manufacturers"], queryFn: () => listManufacturers() });
  const modelsQuery = useQuery({ queryKey: ["sentinelgrid", "models"], queryFn: () => listModels() });

  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "equipment", clientFilter, criticalityFilter, statusFilter, search, page],
    queryFn: () => listEquipment({ clientId: clientFilter || undefined, criticality: criticalityFilter || undefined, operationalStatus: statusFilter || undefined, search, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });
  // Sugestões de TAG cruzando os dois módulos (cada API lê seu próprio banco — isolamento mantido).
  const sgAllEquip = useQuery({ queryKey: ["sentinelgrid", "equipment", "suggest-all"], queryFn: () => listEquipment({ pageSize: 500 }) });
  const rsEquip = useQuery({ queryKey: ["report-service", "equipments", "suggest"], queryFn: listEquipments });

  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showImportEq, setShowImportEq] = useState(false);
  const [importInfo, setImportInfo] = useState<string | null>(null);

  // Equipamentos do Service Report disponíveis para importar (carrega só com o modal aberto).
  const rsImportableEq = useQuery({
    queryKey: ["sentinelgrid", "integration", "rs-importable-equipment"],
    queryFn: listRsImportableEquipment,
    enabled: showImportEq
  });

  // Seleção para agrupamento.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAddToGroup, setShowAddToGroup] = useState(false);
  const [showGroups, setShowGroups] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "equipment"] });
  const onError = (e: unknown) => setActionError((e as Error).message);
  const mSave = useMutation({
    mutationFn: () => (editingId ? updateEquipment(editingId, toInput(form!)) : createEquipment(toInput(form!))),
    onSuccess: () => { setForm(null); setEditingId(null); setActionError(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteEquipment, onSuccess: invalidate, onError });
  // Exclusão em lote: dispara os DELETEs em paralelo e agrega falhas parciais
  // (ex.: equipamento com OS/planos/manutenções vinculados que o backend recusa).
  const mBulkDelete = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteEquipment(id)));
      const failedIds = ids.filter((_, i) => results[i].status === "rejected");
      return { failedIds, total: ids.length };
    },
    onSuccess: ({ failedIds, total }) => {
      setSelected(new Set(failedIds)); // mantém selecionados só os que falharam
      setActionError(
        failedIds.length
          ? `${failedIds.length} de ${total} equipamento(s) não puderam ser excluídos (verifique OS/planos/manutenções vinculados).`
          : null
      );
      invalidate();
    },
    onError
  });
  // Importa UM equipamento do RS (traz cliente + site). Acionado pela caixa de sugestão
  // da TAG ao escolher um item do outro módulo.
  const mImportEq = useMutation({
    mutationFn: (rsEquipmentId: number) => importEquipmentFromReportService(rsEquipmentId),
    onSuccess: ({ result }) => {
      setForm(null); setEditingId(null);
      setImportInfo(`Equipamento "${result.equipmentTag}" ${result.equipmentReused ? "atualizado" : "importado"} do Service Report (cliente "${result.clientName}").`);
      invalidate();
    },
    onError
  });
  const onTagImportPick = async (it: RegistrySuggestItem) => {
    if (await confirmDialog(`Importar o equipamento "${it.name}" do Service Report? Isso trará também o cliente e o site dele.`)) {
      mImportEq.mutate(it.id);
    }
  };

  const clients = clientsQuery.data?.clients ?? [];
  const sites = sitesQuery.data?.sites ?? [];
  const areas = areasQuery.data?.areas ?? [];
  const types = typesQuery.data ?? [];
  const manufacturers = mansQuery.data ?? [];
  const models = modelsQuery.data?.models ?? [];

  // TAGs sugeridas filtradas pelo cliente selecionado no formulário (SG por client_id;
  // RS por nome do cliente = customer_name, seguindo o critério de igualdade por nome).
  const selClientId = form?.clientId || 0;
  const selClientName = selClientId ? (clients.find((c) => Number(c.id) === selClientId)?.name || "") : "";
  const selClientKey = selClientName.trim().toLowerCase();
  // Caixa de sugestão da TAG rotulada por módulo (só itens com TAG). Item do SG completa
  // o cadastro (applyTagMatch); item do RS dispara a importação (onTagImportPick).
  const tagSuggestItems: RegistrySuggestItem[] = [
    ...(sgAllEquip.data?.equipment ?? []).filter((e) => (e.tag || "").trim()).map((e) => ({ id: e.id, name: e.tag, module: "sg" as const })),
    ...(rsEquip.data?.equipments ?? []).filter((e) => (e.tag_number || "").trim()).map((e) => ({ id: e.id, name: e.tag_number as string, module: "rs" as const }))
  ];
  const importEqItems: SyncPickItem[] = (rsImportableEq.data?.equipment ?? []).map((e) => ({
    id: e.id,
    name: e.tag || `#${e.id}`,
    subtitle: [e.customer_name, e.site_name].filter(Boolean).join(" · "),
    linked: e.sg_linked
  }));

  const sitesForClient = useMemo(() => (form ? sites.filter((s) => Number(s.client_id) === form.clientId) : []), [sites, form]);
  const areasForSite = useMemo(() => (form ? areas.filter((a) => Number(a.site_id) === form.siteId) : []), [areas, form]);
  const modelsForMan = useMemo(() => (form && form.manufacturerId ? models.filter((m) => Number(m.manufacturer_id) === form.manufacturerId) : models), [models, form]);

  const openNew = () => { setEditingId(null); setForm({ ...EMPTY }); setActionError(null); };
  const openEdit = (e: SgEquipment) => { setEditingId(e.id); setForm(toForm(e)); setActionError(null); };
  const patch = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));

  // Ao escolher uma TAG existente, busca o equipamento (do cliente) e completa o cadastro.
  const nameEq = (a?: string | null, b?: string | null) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  const applyTagMatch = (tagValue: string) => {
    const key = tagValue.trim().toLowerCase();
    if (!key) return;
    // Preferência: equipamento do SentinelGrid (mesmo cliente) — tem todos os campos.
    const sgMatch = (sgAllEquip.data?.equipment ?? []).find((e) => (!selClientId || Number(e.client_id) === selClientId) && nameEq(e.tag, tagValue));
    if (sgMatch) {
      patch({
        serialNumber: sgMatch.serial_number || "", ratedPower: sgMatch.rated_power || "",
        inputVoltage: sgMatch.input_voltage || "", outputVoltage: sgMatch.output_voltage || "",
        dcVoltage: sgMatch.dc_voltage || "", frequency: sgMatch.frequency || "",
        redundancyConfig: sgMatch.redundancy_config || "", moduleCount: sgMatch.module_count ?? null,
        batteryType: sgMatch.battery_type || "",
        equipmentTypeId: sgMatch.equipment_type_id ? Number(sgMatch.equipment_type_id) : null,
        manufacturerId: sgMatch.manufacturer_id ? Number(sgMatch.manufacturer_id) : null,
        modelId: sgMatch.model_id ? Number(sgMatch.model_id) : null,
        criticality: sgMatch.criticality || "media", operationalStatus: sgMatch.operational_status || "operacional_normal",
        internalTechnician: sgMatch.internal_technician || "", notes: sgMatch.notes || ""
      });
      return;
    }
    // Senão: equipamento do Service Report (mesmo cliente por nome) — mapeia os campos disponíveis.
    const rsMatch = (rsEquip.data?.equipments ?? []).find((e) => (!selClientKey || nameEq(e.customer_name, selClientName)) && nameEq(e.tag_number, tagValue));
    if (rsMatch) {
      patch({
        serialNumber: rsMatch.serial_number || "",
        ratedPower: rsMatch.power || "",                       // Power → Potência
        inputVoltage: rsMatch.rated_ac_input_voltage || "",    // Ac Input → Tensão entrada
        outputVoltage: rsMatch.rated_ac_output_voltage || "",  // Ac Output V → Tensão saída
        dcVoltage: rsMatch.rated_dc_voltage || "",             // DC V → Tensão DC
        frequency: rsMatch.output_frequency || "",             // Output Freq → Frequência
        notes: rsMatch.notes || "",
        equipmentTypeId: types.find((t) => nameEq(t.name, rsMatch.type))?.id ?? null,
        manufacturerId: manufacturers.find((m) => nameEq(m.name, rsMatch.manufacturer))?.id ?? null,
        modelId: models.find((m) => nameEq(m.name, rsMatch.model_family))?.id ?? null
      });
    }
  };

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar equipamentos: {(error as Error).message}</Alert>;
  }

  const equipment = data?.equipment ?? [];

  const selectedEquip = equipment.filter((e) => selected.has(e.id));
  const selectedSites = new Set(selectedEquip.map((e) => Number(e.site_id)));
  const sameSite = selectedSites.size === 1;
  const selSiteId = sameSite ? Array.from(selectedSites)[0] : 0;
  const selSiteName = selectedEquip[0]?.site_name || "";
  const toggleSel = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = equipment.length > 0 && equipment.every((e) => selected.has(e.id));
  const toggleAll = () => setSelected((s) => { const n = new Set(s); if (allOnPage) equipment.forEach((e) => n.delete(e.id)); else equipment.forEach((e) => n.add(e.id)); return n; });
  const askBulkDelete = async () => {
    if (selected.size === 0) return;
    if (await confirmDialog(`Excluir ${selected.size} equipamento(s) selecionado(s)? Esta ação não pode ser desfeita.`)) {
      mBulkDelete.mutate([...selected]);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Equipamentos</h2>
        <div className="d-flex align-items-center gap-2">
          <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
          <Button size="sm" variant="outline-primary" onClick={() => setShowImportEq(true)}>Buscar do Service Report</Button>
          <Button size="sm" variant="outline-secondary" onClick={() => setShowGroups(true)} className="d-inline-flex align-items-center gap-1"><SgIcon name="groups" size={16} className="sg-icon--mono" />Grupos</Button>
          <Button size="sm" onClick={openNew} className="d-inline-flex align-items-center gap-1"><SgIcon name="new-doc" size={16} className="sg-icon--mono" />Novo equipamento</Button>
        </div>
      </div>

      {importInfo && <Alert variant="success" dismissible onClose={() => setImportInfo(null)}>{importInfo}</Alert>}
      {actionError && !form && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>Equipamentos ({data?.total ?? equipment.length})</span>
          <div className="d-flex flex-wrap gap-2">
            <Form.Select size="sm" style={{ maxWidth: 180 }} value={clientFilter || ""} onChange={(e) => { setClientFilter(Number(e.target.value) || 0); setPage(1); }}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
            <Form.Select size="sm" style={{ maxWidth: 160 }} value={criticalityFilter} onChange={(e) => { setCriticalityFilter(e.target.value); setPage(1); }}>
              <option value="">Criticidade</option>
              {CRITICALITY.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Form.Select>
            <Form.Select size="sm" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">Status</option>
              {OPERATIONAL_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Form.Select>
            <Form.Control size="sm" style={{ maxWidth: 200 }} placeholder="Buscar TAG / série…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </Card.Header>
        {selected.size > 0 && (
          <Card.Body className="py-2 border-top d-flex align-items-center gap-2 flex-wrap">
            <span className="small fw-medium">{selected.size} selecionado(s)</span>
            <Button size="sm" onClick={() => setShowAddToGroup(true)} disabled={!sameSite} className="d-inline-flex align-items-center gap-1"><SgIcon name="add-circle" size={16} className="sg-icon--mono" />Adicionar ao grupo</Button>
            {!sameSite && <span className="small text-warning">Selecione equipamentos do mesmo site.</span>}
            <Button size="sm" variant="outline-danger" disabled={mBulkDelete.isPending} onClick={askBulkDelete}>
              {mBulkDelete.isPending ? "Excluindo…" : "Excluir selecionados"}
            </Button>
            <Button size="sm" variant="link" className="p-0" onClick={() => setSelected(new Set())}>Limpar seleção</Button>
          </Card.Body>
        )}
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr>
              <th style={{ width: 32 }}><Form.Check checked={allOnPage} onChange={toggleAll} title="Selecionar todos" /></th>
              <th>TAG</th><th>Tipo</th><th>Modelo</th><th>Cliente / Site / Área</th><th>Criticidade</th><th>Status</th><th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {equipment.length === 0 && <tr><td colSpan={8} className="text-muted">Nenhum equipamento.</td></tr>}
            {equipment.map((e) => {
              const cm = criticalityMeta(e.criticality);
              const sm = statusMeta(e.operational_status);
              return (
                <tr key={e.id} className={selected.has(e.id) ? "table-active" : undefined}>
                  <td><Form.Check checked={selected.has(e.id)} onChange={() => toggleSel(e.id)} /></td>
                  <td>{e.tag || <span className="text-muted">—</span>}</td>
                  <td>{e.equipment_type_name || <span className="text-muted">—</span>}</td>
                  <td>{e.model_name || <span className="text-muted">—</span>}</td>
                  <td className="small">{e.client_name} / {e.site_name} / {e.area_name}</td>
                  <td><Badge bg={cm.variant}>{cm.label}</Badge></td>
                  <td><Badge bg={sm.variant}>{sm.label}</Badge></td>
                  <td className="text-end">
                    <div className="vx-actions justify-content-end">
                      <IconAction icon="pencil" label="Editar" variant="outline-secondary" onClick={() => openEdit(e)} />
                      <IconAction icon="trash" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o equipamento "${e.tag || e.id}"?`)) mDelete.mutate(e.id); }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Pager page={data?.page ?? page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
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
                  <RegistrySuggestField
                    currentModule="sg"
                    value={form.tag}
                    onChange={(v) => { patch({ tag: v }); applyTagMatch(v); }}
                    items={tagSuggestItems}
                    onImportPick={onTagImportPick}
                  />
                  <Form.Text className="text-muted">Escolha uma TAG do próprio módulo para completar os dados; do outro módulo, importa o equipamento.</Form.Text>
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

      {showAddToGroup && sameSite && selSiteId > 0 && (
        <AddToGroupModal
          equipmentIds={Array.from(selected)}
          siteId={selSiteId}
          siteName={selSiteName}
          onHide={() => setShowAddToGroup(false)}
          onDone={() => { setShowAddToGroup(false); setSelected(new Set()); }}
        />
      )}
      {showGroups && <GroupsModal clients={clients} onHide={() => setShowGroups(false)} />}

      <RegistrySyncModal
        show={showImportEq}
        onHide={() => setShowImportEq(false)}
        showHierarchyOptions={false}
        multiSelect
        title="Buscar equipamento do Service Report"
        description="Importa o equipamento selecionado do Service Report para o SentinelGrid, trazendo junto o cliente e o site dele. Reimportar atualiza o registro vinculado, sem duplicar."
        items={importEqItems}
        loading={rsImportableEq.isLoading}
        loadError={rsImportableEq.error ? (rsImportableEq.error as Error).message : null}
        confirmLabel="Importar"
        onConfirm={async (id) => (await importEquipmentFromReportService(id)).result}
        onConfirmMany={async (ids) => {
          let imported = 0;
          let updated = 0;
          for (const id of ids) {
            const { result } = await importEquipmentFromReportService(id);
            if (result.equipmentReused) updated += 1;
            else imported += 1;
          }
          return `${ids.length} equipamento(s) processado(s): ${imported} importado(s) e ${updated} atualizado(s).`;
        }}
        successMessage={(r) => `Equipamento "${r.equipmentTag}" ${r.equipmentReused ? "atualizado" : "importado"} (cliente "${r.clientName}").`}
        onDone={() => {
          invalidate();
          qc.invalidateQueries({ queryKey: ["sentinelgrid", "integration", "rs-importable-equipment"] });
        }}
      />
    </div>
  );
}
