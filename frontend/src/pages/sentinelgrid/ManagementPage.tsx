import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import Pager from "../../components/sentinelgrid/Pager";

const PAGE_SIZE = 20;
import { SgClient, listClients } from "../../api/sentinelgrid/clients";
import { SgSite, listSites } from "../../api/sentinelgrid/sites";
import { SgArea, listAreas } from "../../api/sentinelgrid/areas";
import { SgManager, SgManagerInput, createManager, deleteManager, listManagers, updateManager } from "../../api/sentinelgrid/managers";
import { SgContract, SgContractInput, createContract, deleteContract, listContracts, updateContract } from "../../api/sentinelgrid/contracts";

const EMPTY_MANAGER: SgManagerInput = { clientId: 0, siteId: null, areaId: null, name: "", roleType: "", email: "", phone: "", notes: "" };
const EMPTY_CONTRACT: SgContractInput = { clientId: 0, name: "", contractNumber: "", validFrom: "", validTo: "", maintPerYear: null, slaCorrective: "", requiresReport: false, requiresApproval: false, contactEmail: "", contactPhone: "", scope: "", notes: "" };
const dateOnly = (v: string | null) => (v ? String(v).slice(0, 10) : "");

// Iniciais do cliente (até 3 letras/dígitos) p/ o número do contrato. Ex.: "Sabesp Baterias e Manutenção" -> "SBM".
function clientInitials(name: string) {
  const words = (name || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/[A-Za-z0-9]+/g) || [];
  if (words.length === 0) return "XXX";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}
// Numeração INICIAIS-NNNNNN-AA, ex.: SBM-135242-26.
function genContractNumber(clientName: string) {
  const rand = String(Math.floor(100000 + Math.random() * 900000));
  const yy = String(new Date().getFullYear()).slice(-2);
  return `${clientInitials(clientName)}-${rand}-${yy}`;
}

