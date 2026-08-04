import { confirmDialog } from "./ConfirmDialog";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import {
  EquipmentSpare,
  EquipmentSpareInput,
  EquipmentSparesGroup,
  SparePart,
  copyEquipmentSpares,
  createEquipmentSpare,
  deleteEquipmentSpare,
  getEquipmentSpares,
  linkSparePartToEquipment,
  listSpareParts,
  listSparesGroupedByEquipment,
  updateEquipmentSpare
} from "../api/spareParts";
import SparePartsImportModal from "./SparePartsImportModal";
import IconAction from "./IconAction";
import PrintSheet, { PrintColumn } from "./PrintSheet";

const EMPTY: EquipmentSpareInput = {
  description: "", manufacturer: "", equipmentModel: "", partNumber: "", leadTime: "",
  isObsolete: false, replacedByPartNumber: "", equipmentFamily: "", quantity: 1
};

// Colunas da lista de peças impressa por equipamento (inclui quantidade).
const PRINT_COLUMNS: PrintColumn[] = [
  { key: "idx", label: "#", width: "8mm", align: "end" },
  { key: "description", label: "Descrição" },
  { key: "partNumber", label: "Part Number", width: "32mm" },
  { key: "manufacturer", label: "Fabricante", width: "28mm" },
  { key: "family", label: "Família", width: "24mm" },
  { key: "leadTime", label: "Lead time", width: "20mm" },
  { key: "quantity", label: "Qtd.", width: "14mm", align: "end" },
  { key: "status", label: "Status", width: "18mm" }
];

// Rótulo de equipamento nos seletores de cópia: a TAG vem primeiro porque é
// como o time identifica o ativo em campo; tipo e S/N desempatam.
function equipmentLabel(e: { tag_number?: string | null; type?: string | null; serial_number?: string | null; id: number }): string {
  const tag = String(e.tag_number || "").trim();
  const rest = [e.type, e.serial_number && `S/N ${e.serial_number}`].filter(Boolean).join(" · ");
  if (tag && rest) return `TAG ${tag} — ${rest}`;
  if (tag) return `TAG ${tag}`;
  return rest || `Equipamento #${e.id}`;
}

function toPrintRow(s: EquipmentSpare, i: number): Record<string, string> {
  return {
    idx: String(i + 1),
    description: s.description ?? "",
    partNumber: s.part_number ?? "",
    manufacturer: s.manufacturer ?? "",
    family: s.equipment_family ?? "",
    leadTime: s.lead_time ?? "",
    quantity: String(s.quantity ?? 1),
    status: s.is_obsolete ? "Obsoleta" : "Ativa"
  };
}

function toInput(s: EquipmentSpare): EquipmentSpareInput {
  return {
    description: s.description, manufacturer: s.manufacturer ?? "", equipmentModel: s.equipment_model ?? "",
    partNumber: s.part_number ?? "", leadTime: s.lead_time ?? "", isObsolete: Boolean(s.is_obsolete),
    replacedByPartNumber: s.replaced_by_part_number ?? "", equipmentFamily: s.equipment_family ?? "",
    quantity: s.quantity ?? 1
  };
}

