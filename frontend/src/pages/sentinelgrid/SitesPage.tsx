import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import { listClients } from "../../api/sentinelgrid/clients";
import {
  SgSite,
  SgSiteInput,
  createSite,
  deleteSite,
  listSites,
  updateSite
} from "../../api/sentinelgrid/sites";

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

export default function SitesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<number | 0>(0);

  const clientsQuery = useQuery({ queryKey: ["sentinelgrid", "clients", ""], queryFn: () => listClients({}) });
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "sites", clientFilter, search],
    queryFn: () => listSites({ clientId: clientFilter || undefined, search })
  });

  const [novo, setNovo] = useState<SgSiteInput>(EMPTY);
  const [editing, setEditing] = useState<SgSite | null>(null);
  const [editInput, setEditInput] = useState<SgSiteInput>(EMPTY);
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

  const openEdit = (s: SgSite) => { setEditing(s); setEditInput(toInput(s)); };

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
              <Button type="submit" disabled={mCreate.isPending || !novo.clientId || !novo.name.trim()}>Add</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>Sites ({data?.total ?? sites.length})</span>
          <div className="d-flex gap-2">
            <Form.Select size="sm" style={{ maxWidth: 200 }} value={clientFilter || ""} onChange={(e) => setClientFilter(Number(e.target.value) || 0)}>
              <option value="">Todos os clientes</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
            <Form.Control size="sm" style={{ maxWidth: 220 }} placeholder="Buscar por nome ou local…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(s)} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir o site "${s.name}"?`)) mDelete.mutate(s.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton><Modal.Title>Editar site</Modal.Title></Modal.Header>
        {editing && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdate.mutate(); }}>
            <Modal.Body className="d-flex flex-column gap-3">
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
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdate.isPending || !editInput.clientId || !editInput.name.trim()}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
