import { confirmDialog } from "../../components/ConfirmDialog";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Modal, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import Pager from "../../components/sentinelgrid/Pager";
import SgIcon from "../../components/sentinelgrid/SgIcon";

const PAGE_SIZE = 20;
import { listClients } from "../../api/sentinelgrid/clients";
import {
  SgSite,
  SgSiteInput,
  createSite,
  deleteSite,
  listSites,
  updateSite
} from "../../api/sentinelgrid/sites";
import {
  SgArea,
  SgAreaInput,
  createArea,
  deleteArea,
  listAreas,
  updateArea
} from "../../api/sentinelgrid/areas";

const EMPTY: SgSiteInput = { clientId: 0, name: "", siteType: "", location: "", localContact: "", notes: "" };

function toInput(s: SgSite): SgSiteInput {
  return {
    clientId: Number(s.client_id),
    name: s.name,
    siteType: s.site_type || "",
    location: s.location || "",
    localContact: s.local_contact || "",
    notes: s.notes || ""
  };
}

function emptyArea(siteId: number): SgAreaInput {
  return { siteId, name: "", areaType: "", classification: "", accessRestrictions: "", envConditions: "", notes: "" };
}

function toAreaInput(a: SgArea): SgAreaInput {
  return {
    siteId: Number(a.site_id),
    name: a.name,
    areaType: a.area_type || "",
    classification: a.classification || "",
    accessRestrictions: a.access_restrictions || "",
    envConditions: a.env_conditions || "",
    notes: a.notes || ""
  };
}