function ManagersSection({ clients, sites, areas }: { clients: SgClient[]; sites: SgSite[]; areas: SgArea[] }) {
  const qc = useQueryClient();
  const [clientFilter, setClientFilter] = useState(0);
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "managers", clientFilter],
    queryFn: () => listManagers({ clientId: clientFilter || undefined })
  });
  const [form, setForm] = useState<SgManagerInput>(EMPTY_MANAGER);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "managers"] });
  const onError = (e: unknown) => setErr((e as Error).message);
  const mSave = useMutation({
    mutationFn: () => (editingId ? updateManager(editingId, form) : createManager(form)),
    onSuccess: () => { setForm(EMPTY_MANAGER); setEditingId(null); setErr(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteManager, onSuccess: invalidate, onError });

  const openEdit = (m: SgManager) => {
    setEditingId(m.id);
    setForm({ clientId: Number(m.client_id), siteId: m.site_id ? Number(m.site_id) : null, areaId: m.area_id ? Number(m.area_id) : null, name: m.name, roleType: m.role_type || "", email: m.email || "", phone: m.phone || "", notes: m.notes || "" });
  };
  const reset = () => { setForm(EMPTY_MANAGER); setEditingId(null); };
  const sitesForClient = sites.filter((s) => Number(s.client_id) === form.clientId);
  const areasForSite = areas.filter((a) => Number(a.site_id) === form.siteId);
  const managers = data?.managers ?? [];

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center gap-2">
        <span>Gestores do cliente ({data?.total ?? managers.length})</span>
        <Form.Select size="sm" style={{ maxWidth: 200 }} value={clientFilter || ""} onChange={(e) => setClientFilter(Number(e.target.value) || 0)}>
          <option value="">Todos os clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Form.Select>
      </Card.Header>
      <Card.Body>
        {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
        <Form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); mSave.mutate(); }}>
          <div className="col-md-3">
            <Form.Label>Cliente</Form.Label>
            <Form.Select required value={form.clientId || ""} onChange={(e) => setForm({ ...form, clientId: Number(e.target.value) || 0, siteId: null, areaId: null })}>
              <option value="">Selecione…</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-2">
            <Form.Label>Site (opcional)</Form.Label>
            <Form.Select disabled={!form.clientId} value={form.siteId || ""} onChange={(e) => setForm({ ...form, siteId: Number(e.target.value) || null, areaId: null })}>
              <option value="">—</option>
              {sitesForClient.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-2">
            <Form.Label>Área (opcional)</Form.Label>
            <Form.Select disabled={!form.siteId} value={form.areaId || ""} onChange={(e) => setForm({ ...form, areaId: Number(e.target.value) || null })}>
              <option value="">—</option>
              {areasForSite.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Form.Select>
          </div>
          <div className="col-md-3">
            <Form.Label>Nome</Form.Label>
            <Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="col-md-2">
            <Form.Label>Papel</Form.Label>
            <Form.Control value={form.roleType} onChange={(e) => setForm({ ...form, roleType: e.target.value })} placeholder="fiscal, manutenção…" />
          </div>
          <div className="col-md-4">
            <Form.Label>E-mail</Form.Label>
            <Form.Control type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@cliente.com" />
          </div>
          <div className="col-md-3">
            <Form.Label>Telefone</Form.Label>
            <Form.Control value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 90000-0000" />
          </div>
          <div className="col-md-2 d-grid">
            <Button type="submit" disabled={mSave.isPending || !form.clientId || !form.name.trim()}>{editingId ? "Salvar" : "Adicionar"}</Button>
          </div>
          {editingId && <div className="col-12"><Button size="sm" variant="link" className="p-0" onClick={reset}>cancelar edição</Button></div>}
        </Form>
      </Card.Body>
      {isLoading ? (
        <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</Card.Body>
      ) : error ? (
        <Card.Body><Alert variant="danger" className="mb-0">{(error as Error).message}</Alert></Card.Body>
      ) : (
        <Table striped responsive hover className="mb-0">
          <thead><tr><th>Nome</th><th>Papel</th><th>Cliente</th><th>Site</th><th>Área</th><th>Contato</th><th className="text-end">Ações</th></tr></thead>
          <tbody>
            {managers.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum gestor.</td></tr>}
            {managers.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.role_type}</td>
                <td>{m.client_name}</td>
                <td>{m.site_name || <span className="text-muted">—</span>}</td>
                <td>{m.area_name || <span className="text-muted">—</span>}</td>
                <td className="small">{m.email}{m.phone ? ` · ${m.phone}` : ""}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(m)} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir o gestor "${m.name}"?`)) mDelete.mutate(m.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

function ContractsSection({ clients }: { clients: SgClient[] }) {
  const qc = useQueryClient();
  const [clientFilter, setClientFilter] = useState(0);
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "contracts", clientFilter, page],
    queryFn: () => listContracts({ clientId: clientFilter || undefined, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });
  const [editing, setEditing] = useState<SgContract | null>(null);
  const [form, setForm] = useState<SgContractInput>(EMPTY_CONTRACT);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["sentinelgrid", "contracts"] });
  const onError = (e: unknown) => setErr((e as Error).message);
  const mSave = useMutation({
    mutationFn: () => (editingId ? updateContract(editingId, form) : createContract(form)),
    onSuccess: () => { setForm(EMPTY_CONTRACT); setEditingId(null); setEditing(null); setErr(null); invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: deleteContract, onSuccess: invalidate, onError });

  const clientName = (id: number) => clients.find((c) => Number(c.id) === id)?.name || "";
  const openEdit = (c: SgContract) => {
    setEditing(c); setEditingId(c.id);
    setForm({ clientId: Number(c.client_id), name: c.name, contractNumber: c.contract_number || "", validFrom: dateOnly(c.valid_from), validTo: dateOnly(c.valid_to), maintPerYear: c.maint_per_year ?? null, slaCorrective: c.sla_corrective || "", requiresReport: c.requires_report, requiresApproval: c.requires_approval, contactEmail: c.contact_email || "", contactPhone: c.contact_phone || "", scope: c.scope || "", notes: c.notes || "" });
  };
  const openNew = () => { setEditing({} as SgContract); setEditingId(null); setForm(EMPTY_CONTRACT); };
  const contracts = data?.contracts ?? [];

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center gap-2">
        <span>Contratos ({data?.total ?? contracts.length})</span>
        <div className="d-flex gap-2">
          <Form.Select size="sm" style={{ maxWidth: 200 }} value={clientFilter || ""} onChange={(e) => { setClientFilter(Number(e.target.value) || 0); setPage(1); }}>
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Form.Select>
          <Button size="sm" onClick={openNew}>+ Novo</Button>
        </div>
      </Card.Header>
      {isLoading ? (
        <Card.Body className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</Card.Body>
      ) : error ? (
        <Card.Body><Alert variant="danger" className="mb-0">{(error as Error).message}</Alert></Card.Body>
      ) : (
        <Table striped responsive hover className="mb-0">
          <thead><tr><th>Contrato</th><th>Número</th><th>Cliente</th><th>Vigência</th><th>Manut/ano</th><th>SLA</th><th>Exige</th><th className="text-end">Ações</th></tr></thead>
          <tbody>
            {contracts.length === 0 && <tr><td colSpan={8} className="text-muted">Nenhum contrato.</td></tr>}
            {contracts.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td className="small"><code>{c.contract_number || "—"}</code></td>
                <td>{c.client_name}</td>
                <td className="small">{dateOnly(c.valid_from) || "—"} → {dateOnly(c.valid_to) || "—"}</td>
                <td>{c.maint_per_year ?? <span className="text-muted">—</span>}</td>
                <td>{c.sla_corrective || <span className="text-muted">—</span>}</td>
                <td>
                  {c.requires_report && <Badge bg="info" className="me-1">Relatório</Badge>}
                  {c.requires_approval && <Badge bg="warning" text="dark">Aprovação</Badge>}
                  {!c.requires_report && !c.requires_approval && <span className="text-muted">—</span>}
                </td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(c)} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm(`Excluir o contrato "${c.name}"?`)) mDelete.mutate(c.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {!isLoading && !error && <Pager page={data?.page ?? page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />}

      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton><Modal.Title>{editingId ? "Editar contrato" : "Novo contrato"}</Modal.Title></Modal.Header>
        {editing && (
          <Form onSubmit={(e) => { e.preventDefault(); mSave.mutate(); }}>
            <Modal.Body className="d-flex flex-column gap-3">
              {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
              <Form.Group>
                <Form.Label>Cliente</Form.Label>
                <Form.Select
                  required
                  value={form.clientId || ""}
                  onChange={(e) => {
                    const clientId = Number(e.target.value) || 0;
                    setForm((f) => ({
                      ...f,
                      clientId,
                      // Gera o número automaticamente ao escolher o cliente (só em contrato novo e se ainda vazio).
                      contractNumber: !editingId && !f.contractNumber && clientId ? genContractNumber(clientName(clientId)) : f.contractNumber
                    }));
                  }}
                >
                  <option value="">Selecione…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Form.Select>
              </Form.Group>
              <Form.Group>
                <Form.Label>Nome do contrato</Form.Label>
                <Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Número do contrato</Form.Label>
                <div className="d-flex gap-2">
                  <Form.Control value={form.contractNumber} onChange={(e) => setForm({ ...form, contractNumber: e.target.value })} placeholder="gerado ao salvar" />
                  <Button variant="outline-secondary" disabled={!form.clientId} onClick={() => setForm({ ...form, contractNumber: genContractNumber(clientName(form.clientId)) })}>Gerar</Button>
                </div>
                <Form.Text className="text-muted">Formato: INICIAIS-NNNNNN-AA (ex.: SBM-135242-26). Deixe em branco para gerar ao salvar.</Form.Text>
              </Form.Group>
              <div className="row g-3">
                <div className="col-6"><Form.Label>Início</Form.Label><Form.Control type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} /></div>
                <div className="col-6"><Form.Label>Fim</Form.Label><Form.Control type="date" value={form.validTo} onChange={(e) => setForm({ ...form, validTo: e.target.value })} /></div>
                <div className="col-6"><Form.Label>Manutenções/ano</Form.Label><Form.Control type="number" min={0} value={form.maintPerYear ?? ""} onChange={(e) => setForm({ ...form, maintPerYear: e.target.value === "" ? null : Number(e.target.value) })} /></div>
                <div className="col-6"><Form.Label>SLA corretivo</Form.Label><Form.Control value={form.slaCorrective} onChange={(e) => setForm({ ...form, slaCorrective: e.target.value })} placeholder="24h…" /></div>
              </div>
              <div className="row g-3">
                <div className="col-6"><Form.Label>E-mail do contato</Form.Label><Form.Control type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} placeholder="contato@cliente.com" /></div>
                <div className="col-6"><Form.Label>Telefone do contato</Form.Label><Form.Control value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} placeholder="(11) 90000-0000" /></div>
              </div>
              <div className="d-flex gap-4">
                <Form.Check type="switch" label="Exige relatório" checked={form.requiresReport} onChange={(e) => setForm({ ...form, requiresReport: e.target.checked })} />
                <Form.Check type="switch" label="Exige aprovação" checked={form.requiresApproval} onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })} />
              </div>
              <Form.Group>
                <Form.Label>Escopo contratado</Form.Label>
                <Form.Control as="textarea" rows={2} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={mSave.isPending || !form.clientId || !form.name.trim()}>{editingId ? "Salvar" : "Criar"}</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </Card>
  );
}

export default function ManagementPage() {
  const clientsQuery = useQuery({ queryKey: ["sentinelgrid", "clients", ""], queryFn: () => listClients({ pageSize: 200 }) });
  const sitesQuery = useQuery({ queryKey: ["sentinelgrid", "sites", 0, ""], queryFn: () => listSites({ pageSize: 200 }) });
  const areasQuery = useQuery({ queryKey: ["sentinelgrid", "areas", "managers"], queryFn: () => listAreas({ pageSize: 500 }) });
  const clients = clientsQuery.data?.clients ?? [];
  const sites = sitesQuery.data?.sites ?? [];
  const areas = areasQuery.data?.areas ?? [];

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Contratos &amp; Gestores</h2>
        <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
      </div>
      <ManagersSection clients={clients} sites={sites} areas={areas} />
      <ContractsSection clients={clients} />
    </div>
  );
}
