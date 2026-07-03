import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import { listSites } from "../../api/sentinelgrid/sites";
import { SgArea, SgAreaInput, createArea, deleteArea, listAreas, updateArea } from "../../api/sentinelgrid/areas";

const EMPTY: SgAreaInput = { siteId: 0, name: "", areaType: "", classification: "", accessRestrictions: "", envConditions: "", notes: "" };

function toInput(a: SgArea): SgAreaInput {
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

export default function AreasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState<number | 0>(0);

  const sitesQuery = useQuery({ queryKey: ["sentinelgrid", "sites", 0, ""], queryFn: () => listSites({ pageSize: 100 }) });
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "areas", siteFilter, search],
    queryFn: () => listAreas({ siteId: siteFilter || undefined, search })
  });

  const [novo, setNovo] = useState<SgAreaInput>(EMPTY);
  const [editing, setEditing] = useState<SgArea | null>(null);
  const [editInput, setEditInput] = useState<SgAreaInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "areas"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({
    mutationFn: () => createArea(novo),
    onSuccess: () => { setNovo({ ...EMPTY }); setActionError(null); invalidate(); },
    onError
  });
  const mUpdate = useMutation({
    mutationFn: () => updateArea(editing!.id, editInput),
    onSuccess: () => { setEditing(null); setActionError(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteArea, onSuccess: invalidate, onError });

  const openEdit = (a: SgArea) => { setEditing(a); setEditInput(toInput(a)); };

  const sites = sitesQuery.data?.sites ?? [];
  const siteLabel = (id: number) => {
    const s = sites.find((x) => Number(x.id) === Number(id));
    return s ? `${s.client_name} / ${s.name}` : "";
  };

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar áreas: {(error as Error).message}</Alert>;
  }

  const areas = data?.areas ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Áreas</h2>
        <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
      </div>

      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <Card.Header>Nova área</Card.Header>
        <Card.Body>
          <Form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); mCreate.mutate(); }}>
            <div className="col-md-4">
              <Form.Label>Site (Cliente / Site)</Form.Label>
              <Form.Select required value={novo.siteId || ""} onChange={(e) => setNovo({ ...novo, siteId: Number(e.target.value) })}>
                <option value="">Selecione…</option>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.client_name} / {s.name}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-3">
              <Form.Label>Nome da área</Form.Label>
              <Form.Control required value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
            </div>
            <div className="col-md-2">
              <Form.Label>Tipo</Form.Label>
              <Form.Control value={novo.areaType} onChange={(e) => setNovo({ ...novo, areaType: e.target.value })} placeholder="sala de UPS…" />
            </div>
            <div className="col-md-2">
              <Form.Label>Classificação</Form.Label>
              <Form.Control value={novo.classification} onChange={(e) => setNovo({ ...novo, classification: e.target.value })} />
            </div>
            <div className="col-md-1 d-grid">
              <Button type="submit" disabled={mCreate.isPending || !novo.siteId || !novo.name.trim()}>Add</Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span>Áreas ({data?.total ?? areas.length})</span>
          <div className="d-flex gap-2">
            <Form.Select size="sm" style={{ maxWidth: 240 }} value={siteFilter || ""} onChange={(e) => setSiteFilter(Number(e.target.value) || 0)}>
              <option value="">Todos os sites</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.client_name} / {s.name}</option>)}
            </Form.Select>
            <Form.Control size="sm" style={{ maxWidth: 220 }} placeholder="Buscar por nome ou tipo…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </Card.Header>
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr><th>Área</th><th>Site</th><th>Cliente</th><th>Tipo</th><th>Classificação</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {areas.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhuma área.</td></tr>}
            {areas.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.site_name}</td>
                <td>{a.client_name}</td>
                <td>{a.area_type}</td>
                <td>{a.classification}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(a)} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir a área "${a.name}"?`)) mDelete.mutate(a.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton><Modal.Title>Editar área</Modal.Title></Modal.Header>
        {editing && (
          <Form onSubmit={(e) => { e.preventDefault(); mUpdate.mutate(); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label>Site (Cliente / Site)</Form.Label>
                <Form.Select required value={editInput.siteId || ""} onChange={(e) => setEditInput({ ...editInput, siteId: Number(e.target.value) })}>
                  <option value="">Selecione…</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.client_name} / {s.name}</option>)}
                </Form.Select>
                {!sites.some((s) => Number(s.id) === editInput.siteId) && editInput.siteId > 0 && (
                  <Form.Text className="text-muted">Atual: {siteLabel(editInput.siteId) || `#${editInput.siteId}`}</Form.Text>
                )}
              </Form.Group>
              <Form.Group>
                <Form.Label>Nome da área</Form.Label>
                <Form.Control required value={editInput.name} onChange={(e) => setEditInput({ ...editInput, name: e.target.value })} />
              </Form.Group>
              <div className="row g-3">
                <div className="col-6">
                  <Form.Label>Tipo</Form.Label>
                  <Form.Control value={editInput.areaType} onChange={(e) => setEditInput({ ...editInput, areaType: e.target.value })} />
                </div>
                <div className="col-6">
                  <Form.Label>Classificação</Form.Label>
                  <Form.Control value={editInput.classification} onChange={(e) => setEditInput({ ...editInput, classification: e.target.value })} />
                </div>
              </div>
              <Form.Group>
                <Form.Label>Restrições de acesso</Form.Label>
                <Form.Control value={editInput.accessRestrictions} onChange={(e) => setEditInput({ ...editInput, accessRestrictions: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Condições ambientais</Form.Label>
                <Form.Control value={editInput.envConditions} onChange={(e) => setEditInput({ ...editInput, envConditions: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Observações</Form.Label>
                <Form.Control as="textarea" rows={2} value={editInput.notes} onChange={(e) => setEditInput({ ...editInput, notes: e.target.value })} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={mUpdate.isPending || !editInput.siteId || !editInput.name.trim()}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