// Gestão das áreas de um site específico — usada como aba no modal de editar site.
// O site já vem fixado (siteId), então não há seletor de site aqui.
function SiteAreasManager({ siteId }: { siteId: number }) {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "areas", siteId, ""],
    queryFn: () => listAreas({ siteId })
  });

  const [form, setForm] = useState<SgAreaInput>(emptyArea(siteId));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "areas"] });
  const onError = (e: unknown) => setActionError((e as Error).message);
  const reset = () => { setForm(emptyArea(siteId)); setEditingId(null); };

  const mCreate = useMutation({
    mutationFn: () => createArea({ ...form, siteId }),
    onSuccess: () => { reset(); setActionError(null); invalidate(); },
    onError
  });
  const mUpdate = useMutation({
    mutationFn: () => updateArea(editingId!, { ...form, siteId }),
    onSuccess: () => { reset(); setActionError(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteArea, onSuccess: invalidate, onError });

  const areas = data?.areas ?? [];
  const startEdit = (a: SgArea) => { setEditingId(a.id); setForm(toAreaInput(a)); setActionError(null); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); (editingId ? mUpdate : mCreate).mutate(); };
  const saving = mCreate.isPending || mUpdate.isPending;

  return (
    <div className="d-flex flex-column gap-3">
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      {isLoading ? (
        <div className="d-flex align-items-center gap-2 text-muted"><Spinner animation="border" size="sm" /> Carregando áreas…</div>
      ) : error ? (
        <Alert variant="danger" className="mb-0">Falha ao carregar áreas: {(error as Error).message}</Alert>
      ) : (
        <Table striped responsive hover size="sm" className="mb-0">
          <thead>
            <tr><th>Área</th><th>Tipo</th><th>Classificação</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {areas.length === 0 && <tr><td colSpan={4} className="text-muted">Nenhuma área neste site.</td></tr>}
            {areas.map((a) => (
              <tr key={a.id} className={editingId === a.id ? "table-active" : undefined}>
                <td>{a.name}</td>
                <td>{a.area_type}</td>
                <td>{a.classification}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="pencil" label="Editar" variant="outline-secondary" onClick={() => startEdit(a)} />
                    <IconAction icon="trash" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir a área "${a.name}"?`)) mDelete.mutate(a.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>{editingId ? "Editar área" : "Nova área"}</span>
          {editingId && <Button size="sm" variant="link" className="p-0" onClick={reset}>Cancelar edição</Button>}
        </Card.Header>
        <Card.Body>
          <Form className="d-flex flex-column gap-3" onSubmit={submit}>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Label>Nome da área</Form.Label>
                <Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-md-3">
                <Form.Label>Tipo</Form.Label>
                <Form.Control value={form.areaType} onChange={(e) => setForm({ ...form, areaType: e.target.value })} placeholder="sala de UPS…" />
              </div>
              <div className="col-md-3">
                <Form.Label>Classificação</Form.Label>
                <Form.Control value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })} />
              </div>
            </div>
            <div className="row g-3">
              <div className="col-md-6">
                <Form.Label>Restrições de acesso</Form.Label>
                <Form.Control value={form.accessRestrictions} onChange={(e) => setForm({ ...form, accessRestrictions: e.target.value })} />
              </div>
              <div className="col-md-6">
                <Form.Label>Condições ambientais</Form.Label>
                <Form.Control value={form.envConditions} onChange={(e) => setForm({ ...form, envConditions: e.target.value })} />
              </div>
            </div>
            <Form.Group>
              <Form.Label>Observações</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              {editingId && <Button variant="outline-secondary" onClick={reset}>Cancelar</Button>}
              <Button type="submit" disabled={saving || !form.name.trim()}>{editingId ? "Salvar área" : "Adicionar área"}</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}

export default function SitesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<number | 0>(0);
  const [page, setPage] = useState(1);
  const onSearch = (value: string) => { setSearch(value); setPage(1); };
  const onClientFilter = (value: number) => { setClientFilter(value); setPage(1); };

  const clientsQuery = useQuery({ queryKey: ["sentinelgrid", "clients", ""], queryFn: () => listClients({}) });
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "sites", clientFilter, search, page],
    queryFn: () => listSites({ clientId: clientFilter || undefined, search, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });

  const [novo, setNovo] = useState<SgSiteInput>(EMPTY);
  const [editing, setEditing] = useState<SgSite | null>(null);
  const [editInput, setEditInput] = useState<SgSiteInput>(EMPTY);
  const [editTab, setEditTab] = useState<string>("dados");
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "sites"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({
    mutationFn: () => createSite(novo),
    onSuccess: () => { setNovo({ ...EMPTY }); setActionError(null); invalidate(); },
    onError
  });
  const mUpdate = useMutation({
    mutationFn: () => updateSite(editing!.id, editInput),
    onSuccess: () => { setEditing(null); setActionError(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteSite, onSuccess: invalidate, onError });

  const openEdit = (s: SgSite) => { setEditing(s); setEditInput(toInput(s)); setEditTab("dados"); };

  const clients = clientsQuery.data?.clients ?? [];

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar sites: {(error as Error).message}</Alert>;
  }

  const sites = data?.sites ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Sites</h2>
        <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
      </div>

      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <Card.Header>Novo site</Card.Header>
        <Card.Body>
          <Form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); mCreate.mutate(); }}>
            <div className="col-md-3">
              <Form.Label>Cliente</Form.Label>
              <Form.Select required value={novo.clientId || ""} onChange={(e) => setNovo({ ...novo, clientId: Number(e.target.value) })}>
                <option value="">Selecione…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Nome do site</Form.Label>
              <Form.Control required value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Form.Label>Tipo</Form.Label>
              <Form.Control value={novo.siteType} onChange={(e) => setNovo({ ...novo, siteType: e.target.value })} placeholder="data center, subestação…" />
            </div>
            <div className="col-md-3">
              <Form.Label>Localização</Form.Label>
              <Form.Control value={novo.location} onChange={(e) => setNovo({ ...novo, location: e.target.value })} />
            </div>
            <div className="col-md-1 d-grid">
              <Button type="submit" disabled={mCreate.isPending || !novo.clientId || !novo.name.trim()} aria-label="Adicionar site" title="Adicionar site">
                <SgIcon name="new-site" size={19} />
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>Sites ({data?.total ?? sites.length})</span>
          <div className="d-flex gap-2">
            <Form.Select size="sm" style={{ maxWidth: 200 }} value={clientFilter || ""} onChange={(e) => onClientFilter(Number(e.target.value) || 0)}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
            <Form.Control size="sm" style={{ maxWidth: 220 }} placeholder="Buscar por nome ou local…" value={search} onChange={(e) => onSearch(e.target.value)} />
          </div>
        </Card.Header>
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr><th>Site</th><th>Cliente</th><th>Tipo</th><th>Localização</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {sites.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum site.</td></tr>}
            {sites.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.client_name}</td>
                <td>{s.site_type}</td>
                <td>{s.location}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="pencil" label="Editar" variant="outline-secondary" onClick={() => openEdit(s)} />
                    <IconAction icon="trash" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o site "${s.name}"?`)) mDelete.mutate(s.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager page={data?.page ?? page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
      </Card>

      <Modal show={!!editing} onHide={() => setEditing(null)} size="lg">
        <Modal.Header closeButton><Modal.Title>Editar site{editing ? ` — ${editing.name}` : ""}</Modal.Title></Modal.Header>
        {editing && (
          <Modal.Body>
            <Tabs activeKey={editTab} onSelect={(k) => setEditTab(k || "dados")} className="mb-3">
              <Tab eventKey="dados" title="Dados">
                <Form onSubmit={(e) => { e.preventDefault(); mUpdate.mutate(); }} className="d-flex flex-column gap-3">
                  <Form.Group>
                    <Form.Label>Cliente</Form.Label>
                    <Form.Select required value={editInput.clientId || ""} onChange={(e) => setEditInput({ ...editInput, clientId: Number(e.target.value) })}>
                      <option value="">Selecione…</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Nome do site</Form.Label>
                    <Form.Control required value={editInput.name} onChange={(e) => setEditInput({ ...editInput, name: e.target.value })} />
                  </Form.Group>
                  <div className="row g-3">
                    <div className="col-6">
                      <Form.Label>Tipo</Form.Label>
                      <Form.Control value={editInput.siteType} onChange={(e) => setEditInput({ ...editInput, siteType: e.target.value })} />
                    </div>
                    <div className="col-6">
                      <Form.Label>Localização</Form.Label>
                      <Form.Control value={editInput.location} onChange={(e) => setEditInput({ ...editInput, location: e.target.value })} />
                    </div>
                  </div>
                  <Form.Group>
                    <Form.Label>Contato local</Form.Label>
                    <Form.Control value={editInput.localContact} onChange={(e) => setEditInput({ ...editInput, localContact: e.target.value })} />
                  </Form.Group>
                  <Form.Group>
                    <Form.Label>Observações</Form.Label>
                    <Form.Control as="textarea" rows={2} value={editInput.notes} onChange={(e) => setEditInput({ ...editInput, notes: e.target.value })} />
                  </Form.Group>
                  <div className="d-flex justify-content-end gap-2">
                    <Button variant="secondary" onClick={() => setEditing(null)}>Fechar</Button>
                    <Button type="submit" disabled={mUpdate.isPending || !editInput.clientId || !editInput.name.trim()}>Salvar</Button>
                  </div>
                </Form>
              </Tab>
              <Tab eventKey="areas" title="Áreas">
                <SiteAreasManager siteId={editing.id} />
              </Tab>
            </Tabs>
          </Modal.Body>
        )}
      </Modal>
    </div>
  );
}
