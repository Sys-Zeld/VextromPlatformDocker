import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../components/IconAction";
import { CAP, useCan } from "../api/session";
import {
  ORDER_STATUSES,
  Order,
  OrderInput,
  createOrder,
  deleteOrder,
  listOrders,
  updateOrder
} from "../api/orders";
import type { Site } from "../api/customers";

const STATUS_VARIANT: Record<string, string> = {
  draft: "secondary",
  valid: "info",
  in_progress: "primary",
  waiting_review: "warning",
  approved: "success",
  issued: "success",
  closed: "dark",
  cancelled: "danger"
};

const EMPTY: OrderInput = {
  customerId: "", siteId: "", title: "", proposalNumber: "", description: "",
  status: "draft", openingDate: "", technicianIds: []
};

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("pt-BR");
}

export default function OrdersPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["orders"], queryFn: listOrders });
  const can = useCan();

  const [actionError, setActionError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderInput>(EMPTY);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["orders"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mDelete = useMutation({ mutationFn: deleteOrder, onSuccess: invalidate, onError });
  const mCreate = useMutation({ mutationFn: createOrder, onSuccess: () => { setShow(false); invalidate(); }, onError });
  const mUpdate = useMutation({
    mutationFn: (p: { id: number; input: OrderInput }) => updateOrder(p.id, p.input),
    onSuccess: () => { setShow(false); invalidate(); },
    onError
  });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar ordens: {(error as Error).message}</Alert>;
  }

  const { orders = [], customers = [], sites = [], technicians = [], technicianIdsByOrder = {} } = data ?? {};
  const sitesForCustomer = (customerId: number | "") =>
    // customer_id pode vir como string (bigint do Postgres) — coerção numérica nos dois lados.
    sites.filter((s: Site) => !customerId || Number(s.customer_id) === Number(customerId));

  const openNew = () => { setEditOrder(null); setForm(EMPTY); setActionError(null); setShow(true); };
  const openEdit = (o: Order) => {
    setEditOrder(o);
    setForm({
      // Coerção numérica: customer_id/site_id vêm como string (bigint) e precisam bater
      // com os value dos <option> para pré-selecionar Cliente/Site ao editar.
      customerId: o.customer_id == null ? "" : Number(o.customer_id),
      siteId: o.site_id == null ? "" : Number(o.site_id), title: o.title ?? "",
      proposalNumber: o.proposal_number ?? "", description: "", status: o.status ?? "draft",
      openingDate: o.opening_date ? o.opening_date.slice(0, 10) : "",
      technicianIds: technicianIdsByOrder[String(o.id)] ?? []
    });
    setActionError(null);
    setShow(true);
  };

  const locked = !!editOrder && String(editOrder.status).toLowerCase() === "approved";
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (editOrder) mUpdate.mutate({ id: editOrder.id, input: form });
    else mCreate.mutate(form);
  };
  const saving = mCreate.isPending || mUpdate.isPending;
  const toggleTech = (id: number) =>
    setForm((f) => ({
      ...f,
      technicianIds: f.technicianIds.includes(id) ? f.technicianIds.filter((t) => t !== id) : [...f.technicianIds, id]
    }));

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Ordens de Serviço <Badge bg="light" text="dark" className="ms-2">{orders.length}</Badge></span>
        {can(CAP.ORDERS_CREATE) && <Button size="sm" onClick={openNew}>Nova OS</Button>}
      </Card.Header>
      {actionError && !show && <Alert variant="danger" className="m-3" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
      <Table striped responsive hover className="mb-0 align-middle">
        <thead>
          <tr><th>OS</th><th>Título</th><th>Cliente</th><th>Site</th><th>Status</th><th>Abertura</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {orders.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhuma ordem de serviço.</td></tr>}
          {orders.map((o: Order) => (
            <tr key={o.id}>
              <td>{o.os_number || `#${o.id}`}</td>
              <td>{o.title || "—"}</td>
              <td>{o.customer_name}</td>
              <td>{o.site_name || "—"}</td>
              <td><Badge bg={STATUS_VARIANT[o.status || "draft"] || "secondary"}>{o.status || "draft"}</Badge></td>
              <td>{fmtDate(o.opening_date)}</td>
              <td className="text-end">
                <div className="vx-actions justify-content-end">
                  {can(CAP.ORDERS_EDIT) && <IconAction icon="edit" label="Editar cadastro" variant="outline-secondary" onClick={() => openEdit(o)} />}
                  <IconAction icon="edit_note" label={can(CAP.ORDERS_EDIT) ? "Editor (novo)" : "Abrir (somente leitura)"} variant="outline-primary" as={Link} to={`/orders/${o.id}/editor`} />
                  <IconAction icon="open_in_new" label="Editor completo (legado)" variant="outline-secondary" href={`/admin/report-service/orders/${o.id}`} />
                  <IconAction icon="picture_as_pdf" label="Histórico de PDFs" variant="outline-secondary" as={Link} to={`/orders/${o.id}/pdf-history`} />
                  {can(CAP.ORDERS_DELETE) && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir a OS "${o.title || o.id}"? Esta ação remove todos os dados vinculados.`)) mDelete.mutate(o.id); }} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card.Footer className="text-muted small">
        Esta tela cobre o cadastro da OS (cliente, site, status, técnicos). A montagem do relatório (timesheet, seções,
        medições, imagens, assinaturas) continua no “Editor completo”.
      </Card.Footer>

      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton><Modal.Title>{editOrder ? `Editar OS ${editOrder.os_number || `#${editOrder.id}`}` : "Nova OS"}</Modal.Title></Modal.Header>
        <Form onSubmit={submit}>
          <Modal.Body>
            {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
            {locked && <Alert variant="warning">OS aprovada — somente leitura. Não é possível salvar alterações.</Alert>}
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Label>Cliente</Form.Label>
                <Form.Select
                  required
                  disabled={!!editOrder || locked}
                  value={form.customerId === "" ? "" : form.customerId}
                  onChange={(e) => setForm({ ...form, customerId: e.target.value ? Number(e.target.value) : "", siteId: "" })}
                >
                  <option value="">Selecione…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Form.Select>
                {editOrder && <Form.Text className="text-muted">Cliente/Site não mudam no cadastro da OS.</Form.Text>}
              </div>
              <div className="col-md-6">
                <Form.Label>Site</Form.Label>
                <Form.Select
                  required
                  disabled={!!editOrder || locked}
                  value={form.siteId === "" ? "" : form.siteId}
                  onChange={(e) => setForm({ ...form, siteId: e.target.value ? Number(e.target.value) : "" })}
                >
                  <option value="">Selecione…</option>
                  {sitesForCustomer(form.customerId).map((s) => <option key={s.id} value={s.id}>{s.site_name}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-6">
                <Form.Label>Título</Form.Label>
                <Form.Control disabled={locked} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Proposta nº</Form.Label>
                <Form.Control disabled={locked} value={form.proposalNumber} onChange={(e) => setForm({ ...form, proposalNumber: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Abertura</Form.Label>
                <Form.Control type="date" disabled={locked} value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} />
              </div>
              {!editOrder && (
                <div className="col-md-4">
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Form.Select>
                </div>
              )}
              <div className="col-12">
                <Form.Label>Descrição</Form.Label>
                <Form.Control as="textarea" rows={2} disabled={locked} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="col-12">
                <Form.Label>Técnicos {editOrder && <span className="text-danger">*</span>}</Form.Label>
                <div className="border rounded p-2" style={{ maxHeight: 160, overflowY: "auto" }}>
                  {technicians.length === 0 && <span className="text-muted small">Cadastre técnicos em “Equipe & Instrumentos”.</span>}
                  {technicians.map((t) => (
                    <Form.Check
                      key={t.id}
                      type="checkbox"
                      id={`tech-${t.id}`}
                      label={t.name}
                      disabled={locked}
                      checked={form.technicianIds.includes(t.id)}
                      onChange={() => toggleTech(t.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShow(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || locked}>{saving ? "Salvando…" : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
  );
}
