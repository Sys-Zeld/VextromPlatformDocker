import { confirmDialog } from "./ConfirmDialog";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import {
  EquipmentSpare,
  EquipmentSpareInput,
  SparePart,
  createEquipmentSpare,
  deleteEquipmentSpare,
  getEquipmentSpares,
  linkSparePartToEquipment,
  listSpareParts,
  updateEquipmentSpare
} from "../api/spareParts";
import SparePartsImportModal from "./SparePartsImportModal";
import IconAction from "./IconAction";

const EMPTY: EquipmentSpareInput = {
  description: "", manufacturer: "", equipmentModel: "", partNumber: "", leadTime: "",
  isObsolete: false, replacedByPartNumber: "", equipmentFamily: "", quantity: 1
};

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

  const customers = catalog?.customers ?? [];
  const equipments = useMemo(
    // customer_id pode vir como string (bigint do Postgres) — compara com coerção numérica.
    () => (catalog?.equipments ?? []).filter((e) => !customerId || Number(e.customer_id) === customerId),
    [catalog, customerId]
  );

  const eqId = typeof equipmentId === "number" ? equipmentId : 0;
  const { data, isFetching } = useQuery({
    queryKey: ["equipment-spares", eqId],
    queryFn: () => getEquipmentSpares(eqId),
    enabled: eqId > 0
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["equipment-spares", eqId] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mLink = useMutation({
    mutationFn: (p: { sparePartId: number; quantity: number }) => linkSparePartToEquipment(eqId, p.sparePartId, p.quantity),
    onSuccess: invalidate, onError
  });
  const mCreate = useMutation({ mutationFn: (input: EquipmentSpareInput) => createEquipmentSpare(eqId, input), onSuccess: () => { setEditModal(null); invalidate(); }, onError });
  const mUpdate = useMutation({ mutationFn: (p: { id: number; input: EquipmentSpareInput }) => updateEquipmentSpare(p.id, p.input), onSuccess: () => { setEditModal(null); invalidate(); }, onError });
  const mDelete = useMutation({ mutationFn: deleteEquipmentSpare, onSuccess: invalidate, onError });

  const linked = data?.linkedSpares ?? [];
  const available = data?.availableSpares ?? [];

  const matches = (s: { description?: string | null; part_number?: string | null; manufacturer?: string | null; equipment_family?: string | null }, q: string) =>
    !q || [s.description, s.part_number, s.manufacturer, s.equipment_family].some((v) => (v || "").toLowerCase().includes(q));
  const linkedView = linked.filter((s) => matches(s, linkedFilter.trim().toLowerCase()));
  const availableView = available.filter((s) => matches(s, availableFilter.trim().toLowerCase()));

  const submitForm = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editModal) return;
    if (editModal.id) mUpdate.mutate({ id: editModal.id, input: editModal.form });
    else mCreate.mutate(editModal.form);
  };

  return (
    <div className="d-flex flex-column gap-3">
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <Card.Body className="row g-3 align-items-end">
          <div className="col-md-4">
            <Form.Label>Cliente</Form.Label>
            <Form.Select value={customerId === "" ? "" : customerId} onChange={(e) => { setCustomerId(e.target.value ? Number(e.target.value) : ""); setEquipmentId(""); }}>
              <option value="">Todos</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-5">
            <Form.Label>Equipamento</Form.Label>
            <Form.Select value={equipmentId === "" ? "" : equipmentId} onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Selecione…</option>
              {equipments.map((e) => <option key={e.id} value={e.id}>{e.type} — {e.customer_name} {e.serial_number ? `(${e.serial_number})` : ""}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-3 d-flex gap-2">
            <Button variant="outline-primary" disabled={!eqId} onClick={() => { setEditModal({ id: null, form: EMPTY }); }}>Novo item</Button>
            <Button variant="outline-secondary" disabled={!eqId} onClick={() => setShowImport(true)}>Importar IA/PDF</Button>
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

      <SparePartsImportModal show={showImport} onHide={() => setShowImport(false)} equipmentId={eqId} onImported={invalidate} />
    </div>
  );
}
