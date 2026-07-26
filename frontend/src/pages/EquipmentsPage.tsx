import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../components/IconAction";
import {
  Equipment,
  EquipmentInput,
  createEquipment,
  deleteEquipment,
  listEquipments,
  updateEquipment
} from "../api/equipments";
import type { Site } from "../api/customers";
import { listEquipment } from "../api/sentinelgrid/equipment";
import RegistrySuggestField, { RegistrySuggestItem } from "../components/sentinelgrid/RegistrySuggestField";
import RegistrySyncModal, { SyncPickItem } from "../components/sentinelgrid/RegistrySyncModal";
import { exportEquipmentToReportService, listSgExportableEquipment } from "../api/sentinelgrid/integration";

const EMPTY: EquipmentInput = {
  customerId: "",
  siteId: "",
  type: "",
  manufacturer: "",
  modelFamily: "",
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
    customerId: e.customer_id ?? "",
    siteId: e.site_id ?? "",
    type: e.type ?? "",
    manufacturer: e.manufacturer ?? "",
    modelFamily: e.model_family ?? "",
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
  const { data, isLoading, error } = useQuery({ queryKey: ["equipments"], queryFn: listEquipments });
  // Sugestões de TAG cruzando os módulos (cada API lê seu banco — isolamento mantido).
  const sgEquip = useQuery({ queryKey: ["sentinelgrid", "equipment", "suggest"], queryFn: () => listEquipment({ pageSize: 500 }) });
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EquipmentInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showImportEq, setShowImportEq] = useState(false);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  // Filtros do cadastro (client-side — o payload já traz todos os equipamentos, clientes e sites).
  const [fCustomer, setFCustomer] = useState<number | "">("");
  const [fSite, setFSite] = useState<number | "">("");
  const [fType, setFType] = useState("");
  const [fFamily, setFFamily] = useState("");

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
    // customer_id pode vir como string (bigint do Postgres) — coerção numérica.
    sites.filter((s: Site) => !customerId || Number(s.customer_id) === customerId);

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

  const openNew = () => { setEditId(null); setForm(EMPTY); setActionError(null); setShow(true); };
  const openEdit = (e: Equipment) => { setEditId(e.id); setForm(toInput(e)); setActionError(null); setShow(true); };

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
          <tr><th>Tipo</th><th>Fabricante</th><th>Família</th><th>Nº de série</th><th>TAG</th><th>Cliente</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {filteredEquipments.length === 0 && <tr><td colSpan={7} className="text-muted">{hasFilter ? "Nenhum equipamento corresponde aos filtros." : "Nenhum equipamento."}</td></tr>}
          {filteredEquipments.map((e: Equipment) => (
            <tr key={e.id}>
              <td>{e.type}</td>
              <td>{e.manufacturer}</td>
              <td>{e.model_family}</td>
              <td>{e.serial_number}</td>
              <td>{e.tag_number}</td>
              <td>{e.customer_name || "—"}</td>
              <td className="text-end">
                <div className="vx-actions justify-content-end">
                  <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(e)} />
                  <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o equipamento "${e.type}"?`)) mDelete.mutate(e.id); }} />
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
              <div className="col-md-6">
                <Form.Label>Cliente</Form.Label>
                <Form.Select
                  required
                  value={form.customerId === "" ? "" : form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value ? Number(e.target.value) : "", siteId: "" })}
                >
                  <option value="">Selecione…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
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
    </>
  );
}
