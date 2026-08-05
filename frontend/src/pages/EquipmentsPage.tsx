import { confirmDialog } from "../components/ConfirmDialog";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../components/IconAction";
import { downloadFile } from "../api/client";
import {
  Equipment,
  EquipmentAttachment,
  EquipmentInput,
  createEquipment,
  deleteEquipment,
  deleteEquipmentAttachment,
  listEquipmentAttachments,
  listEquipments,
  updateEquipment,
  uploadEquipmentAttachment
} from "../api/equipments";
import type { Site } from "../api/customers";
import { listEquipment } from "../api/sentinelgrid/equipment";
import RegistrySuggestField, { RegistrySuggestItem } from "../components/sentinelgrid/RegistrySuggestField";
import RegistrySyncModal, { SyncPickItem } from "../components/sentinelgrid/RegistrySyncModal";
import { exportEquipmentToReportService, listSgExportableEquipment } from "../api/sentinelgrid/integration";
import { EquipmentSpare, getEquipmentSpares } from "../api/spareParts";
import PrintSheet, { PrintColumn } from "../components/PrintSheet";
import { CAP, useCan } from "../api/session";

// Colunas da lista de peças impressa a partir da tela de equipamentos.
const SPARES_PRINT_COLUMNS: PrintColumn[] = [
  { key: "idx", label: "#", width: "8mm", align: "end" },
  { key: "description", label: "Descrição" },
  { key: "partNumber", label: "Part Number", width: "32mm" },
  { key: "manufacturer", label: "Fabricante", width: "28mm" },
  { key: "family", label: "Família", width: "24mm" },
  { key: "leadTime", label: "Lead time", width: "20mm" },
  { key: "quantity", label: "Qtd.", width: "14mm", align: "end" },
  { key: "status", label: "Status", width: "18mm" }
];

const EMPTY: EquipmentInput = {
  customerId: "",
  siteId: "",
  type: "",
  manufacturer: "",
  modelFamily: "",
  area: "",
  serialNumber: "",
  tagNumber: "",
  power: "",
  ratedAcInputVoltage: "",
  inputFrequency: "",
  ratedDcVoltage: "",
  ratedAcOutputVoltage: "",
  outputFrequency: "",
  degreeOfProtection: "",
  mainLabel: "",
  dtNumber: "",
  yearOfManufacture: "",
  notes: ""
};

function toInput(e: Equipment): EquipmentInput {
  return {
    // customer_id/site_id podem vir como string (bigint do Postgres) — coerção numérica
    // garante que o Cliente/Site sejam pré-selecionados ao editar.
    customerId: e.customer_id == null ? "" : Number(e.customer_id),
    siteId: e.site_id == null ? "" : Number(e.site_id),
    type: e.type ?? "",
    manufacturer: e.manufacturer ?? "",
    modelFamily: e.model_family ?? "",
    area: e.area ?? "",
    serialNumber: e.serial_number ?? "",
    tagNumber: e.tag_number ?? "",
    power: e.power ?? "",
    ratedAcInputVoltage: e.rated_ac_input_voltage ?? "",
    inputFrequency: e.input_frequency ?? "",
    ratedDcVoltage: e.rated_dc_voltage ?? "",
    ratedAcOutputVoltage: e.rated_ac_output_voltage ?? "",
    outputFrequency: e.output_frequency ?? "",
    degreeOfProtection: e.degree_of_protection ?? "",
    mainLabel: e.main_label ?? "",
    dtNumber: e.dt_number ?? "",
    yearOfManufacture: e.year_of_manufacture ?? "",
    notes: e.notes ?? ""
  };
}