export default function EquipmentSparesPanel() {
  const qc = useQueryClient();
  const { data: catalog } = useQuery({ queryKey: ["spare-parts"], queryFn: listSpareParts });
  const [customerId, setCustomerId] = useState<number | "">("");
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [linkQty, setLinkQty] = useState<Record<number, number>>({});
  const [linkedFilter, setLinkedFilter] = useState("");
  const [availableFilter, setAvailableFilter] = useState("");
  const [editModal, setEditModal] = useState<{ id: number | null; form: EquipmentSpareInput } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [consolidated, setConsolidated] = useState<EquipmentSparesGroup[] | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [copySiteId, setCopySiteId] = useState<number | "">("");
  const [copySourceId, setCopySourceId] = useState<number | "">("");
  const [copyTargetId, setCopyTargetId] = useState<number | "">("");
  const [copyReplace, setCopyReplace] = useState(false);
  const [copyInfo, setCopyInfo] = useState<string | null>(null);

  const customers = catalog?.customers ?? [];
  const equipments = useMemo(
    // customer_id pode vir como string (bigint do Postgres) — compara com coerção numérica.
    () => (catalog?.equipments ?? []).filter((e) => !customerId || Number(e.customer_id) === customerId),
    [catalog, customerId]
  );

  const eqId = typeof equipmentId === "number" ? equipmentId : 0;
  const selectedEquipment = (catalog?.equipments ?? []).find((e) => Number(e.id) === eqId);
  const { data, isFetching } = useQuery({
    queryKey: ["equipment-spares", eqId],
    queryFn: () => getEquipmentSpares(eqId),
    enabled: eqId > 0
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["equipment-spares", eqId] });
    qc.invalidateQueries({ queryKey: ["spare-part-applications"] });
  };
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mLink = useMutation({
    mutationFn: (p: { sparePartId: number; quantity: number }) => linkSparePartToEquipment(eqId, p.sparePartId, p.quantity),
    onSuccess: invalidate, onError
  });
  const mCreate = useMutation({ mutationFn: (input: EquipmentSpareInput) => createEquipmentSpare(eqId, input), onSuccess: () => { setEditModal(null); invalidate(); }, onError });
  const mUpdate = useMutation({ mutationFn: (p: { id: number; input: EquipmentSpareInput }) => updateEquipmentSpare(p.id, p.input), onSuccess: () => { setEditModal(null); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: deleteEquipmentSpare, onSuccess: invalidate, onError });

  // ---- Cópia entre equipamentos (diálogo autônomo) -----------------------
  // A cópia só é permitida dentro de um mesmo site, então o site é o primeiro
  // passo e origem/destino saem sempre da lista daquele site.
  const sites = useMemo(() => {
    const byId = new Map<number, string>();
    for (const e of catalog?.equipments ?? []) {
      const id = Number(e.site_id);
      if (id > 0 && !byId.has(id)) byId.set(id, e.site_name || `Site #${id}`);
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog]);

  // includeEmpty: o destino pode ser um equipamento que ainda não tem peça nenhuma.
  const siteEquipmentsQ = useQuery({
    queryKey: ["spares-by-site", copySiteId],
    queryFn: () => listSparesGroupedByEquipment({ siteId: Number(copySiteId), includeEmpty: true }),
    enabled: showCopy && typeof copySiteId === "number" && copySiteId > 0
  });
  const siteGroups = siteEquipmentsQ.data?.groups ?? [];
  const copySources = siteGroups.filter((g) => g.spares.length > 0 && Number(g.equipment.id) !== copyTargetId);
  const copyTargets = siteGroups.filter((g) => Number(g.equipment.id) !== copySourceId);
  const copyTargetGroup = siteGroups.find((g) => Number(g.equipment.id) === copyTargetId);

  const mCopy = useMutation({
    mutationFn: (p: { sourceId: number; targetId: number; replace: boolean }) =>
      copyEquipmentSpares(p.targetId, p.sourceId, p.replace),
    onSuccess: (result, vars) => {
      setShowCopy(false);
      setCopyInfo(
        `${result.inserted} peça(s) copiada(s)` +
        (result.skipped ? `, ${result.skipped} já existia(m) no destino` : "") +
        (result.removed ? `, ${result.removed} substituída(s)` : "") + "."
      );
      // O destino pode não ser o equipamento aberto no painel — invalida os dois.
      qc.invalidateQueries({ queryKey: ["equipment-spares", vars.targetId] });
      invalidate();
      qc.invalidateQueries({ queryKey: ["spares-by-site", copySiteId] });
    },
    onError
  });

  // Consolidado: busca sob demanda (não fica em cache de tela) e imprime agrupado.
  const mConsolidated = useMutation({
    mutationFn: () => listSparesGroupedByEquipment({ customerId: typeof customerId === "number" ? customerId : undefined }),
    onSuccess: (result) => {
      if (!result.groups.length) {
        setActionError("Nenhum equipamento com peças cadastradas para o filtro selecionado.");
        return;
      }
      setConsolidated(result.groups);
    },
    onError
  });

  const linked = data?.linkedSpares ?? [];
  const available = data?.availableSpares ?? [];

  const matches = (s: { description?: string | null; part_number?: string | null; manufacturer?: string | null; equipment_family?: string | null }, q: string) =>
    !q || [s.description, s.part_number, s.manufacturer, s.equipment_family].some((v) => (v || "").toLowerCase().includes(q));
  const linkedView = linked.filter((s) => matches(s, linkedFilter.trim().toLowerCase()));
  const availableView = available.filter((s) => matches(s, availableFilter.trim().toLowerCase()));

  // Soma das quantidades, para o cabeçalho da lista impressa.
  const totalQuantity = linkedView.reduce((sum, s) => sum + (Number(s.quantity) || 0), 0);

  const submitForm = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editModal) return;
    if (editModal.id) mUpdate.mutate({ id: editModal.id, input: editModal.form });
    else mCreate.mutate(editModal.form);
  };

  return (
    <div className="d-flex flex-column gap-3">
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      {copyInfo && <Alert variant="success" dismissible onClose={() => setCopyInfo(null)}>{copyInfo}</Alert>}

      <Card>
        <Card.Body className="row g-3 align-items-end">
          <div className="col-md-4">
            <Form.Label>Cliente</Form.Label>
            <Form.Select value={customerId === "" ? "" : customerId} onChange={(e) => { setCustomerId(e.target.value ? Number(e.target.value) : ""); setEquipmentId(""); }}>
              <option value="">Todos</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-4">
            <Form.Label>Equipamento</Form.Label>
            <Form.Select value={equipmentId === "" ? "" : equipmentId} onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Selecione…</option>
              {equipments.map((e) => <option key={e.id} value={e.id}>{equipmentLabel(e)} — {e.customer_name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-4 d-flex flex-wrap gap-2">
            <Button variant="outline-primary" disabled={!eqId} onClick={() => { setEditModal({ id: null, form: EMPTY }); }}>Novo item</Button>
            <Button variant="outline-secondary" disabled={!eqId} onClick={() => setShowImport(true)}>Importar IA/PDF</Button>
            <Button
              variant="outline-secondary"
              onClick={() => {
                setCopyInfo(null);
                setCopyReplace(false);
                setCopySourceId("");
                // Pré-carrega com o equipamento aberto no painel, se houver.
                setCopySiteId(Number(selectedEquipment?.site_id) || "");
                setCopyTargetId(selectedEquipment?.site_id ? eqId : "");
                setShowCopy(true);
              }}
              title="Copiar a lista de peças entre equipamentos de um mesmo site"
            >
              <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 16 }}>content_copy</span>Copiar peças
            </Button>
            <Button
              variant="outline-secondary"
              disabled={mConsolidated.isPending}
              onClick={() => mConsolidated.mutate()}
              title={customerId ? "Imprimir as peças de todos os equipamentos do cliente" : "Imprimir as peças de todos os equipamentos"}
            >
              <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 16 }}>print</span>
              {mConsolidated.isPending ? "Gerando…" : "Imprimir consolidado"}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {!eqId && <Alert variant="light" className="border">Selecione um equipamento para gerenciar suas peças.</Alert>}

      {eqId > 0 && (
        <>
          <Card>
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span>Peças vinculadas {isFetching && <Spinner animation="border" size="sm" className="ms-2" />}</span>
              <div className="d-flex align-items-center gap-2">
                <Form.Control size="sm" placeholder="Filtrar vinculadas…" value={linkedFilter} onChange={(e) => setLinkedFilter(e.target.value)} style={{ maxWidth: 220 }} />
                <Button size="sm" variant="outline-secondary" disabled={linkedView.length === 0} onClick={() => setPrinting(true)} title="Imprimir a lista de peças deste equipamento">
                  <span className="material-symbols-outlined align-middle me-1" style={{ fontSize: 16 }}>print</span>Imprimir lista
                </Button>
                <Badge bg="light" text="dark">{linkedView.length}/{linked.length}</Badge>
              </div>
            </Card.Header>
            <Table striped responsive hover className="mb-0 align-middle">
              <thead><tr><th>Descrição</th><th>Part Number</th><th>Fabricante</th><th>Qtd.</th><th>Status</th><th className="text-end">Ações</th></tr></thead>
              <tbody>
                {linked.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhuma peça vinculada.</td></tr>}
                {linked.length > 0 && linkedView.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhum resultado para o filtro.</td></tr>}
                {linkedView.map((s) => (
                  <tr key={s.id}>
                    <td>{s.description}</td>
                    <td>{s.part_number}</td>
                    <td>{s.manufacturer}</td>
                    <td>{s.quantity}</td>
                    <td>{s.is_obsolete ? <Badge bg="danger">Obsoleta</Badge> : <Badge bg="success">Ativa</Badge>}</td>
                    <td className="text-end">
                      <div className="vx-actions justify-content-end">
                        <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => setEditModal({ id: s.id, form: toInput(s) })} />
                        <IconAction icon="link_off" label="Remover do equipamento" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Remover "${s.description}" deste equipamento?`)) mDelete.mutate(s.id); }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <span>Catálogo disponível para vincular</span>
              <div className="d-flex align-items-center gap-2">
                <Form.Control size="sm" placeholder="Filtrar catálogo…" value={availableFilter} onChange={(e) => setAvailableFilter(e.target.value)} style={{ maxWidth: 220 }} />
                <Badge bg="light" text="dark">{availableView.length}/{available.length}</Badge>
              </div>
            </Card.Header>
            <Table striped responsive hover className="mb-0 align-middle">
              <thead><tr><th>Descrição</th><th>Part Number</th><th>Fabricante</th><th style={{ width: 110 }}>Qtd.</th><th className="text-end">Ação</th></tr></thead>
              <tbody>
                {available.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhuma peça disponível no catálogo.</td></tr>}
                {available.length > 0 && availableView.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum resultado para o filtro.</td></tr>}
                {availableView.slice(0, 100).map((s: SparePart) => (
                  <tr key={s.id}>
                    <td>{s.description}</td>
                    <td>{s.part_number}</td>
                    <td>{s.manufacturer}</td>
                    <td>
                      <Form.Control type="number" min={1} size="sm" value={linkQty[s.id] ?? 1}
                        onChange={(e) => setLinkQty({ ...linkQty, [s.id]: Math.max(1, Number(e.target.value)) })} />
                    </td>
                    <td className="text-end">
                      <div className="vx-actions justify-content-end">
                        <IconAction icon="add_link" label="Vincular ao equipamento" variant="primary" disabled={mLink.isPending} onClick={() => mLink.mutate({ sparePartId: s.id, quantity: linkQty[s.id] ?? 1 })} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {availableView.length > 100 && <Card.Footer className="text-muted small">Mostrando as primeiras 100 de {availableView.length}. Refine o filtro para encontrar a peça.</Card.Footer>}
          </Card>
        </>
      )}

      {/* Modal criar/editar item do equipamento */}
      <Modal show={!!editModal} onHide={() => setEditModal(null)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editModal?.id ? "Editar item" : "Novo item do equipamento"}</Modal.Title></Modal.Header>
        {editModal && (
          <Form onSubmit={submitForm}>
            <Modal.Body className="row g-3">
              <div className="col-md-8">
                <Form.Label>Descrição</Form.Label>
                <Form.Control required value={editModal.form.description} onChange={(e) => setEditModal({ ...editModal, form: { ...editModal.form, description: e.target.value } })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Quantidade</Form.Label>
                <Form.Control type="number" min={1} value={editModal.form.quantity} onChange={(e) => setEditModal({ ...editModal, form: { ...editModal.form, quantity: Math.max(1, Number(e.target.value)) } })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Part Number</Form.Label>
                <Form.Control value={editModal.form.partNumber} onChange={(e) => setEditModal({ ...editModal, form: { ...editModal.form, partNumber: e.target.value } })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Fabricante</Form.Label>
                <Form.Control value={editModal.form.manufacturer} onChange={(e) => setEditModal({ ...editModal, form: { ...editModal.form, manufacturer: e.target.value } })} />
              </div>
              <div className="col-md-4">
                <Form.Label>Família</Form.Label>
                <Form.Control value={editModal.form.equipmentFamily} onChange={(e) => setEditModal({ ...editModal, form: { ...editModal.form, equipmentFamily: e.target.value } })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Lead time</Form.Label>
                <Form.Control value={editModal.form.leadTime} onChange={(e) => setEditModal({ ...editModal, form: { ...editModal.form, leadTime: e.target.value } })} />
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <Form.Check type="switch" label="Obsoleta" checked={editModal.form.isObsolete} onChange={(e) => setEditModal({ ...editModal, form: { ...editModal.form, isObsolete: e.target.checked } })} />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={mCreate.isPending || mUpdate.isPending}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>

      {/* Copiar lista de peças entre equipamentos — sempre dentro do mesmo site. */}
      <Modal show={showCopy} onHide={() => setShowCopy(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>Copiar lista de peças</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <div>
            <Form.Label>Site</Form.Label>
            <Form.Select
              value={copySiteId === "" ? "" : copySiteId}
              onChange={(e) => {
                setCopySiteId(e.target.value ? Number(e.target.value) : "");
                setCopySourceId("");
                setCopyTargetId("");
              }}
            >
              <option value="">Selecione o site…</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Form.Select>
            <Form.Text muted>A cópia só é permitida entre equipamentos da mesma instalação.</Form.Text>
          </div>

          {copySiteId !== "" && siteEquipmentsQ.isFetching && (
            <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando equipamentos do site…</div>
          )}

          {copySiteId !== "" && !siteEquipmentsQ.isFetching && siteGroups.length === 0 && (
            <Alert variant="light" className="border mb-0">Nenhum equipamento cadastrado neste site.</Alert>
          )}

          {copySiteId !== "" && siteGroups.length > 0 && (
            <>
              <div className="row g-3">
                <div className="col-md-6">
                  <Form.Label>Copiar de (origem)</Form.Label>
                  <Form.Select value={copySourceId === "" ? "" : copySourceId} onChange={(e) => setCopySourceId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Selecione a origem…</option>
                    {copySources.map((g) => (
                      <option key={g.equipment.id} value={g.equipment.id}>
                        {equipmentLabel(g.equipment)} — {g.spares.length} peça(s)
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text muted>Só equipamentos com peças cadastradas.</Form.Text>
                </div>
                <div className="col-md-6">
                  <Form.Label>Copiar para (destino)</Form.Label>
                  <Form.Select value={copyTargetId === "" ? "" : copyTargetId} onChange={(e) => setCopyTargetId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Selecione o destino…</option>
                    {copyTargets.map((g) => (
                      <option key={g.equipment.id} value={g.equipment.id}>
                        {equipmentLabel(g.equipment)} — {g.spares.length} peça(s)
                      </option>
                    ))}
                  </Form.Select>
                  <Form.Text muted>Pode ser um equipamento ainda sem peças.</Form.Text>
                </div>
              </div>

              {copySources.length === 0 && (
                <Alert variant="warning" className="mb-0">Nenhum equipamento deste site tem lista de peças para copiar.</Alert>
              )}

              <Form.Check
                type="switch"
                id="copy-replace"
                label="Substituir a lista atual do destino"
                checked={copyReplace}
                onChange={(e) => setCopyReplace(e.target.checked)}
              />
              <div className="small text-muted">
                {copyReplace
                  ? `As ${copyTargetGroup?.spares.length ?? 0} peça(s) já vinculadas ao destino serão apagadas antes da cópia.`
                  : "As peças já existentes no destino são mantidas; repetidas (mesmo Part Number ou descrição) são puladas."}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCopy(false)}>Cancelar</Button>
          <Button
            disabled={!copySourceId || !copyTargetId || mCopy.isPending}
            onClick={async () => {
              if (typeof copySourceId !== "number" || typeof copyTargetId !== "number") return;
              const targetCount = copyTargetGroup?.spares.length ?? 0;
              if (copyReplace && targetCount > 0
                && !(await confirmDialog(`Apagar as ${targetCount} peça(s) atuais de ${equipmentLabel(copyTargetGroup!.equipment)} e substituir pela lista escolhida?`))) return;
              mCopy.mutate({ sourceId: copySourceId, targetId: copyTargetId, replace: copyReplace });
            }}
          >
            {mCopy.isPending ? "Copiando…" : "Copiar"}
          </Button>
        </Modal.Footer>
      </Modal>

      <SparePartsImportModal show={showImport} onHide={() => setShowImport(false)} equipmentId={eqId} onImported={invalidate} />

      {/* Lista de peças do equipamento selecionado, já filtrada. */}
      {printing && (
        <PrintSheet
          title="Lista de peças por equipamento"
          subtitle={[data?.equipment?.type, selectedEquipment?.serial_number && `S/N ${selectedEquipment.serial_number}`]
            .filter(Boolean).join(" · ") || "Equipamento"}
          meta={[
            { label: "Cliente", value: data?.equipment?.customer_name || "—" },
            { label: "Site", value: data?.equipment?.site_name || "—" },
            { label: "Tag", value: selectedEquipment?.tag_number || "—" },
            { label: "Itens / Quantidade", value: `${linkedView.length} / ${totalQuantity}` }
          ]}
          columns={PRINT_COLUMNS}
          rows={linkedView.map(toPrintRow)}
          onClose={() => setPrinting(false)}
        />
      )}

      {/* Consolidado: uma seção por equipamento, na mesma folha. */}
      {consolidated && (
        <PrintSheet
          title="Lista de peças por equipamento"
          subtitle={customerId ? `Cliente: ${customers.find((c) => Number(c.id) === customerId)?.name ?? "—"}` : "Todos os clientes"}
          meta={[
            { label: "Equipamentos", value: String(consolidated.length) },
            { label: "Itens", value: String(consolidated.reduce((sum, g) => sum + g.spares.length, 0)) },
            {
              label: "Quantidade total",
              value: String(consolidated.reduce((sum, g) => sum + g.spares.reduce((n, s) => n + (Number(s.quantity) || 0), 0), 0))
            },
            { label: "Obsoletas", value: String(consolidated.reduce((sum, g) => sum + g.spares.filter((s) => s.is_obsolete).length, 0)) }
          ]}
          columns={PRINT_COLUMNS}
          sections={consolidated.map((g) => ({
            title: [g.equipment.type, g.equipment.customer_name].filter(Boolean).join(" — ") || `Equipamento #${g.equipment.id}`,
            subtitle: [
              g.equipment.site_name,
              g.equipment.serial_number && `S/N ${g.equipment.serial_number}`,
              g.equipment.tag_number && `Tag ${g.equipment.tag_number}`,
              `${g.spares.length} item(ns)`
            ].filter(Boolean).join(" · "),
            rows: g.spares.map(toPrintRow)
          }))}
          onClose={() => setConsolidated(null)}
        />
      )}
    </div>
  );
}
