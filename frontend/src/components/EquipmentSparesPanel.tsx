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
  const [editModal, setEditModal] = useState<{ id: number | null; form: EquipmentSpareInput } | null>(null);
  const [showImport, setShowImport] = useState(false);

  const customers = catalog?.customers ?? [];
  const equipments = useMemo(
    () => (catalog?.equipments ?? []).filter((e) => !customerId || e.customer_id === customerId),
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
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Peças vinculadas {isFetching && <Spinner animation="border" size="sm" className="ms-2" />}</span>
              <Badge bg="light" text="dark">{linked.length}</Badge>
            </Card.Header>
            <Table striped responsive hover className="mb-0 align-middle">
              <thead><tr><th>Descrição</th><th>Part Number</th><th>Fabricante</th><th>Qtd.</th><th>Status</th><th className="text-end">Ações</th></tr></thead>
              <tbody>
                {linked.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhuma peça vinculada.</td></tr>}
                {linked.map((s) => (
                  <tr key={s.id}>
                    <td>{s.description}</td>
                    <td>{s.part_number}</td>
                    <td>{s.manufacturer}</td>
                    <td>{s.quantity}</td>
                    <td>{s.is_obsolete ? <Badge bg="danger">Obsoleta</Badge> : <Badge bg="success">Ativa</Badge>}</td>
                    <td className="text-end">
                      <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => setEditModal({ id: s.id, form: toInput(s) })}>Editar</Button>
                      <Button size="sm" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Remover "${s.description}" deste equipamento?`)) mDelete.mutate(s.id); }}>Remover</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <Card>
            <Card.Header>Catálogo disponível para vincular</Card.Header>
            <Table striped responsive hover className="mb-0 align-middle">
              <thead><tr><th>Descrição</th><th>Part Number</th><th>Fabricante</th><th style={{ width: 110 }}>Qtd.</th><th className="text-end">Ação</th></tr></thead>
              <tbody>
                {available.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhuma peça disponível no catálogo.</td></tr>}
                {available.slice(0, 100).map((s: SparePart) => (
                  <tr key={s.id}>
                    <td>{s.description}</td>
                    <td>{s.part_number}</td>
                    <td>{s.manufacturer}</td>
                    <td>
                      <Form.Control type="number" min={1} size="sm" value={linkQty[s.id] ?? 1}
                        onChange={(e) => setLinkQty({ ...linkQty, [s.id]: Math.max(1, Number(e.target.value)) })} />
                    </td>
                    <td className="text-end">
                      <Button size="sm" disabled={mLink.isPending} onClick={() => mLink.mutate({ sparePartId: s.id, quantity: linkQty[s.id] ?? 1 })}>Vincular</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {available.length > 100 && <Card.Footer className="text-muted small">Mostrando as primeiras 100. Use a importação ou refine o catálogo.</Card.Footer>}
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
