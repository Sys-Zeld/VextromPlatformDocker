import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import {
  CLIENT_STATUS,
  SgClient,
  SgClientInput,
  createClient,
  deleteClient,
  listClients,
  updateClient
} from "../../api/sentinelgrid/clients";

const EMPTY: SgClientInput = { name: "", taxId: "", segment: "", status: "ativo", notes: "" };

const STATUS_VARIANT: Record<string, string> = { ativo: "success", inativo: "secondary", prospect: "info" };

function toInput(c: SgClient): SgClientInput {
  return { name: c.name, taxId: c.tax_id || "", segment: c.segment || "", status: c.status || "ativo", notes: c.notes || "" };
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "clients", search],
    queryFn: () => listClients({ search })
  });

  const [novo, setNovo] = useState<SgClientInput>(EMPTY);
  const [editing, setEditing] = useState<SgClient | null>(null);
  const [editInput, setEditInput] = useState<SgClientInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "clients"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({
    mutationFn: () => createClient(novo),
    onSuccess: () => { setNovo(EMPTY); setActionError(null); invalidate(); },
    onError
  });
  const mUpdate = useMutation({
    mutationFn: () => updateClient(editing!.id, editInput),
    onSuccess: () => { setEditing(null); setActionError(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteClient, onSuccess: invalidate, onError });

  const openEdit = (c: SgClient) => { setEditing(c); setEditInput(toInput(c)); };

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar clientes: {(error as Error).message}</Alert>;
  }

  const clients = data?.clients ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Clientes</h2>
        <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
      </div>

      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <Card.Header>Novo cliente</Card.Header>
        <Card.Body>
          <Form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); mCreate.mutate(); }}>
            <div className="col-md-4">
              <Form.Label>Nome</Form.Label>
              <Form.Control required value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
            </div>
            <div className="col-md-3">
              <Form.Label>CNPJ / Identificação fiscal</Form.Label>
              <Form.Control value={novo.taxId} onChange={(e) => setNovo({ ...novo, taxId: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Form.Label>Segmento</Form.Label>
              <Form.Control value={novo.segment} onChange={(e) => setNovo({ ...novo, segment: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Form.Label>Status</Form.Label>
              <Form.Select value={novo.status} onChange={(e) => setNovo({ ...novo, status: e.target.value })}>
                {CLIENT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-1 d-grid">
              <Button type="submit" disabled={mCreate.isPending || !novo.name.trim()}>Add</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center gap-2">
          <span>Clientes ({data?.total ?? clients.length})</span>
          <Form.Control
            size="sm"
            style={{ maxWidth: 260 }}
            placeholder="Buscar por nome ou CNPJ…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Card.Header>
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr><th>Nome</th><th>CNPJ</th><th>Segmento</th><th>Status</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum cliente.</td></tr>}
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.tax_id}</td>
                <td>{c.segment}</td>
                <td><Badge bg={STATUS_VARIANT[c.status] || "secondary"}>{c.status}</Badge></td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(c)} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir o cliente "${c.name}"?`)) mDelete.mutate(c.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton><Modal.Title>Editar cliente</Modal.Title></Modal.Header>
        {editing && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdate.mutate(); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label>Nome</Form.Label>
                <Form.Control required value={editInput.name} onChange={(e) => setEditInput({ ...editInput, name: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>CNPJ / Identificação fiscal</Form.Label>
                <Form.Control value={editInput.taxId} onChange={(e) => setEditInput({ ...editInput, taxId: e.target.value })} />
              </Form.Group>
              <div className="row g-3">
                <div className="col-7">
                  <Form.Label>Segmento</Form.Label>
                  <Form.Control value={editInput.segment} onChange={(e) => setEditInput({ ...editInput, segment: e.target.value })} />
                </div>
                <div className="col-5">
                  <Form.Label>Status</Form.Label>
                  <Form.Select value={editInput.status} onChange={(e) => setEditInput({ ...editInput, status: e.target.value })}>
                    {CLIENT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Form.Select>
                </div>
              </div>
              <Form.Group>
                <Form.Label>Observações</Form.Label>
                <Form.Control as="textarea" rows={2} value={editInput.notes} onChange={(e) => setEditInput({ ...editInput, notes: e.target.value })} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdate.isPending || !editInput.name.trim()}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
