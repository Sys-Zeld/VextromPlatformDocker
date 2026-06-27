import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../components/IconAction";
import {
  CUSTOMER_TYPES,
  Customer,
  CustomerInput,
  Site,
  SiteInput,
  createCustomer,
  createSite,
  deleteCustomer,
  deleteSite,
  listCustomers,
  updateCustomer,
  updateSite
} from "../api/customers";

const EMPTY_CUSTOMER: CustomerInput = { name: "", customerType: "others", notes: "" };
const EMPTY_SITE: SiteInput = {
  customerId: 0,
  siteName: "",
  siteCode: "",
  location: "",
  latitude: "",
  longitude: "",
  notes: ""
};

export default function CustomersPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["customers"], queryFn: listCustomers });

  const [newCustomer, setNewCustomer] = useState<CustomerInput>(EMPTY_CUSTOMER);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newSite, setNewSite] = useState<SiteInput>(EMPTY_SITE);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customers"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreateCustomer = useMutation({
    mutationFn: createCustomer,
    onSuccess: () => { setNewCustomer(EMPTY_CUSTOMER); invalidate(); },
    onError
  });
  const mUpdateCustomer = useMutation({
    mutationFn: (c: Customer) =>
      updateCustomer(c.id, { name: c.name, customerType: c.customer_type || "others", notes: c.notes || "" }),
    onSuccess: () => { setEditingCustomer(null); invalidate(); },
    onError
  });
  const mDeleteCustomer = useMutation({ mutationFn: deleteCustomer, onSuccess: invalidate, onError });

  const mCreateSite = useMutation({
    mutationFn: createSite,
    onSuccess: () => { setNewSite(EMPTY_SITE); invalidate(); },
    onError
  });
  const mUpdateSite = useMutation({
    mutationFn: (s: Site) =>
      updateSite(s.id, {
        siteName: s.site_name,
        siteCode: s.site_code || "",
        location: s.location || "",
        latitude: s.latitude == null ? "" : String(s.latitude),
        longitude: s.longitude == null ? "" : String(s.longitude),
        notes: s.notes || ""
      }),
    onSuccess: () => { setEditingSite(null); invalidate(); },
    onError
  });
  const mDeleteSite = useMutation({ mutationFn: deleteSite, onSuccess: invalidate, onError });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar clientes: {(error as Error).message}</Alert>;
  }

  const customers = data?.customers ?? [];
  const sites = data?.sites ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <h2 className="h5 mb-0">Clientes &amp; Sites</h2>
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      {/* ---- Clientes ---- */}
      <Card>
        <Card.Header>Novo cliente</Card.Header>
        <Card.Body>
          <Form
            className="row g-2 align-items-end"
            onSubmit={(e) => { e.preventDefault(); mCreateCustomer.mutate(newCustomer); }}
          >
            <div className="col-md-4">
              <Form.Label>Nome</Form.Label>
              <Form.Control
                required
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </div>
            <div className="col-md-3">
              <Form.Label>Tipo</Form.Label>
              <Form.Select
                value={newCustomer.customerType}
                onChange={(e) => setNewCustomer({ ...newCustomer, customerType: e.target.value })}
              >
                {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Observações</Form.Label>
              <Form.Control
                value={newCustomer.notes}
                onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <Button type="submit" disabled={mCreateCustomer.isPending}>Adicionar</Button>
            </div>
          </Form>
        </Card.Body>
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr><th>Nome</th><th>Tipo</th><th>Observações</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {customers.length === 0 && <tr><td colSpan={4} className="text-muted">Nenhum cliente.</td></tr>}
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.customer_type}</td>
                <td>{c.notes}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => setEditingCustomer(c)} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteCustomer.isPending} onClick={() => { if (confirm(`Excluir o cliente "${c.name}"?`)) mDeleteCustomer.mutate(c.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ---- Sites ---- */}
      <Card>
        <Card.Header>Novo site</Card.Header>
        <Card.Body>
          <Form
            className="row g-2 align-items-end"
            onSubmit={(e) => { e.preventDefault(); mCreateSite.mutate(newSite); }}
          >
            <div className="col-md-3">
              <Form.Label>Cliente</Form.Label>
              <Form.Select
                required
                value={newSite.customerId || ""}
                onChange={(e) => setNewSite({ ...newSite, customerId: Number(e.target.value) })}
              >
                <option value="">Selecione…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Nome do site</Form.Label>
              <Form.Control required value={newSite.siteName} onChange={(e) => setNewSite({ ...newSite, siteName: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Form.Label>Código</Form.Label>
              <Form.Control value={newSite.siteCode} onChange={(e) => setNewSite({ ...newSite, siteCode: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Form.Label>Local</Form.Label>
              <Form.Control value={newSite.location} onChange={(e) => setNewSite({ ...newSite, location: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Button type="submit" disabled={mCreateSite.isPending}>Adicionar</Button>
            </div>
          </Form>
        </Card.Body>
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr><th>Site</th><th>Cliente</th><th>Código</th><th>Local</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {sites.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum site.</td></tr>}
            {sites.map((s) => (
              <tr key={s.id}>
                <td>{s.site_name}</td>
                <td>{s.customer_name}</td>
                <td>{s.site_code}</td>
                <td>{s.location}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => setEditingSite(s)} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteSite.isPending} onClick={() => { if (confirm(`Excluir o site "${s.site_name}"?`)) mDeleteSite.mutate(s.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ---- Modal edição de cliente ---- */}
      <Modal show={!!editingCustomer} onHide={() => setEditingCustomer(null)}>
        <Modal.Header closeButton><Modal.Title>Editar cliente</Modal.Title></Modal.Header>
        {editingCustomer && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdateCustomer.mutate(editingCustomer); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label>Nome</Form.Label>
                <Form.Control
                  required
                  value={editingCustomer.name}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Tipo</Form.Label>
                <Form.Select
                  value={editingCustomer.customer_type || "others"}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, customer_type: e.target.value })}
                >
                  {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Observações</Form.Label>
                <Form.Control
                  value={editingCustomer.notes || ""}
                  onChange={(e) => setEditingCustomer({ ...editingCustomer, notes: e.target.value })}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditingCustomer(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdateCustomer.isPending}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>

      {/* ---- Modal edição de site ---- */}
      <Modal show={!!editingSite} onHide={() => setEditingSite(null)}>
        <Modal.Header closeButton><Modal.Title>Editar site</Modal.Title></Modal.Header>
        {editingSite && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdateSite.mutate(editingSite); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label>Nome do site</Form.Label>
                <Form.Control
                  required
                  value={editingSite.site_name}
                  onChange={(e) => setEditingSite({ ...editingSite, site_name: e.target.value })}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Código</Form.Label>
                <Form.Control
                  value={editingSite.site_code || ""}
                  onChange={(e) => setEditingSite({ ...editingSite, site_code: e.target.value })}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Local</Form.Label>
                <Form.Control
                  value={editingSite.location || ""}
                  onChange={(e) => setEditingSite({ ...editingSite, location: e.target.value })}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditingSite(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdateSite.isPending}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
