import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
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
        <span>Equipamentos</span>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-primary" onClick={() => setShowImportEq(true)}>Buscar do SentinelGrid</Button>
          <Button size="sm" onClick={openNew}>Novo equipamento</Button>
        </div>
      </Card.Header>
      {importInfo && <Alert variant="success" className="m-3" dismissible onClose={() => setImportInfo(null)}>{importInfo}</Alert>}
      {actionError && !show && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table striped responsive hover className="mb-0 align-middle">
        <thead>
          <tr><th>Tipo</th><th>Fabricante</th><th>Família</th><th>Nº de série</th><th>TAG</th><th>Cliente</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {equipments.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum equipamento.</td></tr>}
          {equipments.map((e: Equipment) => (
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