export default function EquipmentsPage() {
  const qc = useQueryClient();
  const can = useCan();
  const { data, isLoading, error } = useQuery({ queryKey: ["equipments"], queryFn: listEquipments });
  // Sugestões de TAG cruzando os módulos (cada API lê seu banco — isolamento mantido).
  const sgEquip = useQuery({ queryKey: ["sentinelgrid", "equipment", "suggest"], queryFn: () => listEquipment({ pageSize: 500 }) });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EquipmentInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showImportEq, setShowImportEq] = useState(false);
  const [printSpares, setPrintSpares] = useState<{ equipment: Equipment; spares: EquipmentSpare[] } | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  // Filtros do cadastro (client-side — o payload já traz todos os equipamentos, clientes e sites).
  const [fCustomer, setFCustomer] = useState<number | "">("");
  const [fSite, setFSite] = useState<number | "">("");
  const [fType, setFType] = useState("");
  const [fFamily, setFFamily] = useState("");
  // Anexos do equipamento (só no modo edição — precisa de um id já salvo).
  const [attLabel, setAttLabel] = useState("");
  const [attFile, setAttFile] = useState<File | null>(null);
  const [attError, setAttError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Equipamentos do SentinelGrid disponíveis para trazer ao Service Report (via façade do SG).
  const sgExportableEq = useQuery({
    queryKey: ["sentinelgrid", "integration", "sg-exportable-equipment"],
    queryFn: listSgExportableEquipment,
    enabled: showImportEq
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["equipments"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({ mutationFn: createEquipment, onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mUpdate = useMutation({
    mutationFn: (p: { id: number; input: EquipmentInput }) => updateEquipment(p.id, p.input),
    onSuccess: () => { setShow(false); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteEquipment, onSuccess: invalidate, onError });

  // Atalho de impressão: busca as peças do equipamento sob demanda e monta a folha.
  const mPrintSpares = useMutation({
    mutationFn: async (equipment: Equipment) => ({ equipment, data: await getEquipmentSpares(equipment.id) }),
    onSuccess: ({ equipment, data }) => {
      if (!data.linkedSpares.length) {
        setActionError(`O equipamento "${equipment.type}" não possui peças vinculadas.`);
        return;
      }
      setPrintSpares({ equipment, spares: data.linkedSpares });
    },
    onError
  });

  // Anexos: lista sob demanda ao abrir a edição; upload/remoção invalidam a lista.
  const attachmentsQ = useQuery({
    queryKey: ["equipment-attachments", editId],
    queryFn: () => listEquipmentAttachments(editId as number),
    enabled: show && editId != null
  });
  const resetAttInput = () => { setAttFile(null); setAttLabel(""); if (fileRef.current) fileRef.current.value = ""; };
  const mUploadAtt = useMutation({
    mutationFn: (p: { id: number; file: File; label: string }) => uploadEquipmentAttachment(p.id, p.file, p.label),
    onSuccess: () => { setAttError(null); resetAttInput(); qc.invalidateQueries({ queryKey: ["equipment-attachments", editId] }); },
    onError: (e: unknown) => setAttError((e as Error).message)
  });
  const mDeleteAtt = useMutation({
    mutationFn: (p: { id: number; attId: number }) => deleteEquipmentAttachment(p.id, p.attId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["equipment-attachments", editId] }),
    onError: (e: unknown) => setAttError((e as Error).message)
  });
  const doUploadAtt = () => {
    if (!editId || !attFile) return;
    if (attFile.size > 50 * 1024 * 1024) { setAttError("Arquivo muito grande. Limite: 50 MB."); return; }
    setAttError(null);
    mUploadAtt.mutate({ id: editId, file: attFile, label: attLabel });
  };
  const downloadAtt = (att: EquipmentAttachment) => {
    if (!editId) return;
    downloadFile(`/equipments/${editId}/attachments/${att.id}/download`, att.original_name || "arquivo").catch((e) => setAttError((e as Error).message));
  };
  const fmtSize = (bytes: number | string | null) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };
  // Traz UM equipamento do SentinelGrid (com cliente + site). Acionado pela caixa de
  // sugestão da TAG ao escolher um item do outro módulo.
  const mExportEq = useMutation({
    mutationFn: (sgEquipmentId: number) => exportEquipmentToReportService(sgEquipmentId),
    onSuccess: ({ result }) => {
      setShow(false);
      setImportInfo(`Equipamento "${result.equipmentTag}" enviado do SentinelGrid (cliente "${result.rsCustomerName}").`);
      invalidate();
    },
    onError
  });
  const onTagImportPick = async (it: RegistrySuggestItem) => {
    if (await confirmDialog(`Importar o equipamento "${it.name}" do SentinelGrid? Isso trará também o cliente e o site dele.`)) {
      mExportEq.mutate(it.id);
    }
  };

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar equipamentos: {(error as Error).message}</Alert>;
  }

  const { equipments = [], customers = [], sites = [] } = data ?? {};
  // Caixa de sugestão da TAG rotulada por módulo (só itens com TAG). Item do RS só preenche
  // a TAG; item do SG dispara a importação (traz o equipamento + cliente + site).
  const tagSuggestItems: RegistrySuggestItem[] = [
    ...equipments.filter((e: Equipment) => (e.tag_number || "").trim()).map((e: Equipment) => ({ id: e.id, name: e.tag_number as string, module: "rs" as const })),
    ...(sgEquip.data?.equipment ?? []).filter((e) => (e.tag || "").trim()).map((e) => ({ id: e.id, name: e.tag, module: "sg" as const }))
  ];
  const importEqItems: SyncPickItem[] = (sgExportableEq.data?.equipment ?? []).map((e) => ({
    id: e.id,
    name: e.tag || `#${e.id}`,
    subtitle: [e.client_name, e.site_name].filter(Boolean).join(" · "),
    linked: e.rs_linked
  }));
  const sitesForCustomer = (customerId: number | "") =>
    // customer_id pode vir como string (bigint do Postgres) — coerção numérica nos dois lados.
    sites.filter((s: Site) => !customerId || Number(s.customer_id) === Number(customerId));

  // Opções de Tipo e Família derivadas dos próprios equipamentos (campos livres no cadastro).
  const norm = (v: string | null) => (v || "").trim();
  const distinctTypes = Array.from(new Set(equipments.map((e: Equipment) => norm(e.type)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const distinctFamilies = Array.from(new Set(equipments.map((e: Equipment) => norm(e.model_family)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const hasFilter = fCustomer !== "" || fSite !== "" || !!fType || !!fFamily;
  const clearFilters = () => { setFCustomer(""); setFSite(""); setFType(""); setFFamily(""); };
  const filteredEquipments = equipments.filter((e: Equipment) => {
    if (fCustomer !== "" && Number(e.customer_id) !== fCustomer) return false;
    if (fSite !== "" && Number(e.site_id) !== fSite) return false;
    if (fType && norm(e.type) !== fType) return false;
    if (fFamily && norm(e.model_family) !== fFamily) return false;
    return true;
  });

  const openNew = () => { setEditId(null); setForm(EMPTY); setActionError(null); setAttError(null); resetAttInput(); setShow(true); };
  const openEdit = (e: Equipment) => { setEditId(e.id); setForm(toInput(e)); setActionError(null); setAttError(null); resetAttInput(); setShow(true); };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editId) mUpdate.mutate({ id: editId, input: form });
    else mCreate.mutate(form);
  };

  const saving = mCreate.isPending || mUpdate.isPending;

  return (
    <>
      <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>
          Equipamentos
          <Badge bg="light" text="dark" className="ms-2">{hasFilter ? `${filteredEquipments.length}/${equipments.length}` : equipments.length}</Badge>
        </span>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => setShowImportEq(true)}>Buscar do SentinelGrid</Button>
          <Button size="sm" onClick={openNew}>Novo equipamento</Button>
        </div>
      </Card.Header>
      <div className="px-3 py-2 border-bottom" style={{ background: "var(--surface-2)" }}>
        <div className="row g-2 align-items-end">
          <div className="col-6 col-md-3">
            <Form.Label className="small mb-1">Cliente</Form.Label>
            <Form.Select
              size="sm"
              value={fCustomer === "" ? "" : fCustomer}
              onChange={(e) => { setFCustomer(e.target.value ? Number(e.target.value) : ""); setFSite(""); }}
            >
              <option value="">Todos</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-6 col-md-3">
            <Form.Label className="small mb-1">Site</Form.Label>
            <Form.Select
              size="sm"
              value={fSite === "" ? "" : fSite}
              onChange={(e) => setFSite(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Todos</option>
              {sitesForCustomer(fCustomer).map((s) => <option key={s.id} value={s.id}>{s.site_name}</option>)}
            </Form.Select>
          </div>
          <div className="col-6 col-md-2">
            <Form.Label className="small mb-1">Tipo</Form.Label>
            <Form.Select size="sm" value={fType} onChange={(e) => setFType(e.target.value)}>
              <option value="">Todos</option>
              {distinctTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Form.Select>
          </div>
          <div className="col-6 col-md-2">
            <Form.Label className="small mb-1">Família</Form.Label>
            <Form.Select size="sm" value={fFamily} onChange={(e) => setFFamily(e.target.value)}>
              <option value="">Todas</option>
              {distinctFamilies.map((f) => <option key={f} value={f}>{f}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-2 d-grid">
            <Button size="sm" variant="outline-secondary" disabled={!hasFilter} onClick={clearFilters}>Limpar filtros</Button>
          </div>
        </div>
      </div>
      {importInfo && <Alert variant="success" className="m-3" dismissible onClose={() => setImportInfo(null)}>{importInfo}</Alert>}
      {actionError && !show && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table striped responsive hover className="mb-0 align-middle">
        <thead>
          <tr><th>Tipo</th><th>Fabricante</th><th>Família</th><th>Nº de série</th><th>TAG</th><th>Cliente</th><th>Área</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {filteredEquipments.length === 0 && <tr><td colSpan={8} className="text-muted">{hasFilter ? "Nenhum equipamento corresponde aos filtros." : "Nenhum equipamento."}</td></tr>}
          {filteredEquipments.map((e: Equipment) => (
            <tr key={e.id}>
              <td>{e.type}</td>
              <td>{e.manufacturer}</td>
              <td>{e.model_family}</td>
              <td>{e.serial_number}</td>
              <td>{e.tag_number}</td>
              <td>{e.customer_name || "—"}</td>
              <td>{e.area || "—"}</td>
              <td className="text-end">
                <div className="vx-actions justify-content-end">
                  {can(CAP.RECORDS_WRITE) && <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(e)} />}
                  <IconAction icon="print" label="Imprimir lista de peças" variant="outline-secondary" disabled={mPrintSpares.isPending} onClick={() => mPrintSpares.mutate(e)} />
                  {can(CAP.RECORDS_DELETE) && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o equipamento "${e.type}"?`)) mDelete.mutate(e.id); }} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editId ? "Editar equipamento" : "Novo equipamento"}</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>Cliente</Form.Label>
                <Form.Select
                  required
                  value={form.customerId === "" ? "" : form.customerId}
                  onChange={(e) => {
                    const customerId = e.target.value ? Number(e.target.value) : "";
                    const customer = customers.find((item) => Number(item.id) === Number(customerId));
                    setForm({ ...form, customerId, siteId: "", area: customer?.area || "" });
                  }}
                >
                  <option value="">Selecione…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Site</Form.Label>
                <Form.Select
                  required
                  value={form.siteId === "" ? "" : form.siteId}
                  onChange={(e) => setForm({ ...form, siteId: e.target.value ? Number(e.target.value) : "" })}
                >
                  <option value="">Selecione…</option>
                  {sitesForCustomer(form.customerId).map((s) => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-4">
                <Form.Label>Área</Form.Label>
                <Form.Control
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                  placeholder="Área do equipamento"
                />
              </div>
              <div className="col-md-6">
                <Form.Label>Tipo</Form.Label>
                <Form.Control value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Fabricante</Form.Label>
                <Form.Control value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Família / modelo</Form.Label>
                <Form.Control value={form.modelFamily} onChange={(e) => setForm({ ...form, modelFamily: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Nº de série</Form.Label>
                <Form.Control value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>TAG</Form.Label>
                <RegistrySuggestField
                  currentModule="rs"
                  value={form.tagNumber}
                  onChange={(v) => setForm({ ...form, tagNumber: v })}
                  items={tagSuggestItems}
                  onImportPick={onTagImportPick}
                />
                <Form.Text className="text-muted">Escolha uma TAG do próprio módulo para preencher; do SentinelGrid, importa o equipamento.</Form.Text>
              </div>
              <div className="col-md-4">
                <Form.Label>Potência</Form.Label>
                <Form.Control value={form.power} onChange={(e) => setForm({ ...form, power: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Ano de fabricação</Form.Label>
                <Form.Control value={form.yearOfManufacture} onChange={(e) => setForm({ ...form, yearOfManufacture: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Nº DT</Form.Label>
                <Form.Control value={form.dtNumber} onChange={(e) => setForm({ ...form, dtNumber: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Etiqueta principal</Form.Label>
                <Form.Control value={form.mainLabel} onChange={(e) => setForm({ ...form, mainLabel: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Grau de proteção (IP)</Form.Label>
                <Form.Control value={form.degreeOfProtection} onChange={(e) => setForm({ ...form, degreeOfProtection: e.target.value })} />
              </div>
              <div className="col-12">
                <hr className="my-1" />
                <span className="text-muted small text-uppercase fw-semibold">Dados elétricos</span>
              </div>
              <div className="col-md-4">
                <Form.Label>Tensão CA de entrada</Form.Label>
                <Form.Control value={form.ratedAcInputVoltage} onChange={(e) => setForm({ ...form, ratedAcInputVoltage: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Frequência de entrada</Form.Label>
                <Form.Control value={form.inputFrequency} onChange={(e) => setForm({ ...form, inputFrequency: e.target.value })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Tensão CC</Form.Label>
                <Form.Control value={form.ratedDcVoltage} onChange={(e) => setForm({ ...form, ratedDcVoltage: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Tensão CA de saída</Form.Label>
                <Form.Control value={form.ratedAcOutputVoltage} onChange={(e) => setForm({ ...form, ratedAcOutputVoltage: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Frequência de saída</Form.Label>
                <Form.Control value={form.outputFrequency} onChange={(e) => setForm({ ...form, outputFrequency: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Observações</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="col-12">
                <hr className="my-1" />
                <span className="text-muted small text-uppercase fw-semibold">Anexos (manuais, parâmetros, etc.)</span>
                {!editId && (
                  <div className="text-muted small mt-1">Salve o equipamento primeiro para anexar arquivos.</div>
                )}
                {editId && (
                  <>
                    {attError && <Alert variant="danger" className="mt-2 mb-2" dismissible onClose={() => setAttError(null)}>{attError}</Alert>}
                    <div className="row g-2 align-items-end mt-1">
                      <div className="col-md-5">
                        <Form.Label className="small mb-1">Descrição (opcional)</Form.Label>
                        <Form.Control size="sm" value={attLabel} placeholder="Ex.: Manual de operação" onChange={(e) => setAttLabel(e.target.value)} />
                      </div>
                      <div className="col-md-5">
                        <Form.Label className="small mb-1">Arquivo (até 50 MB)</Form.Label>
                        <Form.Control size="sm" type="file" ref={fileRef} onChange={(e) => setAttFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
                      </div>
                      <div className="col-md-2 d-grid">
                        <Button size="sm" type="button" disabled={!attFile || mUploadAtt.isPending} onClick={doUploadAtt}>
                          {mUploadAtt.isPending ? "Enviando…" : "Anexar"}
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      {attachmentsQ.isLoading && <div className="text-muted small"><Spinner animation="border" size="sm" /> Carregando anexos…</div>}
                      {!attachmentsQ.isLoading && (attachmentsQ.data?.data?.length ?? 0) === 0 && (
                        <div className="text-muted small">Nenhum anexo.</div>
                      )}
                      {(attachmentsQ.data?.data?.length ?? 0) > 0 && (
                        <Table size="sm" hover className="mb-0 align-middle">
                          <thead>
                            <tr><th>Arquivo</th><th>Descrição</th><th>Tamanho</th><th className="text-end">Ações</th></tr>
                          </thead>
                          <tbody>
                            {(attachmentsQ.data?.data ?? []).map((att: EquipmentAttachment) => (
                              <tr key={att.id}>
                                <td className="text-break">{att.original_name}</td>
                                <td className="text-muted">{att.label || "—"}</td>
                                <td className="text-nowrap">{fmtSize(att.file_size)}</td>
                                <td className="text-end">
                                  <div className="vx-actions justify-content-end">
                                    <IconAction icon="download" label="Baixar" variant="outline-secondary" onClick={() => downloadAtt(att)} />
                                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteAtt.isPending} onClick={async () => { if (await confirmDialog(`Excluir o anexo "${att.original_name}"?`)) mDeleteAtt.mutate({ id: editId, attId: att.id }); }} />
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      )}
                    </div>
                  </>
                )}
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

      <RegistrySyncModal
        show={showImportEq}
        onHide={() => setShowImportEq(false)}
        showHierarchyOptions={false}
        multiSelect
        title="Buscar equipamento do SentinelGrid"
        description="Traz o equipamento selecionado do SentinelGrid para o Service Report, incluindo o cliente e o site dele. Reimportar atualiza o registro vinculado, sem duplicar."
        items={importEqItems}
        loading={sgExportableEq.isLoading}
        loadError={sgExportableEq.error ? (sgExportableEq.error as Error).message : null}
        confirmLabel="Importar"
        onConfirm={async (id) => (await exportEquipmentToReportService(id)).result}
        onConfirmMany={async (ids) => {
          let imported = 0;
          let updated = 0;
          for (const id of ids) {
            const wasLinked = importEqItems.find((it) => it.id === id)?.linked;
            await exportEquipmentToReportService(id);
            if (wasLinked) updated += 1;
            else imported += 1;
          }
          return `${ids.length} equipamento(s) processado(s): ${imported} importado(s) e ${updated} atualizado(s).`;
        }}
        successMessage={(r) => `Equipamento "${r.equipmentTag}" enviado ao Service Report (cliente "${r.rsCustomerName}").`}
        onDone={() => {
          invalidate();
          qc.invalidateQueries({ queryKey: ["sentinelgrid", "integration", "sg-exportable-equipment"] });
        }}
      />

      {printSpares && (
        <PrintSheet
          title="Lista de peças por equipamento"
          subtitle={[printSpares.equipment.type, printSpares.equipment.serial_number && `S/N ${printSpares.equipment.serial_number}`]
            .filter(Boolean).join(" · ") || "Equipamento"}
          meta={[
            { label: "Cliente", value: printSpares.equipment.customer_name || "—" },
            { label: "Site", value: printSpares.equipment.site_name || "—" },
            { label: "Tag", value: printSpares.equipment.tag_number || "—" },
            {
              label: "Itens / Quantidade",
              value: `${printSpares.spares.length} / ${printSpares.spares.reduce((n, s) => n + (Number(s.quantity) || 0), 0)}`
            }
          ]}
          columns={SPARES_PRINT_COLUMNS}
          rows={printSpares.spares.map((s, i) => ({
            idx: String(i + 1),
            description: s.description ?? "",
            partNumber: s.part_number ?? "",
            manufacturer: s.manufacturer ?? "",
            family: s.equipment_family ?? "",
            leadTime: s.lead_time ?? "",
            quantity: String(s.quantity ?? 1),
            status: s.is_obsolete ? "Obsoleta" : "Ativa"
          }))}
          onClose={() => setPrintSpares(null)}
        />
      )}
    </>
  );
}
