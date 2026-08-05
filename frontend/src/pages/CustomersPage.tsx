import { confirmDialog } from "../components/ConfirmDialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../components/IconAction";
import { CAP, useCan } from "../api/session";
import {
  CUSTOMER_TYPES,
  Customer,
  CustomerArea,
  CustomerAreaInput,
  CustomerInput,
  Site,
  SiteInput,
  createCustomer,
  createCustomerArea,
  createSite,
  deleteCustomer,
  deleteCustomerArea,
  deleteSite,
  listCustomers,
  updateCustomer,
  updateCustomerArea,
  updateSite
} from "../api/customers";
import { listClients } from "../api/sentinelgrid/clients";
import RegistrySyncModal, { SyncPickItem } from "../components/sentinelgrid/RegistrySyncModal";
import RegistrySuggestField, { RegistrySuggestItem } from "../components/sentinelgrid/RegistrySuggestField";
import { exportToReportService, listSgExportable } from "../api/sentinelgrid/integration";

const EMPTY_CUSTOMER: CustomerInput = { name: "", customerType: "others", notes: "" };
const EMPTY_AREA: CustomerAreaInput = { customerId: 0, name: "", notes: "" };
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
  const can = useCan();
  const { data, isLoading, error } = useQuery({ queryKey: ["customers"], queryFn: listCustomers });
  // Na tela do Service Report, a sugestão exibe somente clientes do outro módulo.
  const sgClients = useQuery({ queryKey: ["sentinelgrid", "clients", "suggest"], queryFn: () => listClients({ pageSize: 500 }) });

  const [newCustomer, setNewCustomer] = useState<CustomerInput>(EMPTY_CUSTOMER);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newArea, setNewArea] = useState<CustomerAreaInput>(EMPTY_AREA);
  const [editingArea, setEditingArea] = useState<CustomerArea | null>(null);
  const [newSite, setNewSite] = useState<SiteInput>(EMPTY_SITE);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importPreselect, setImportPreselect] = useState<number | null>(null);
  const openImport = (preselect: number | null) => { setImportPreselect(preselect); setShowImport(true); };

  // Clientes do SentinelGrid disponíveis para importar no Service Report (via façade do SG,
  // dono do contrato de integração). Carrega só com o modal aberto.
  const sgExportable = useQuery({
    queryKey: ["sentinelgrid", "integration", "sg-exportable"],
    queryFn: listSgExportable,
    enabled: showImport
  });
  const importItems: SyncPickItem[] = (sgExportable.data?.clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: c.tax_id || undefined,
    linked: c.rs_linked
  }));

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

  const mCreateArea = useMutation({
    mutationFn: createCustomerArea,
    onSuccess: () => { setNewArea(EMPTY_AREA); invalidate(); },
    onError
  });
  const mUpdateArea = useMutation({
    mutationFn: (area: CustomerArea) => updateCustomerArea(area.id, { name: area.name, notes: area.notes || "" }),
    onSuccess: () => { setEditingArea(null); invalidate(); },
    onError
  });
  const mDeleteArea = useMutation({ mutationFn: deleteCustomerArea, onSuccess: invalidate, onError });

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
  const areas = data?.areas ?? [];

  // Escolher uma sugestão do SentinelGrid dispara a importação para o Service Report.
  const suggestItems: RegistrySuggestItem[] = (sgClients.data?.clients ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    module: "sg" as const
  }));

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">Clientes &amp; Sites</h2>
        <Button size="sm" variant="outline-primary" onClick={() => openImport(null)}>
          Buscar do SentinelGrid
        </Button>
      </div>
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      {/* ---- Clientes ---- */}
      {/* Só o formulário de criação depende da permissão; a lista abaixo
          permanece visível para os perfis de leitura. */}
      <Card>
        {can(CAP.RECORDS_WRITE) && <><Card.Header>Novo cliente</Card.Header>
        <Card.Body>
          <Form
            className="row g-2 align-items-end"
            onSubmit={(e) => { e.preventDefault(); mCreateCustomer.mutate(newCustomer); }}
          >
            <div className="col-md-4">
              <Form.Label>Nome</Form.Label>
              <RegistrySuggestField
                required
                currentModule="rs"
                value={newCustomer.name}
                onChange={(v) => setNewCustomer({ ...newCustomer, name: v })}
                items={suggestItems}
                onImportPick={(it) => openImport(it.id)}
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
        </Card.Body></>}
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
                    {can(CAP.RECORDS_WRITE) && <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => setEditingCustomer(c)} />}
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteCustomer.isPending} onClick={async () => { if (await confirmDialog(`Excluir o cliente "${c.name}"?`)) mDeleteCustomer.mutate(c.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ---- Áreas por cliente ---- */}
      <Card>
        {can(CAP.RECORDS_WRITE) && <><Card.Header>Nova área do cliente</Card.Header>
        <Card.Body>
          <Form
            className="row g-2 align-items-end"
            onSubmit={(e) => { e.preventDefault(); mCreateArea.mutate(newArea); }}
          >
            <div className="col-md-4">
              <Form.Label>Cliente</Form.Label>
              <Form.Select
                required
                value={newArea.customerId || ""}
                onChange={(e) => setNewArea({ ...newArea, customerId: Number(e.target.value) || 0 })}
              >
                <option value="">Selecione…</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Área</Form.Label>
              <Form.Control
                required
                value={newArea.name}
                onChange={(e) => setNewArea({ ...newArea, name: e.target.value })}
                placeholder="Ex.: Sala UPS, Operações"
              />
            </div>
            <div className="col-md-3">
              <Form.Label>Observações</Form.Label>
              <Form.Control value={newArea.notes} onChange={(e) => setNewArea({ ...newArea, notes: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Button type="submit" disabled={mCreateArea.isPending}>Adicionar</Button>
            </div>
          </Form>
        </Card.Body></>}
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr><th>Área</th><th>Cliente</th><th>Observações</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {areas.length === 0 && <tr><td colSpan={4} className="text-muted">Nenhuma área cadastrada.</td></tr>}
            {areas.map((area) => (
              <tr key={area.id}>
                <td>{area.name}</td>
                <td>{area.customer_name}</td>
                <td>{area.notes || "—"}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    {can(CAP.RECORDS_WRITE) && <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => setEditingArea(area)} />}
                    {can(CAP.RECORDS_WRITE) && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteArea.isPending} onClick={async () => { if (await confirmDialog(`Excluir a área "${area.name}"? Equipamentos vinculados ficarão sem área.`)) mDeleteArea.mutate(area.id); }} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* ---- Sites ---- */}
      <Card>
        {can(CAP.RECORDS_WRITE) && <><Card.Header>Novo site</Card.Header>
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
        </Card.Body></>}
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
                    {can(CAP.RECORDS_WRITE) && <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => setEditingSite(s)} />}
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDeleteSite.isPending} onClick={async () => { if (await confirmDialog(`Excluir o site "${s.site_name}"?`)) mDeleteSite.mutate(s.id); }} />
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

      {/* ---- Modal edição de área ---- */}
      <Modal show={!!editingArea} onHide={() => setEditingArea(null)}>
        <Modal.Header closeButton><Modal.Title>Editar área</Modal.Title></Modal.Header>
        {editingArea && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdateArea.mutate(editingArea); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label>Cliente</Form.Label>
                <Form.Control value={editingArea.customer_name} disabled />
              </Form.Group>
              <Form.Group>
                <Form.Label>Área</Form.Label>
                <Form.Control required value={editingArea.name} onChange={(e) => setEditingArea({ ...editingArea, name: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Observações</Form.Label>
                <Form.Control value={editingArea.notes || ""} onChange={(e) => setEditingArea({ ...editingArea, notes: e.target.value })} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditingArea(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdateArea.isPending}>Salvar</Button>
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

      <RegistrySyncModal
        show={showImport}
        onHide={() => { setShowImport(false); setImportPreselect(null); }}
        preselectId={importPreselect}
        title="Buscar cliente do SentinelGrid"
        description="Traz um cliente ainda não vinculado (e, opcionalmente, seus sites e equipamentos) do SentinelGrid para o Service Report. Clientes já vinculados ficam bloqueados."
        items={importItems}
        disableLinkedItems
        loading={sgExportable.isLoading}
        loadError={sgExportable.error ? (sgExportable.error as Error).message : null}
        confirmLabel="Importar"
        onConfirm={async (id, opts) => (await exportToReportService(id, opts)).result}
        onDone={() => {
          invalidate();
          qc.invalidateQueries({ queryKey: ["sentinelgrid", "integration", "sg-exportable"] });
        }}
      />
    </div>
  );
}
