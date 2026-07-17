import { confirmDialog } from "../../components/ConfirmDialog";
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import IconAction from "../../components/IconAction";
import Pager from "../../components/sentinelgrid/Pager";
import SgIcon from "../../components/sentinelgrid/SgIcon";

const PAGE_SIZE = 20;
import {
  CLIENT_STATUS,
  SgClient,
  SgClientInput,
  createClient,
  deleteClient,
  listClients,
  updateClient
} from "../../api/sentinelgrid/clients";
import { listCustomers } from "../../api/customers";
import RegistrySyncModal, { SyncPickItem } from "../../components/sentinelgrid/RegistrySyncModal";
import RegistrySuggestField, { RegistrySuggestItem } from "../../components/sentinelgrid/RegistrySuggestField";
import { importFromReportService, listRsImportable } from "../../api/sentinelgrid/integration";

const EMPTY: SgClientInput = { name: "", taxId: "", segment: "", status: "ativo", notes: "" };

const STATUS_VARIANT: Record<string, string> = { ativo: "success", inativo: "secondary", prospect: "info" };

function toInput(c: SgClient): SgClientInput {
  return { name: c.name, taxId: c.tax_id || "", segment: c.segment || "", status: c.status || "ativo", notes: c.notes || "" };
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const onSearch = (value: string) => { setSearch(value); setPage(1); };
  const { data, isLoading, error } = useQuery({
    queryKey: ["sentinelgrid", "clients", search, page],
    queryFn: () => listClients({ search, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });

  const [novo, setNovo] = useState<SgClientInput>(EMPTY);
  const [editing, setEditing] = useState<SgClient | null>(null);
  const [editInput, setEditInput] = useState<SgClientInput>(EMPTY);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importPreselect, setImportPreselect] = useState<number | null>(null);
  // Seleção múltipla (checkbox) para exclusão em lote. Mantida entre páginas.
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Clientes do Service Report disponíveis para importar (carrega só com o modal aberto).
  const rsImportable = useQuery({
    queryKey: ["sentinelgrid", "integration", "rs-importable"],
    queryFn: listRsImportable,
    enabled: showImport
  });
  const importItems: SyncPickItem[] = (rsImportable.data?.customers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    subtitle: c.customer_type || undefined,
    linked: c.sg_linked
  }));

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

  // Exclusão em lote: dispara os DELETEs em paralelo e agrega falhas parciais
  // (ex.: cliente com sites/equipamentos vinculados que o backend recusa).
  const mBulkDelete = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map((id) => deleteClient(id)));
      const failedIds = ids.filter((_, i) => results[i].status === "rejected");
      return { failedIds, total: ids.length };
    },
    onSuccess: ({ failedIds, total }) => {
      setSelected(new Set(failedIds)); // mantém selecionados só os que falharam
      setActionError(
        failedIds.length
          ? `${failedIds.length} de ${total} cliente(s) não puderam ser excluídos (verifique sites/equipamentos vinculados).`
          : null
      );
      invalidate();
    },
    onError
  });

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openEdit = (c: SgClient) => { setEditing(c); setEditInput(toInput(c)); };

  // Na tela do SentinelGrid, a sugestão exibe somente clientes do outro módulo.
  const rsCustomers = useQuery({ queryKey: ["report-service", "customers", "suggest"], queryFn: listCustomers });
  const suggestItems: RegistrySuggestItem[] = (rsCustomers.data?.customers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    module: "rs" as const
  }));
  const openImport = (preselect: number | null) => { setImportPreselect(preselect); setShowImport(true); };

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar clientes: {(error as Error).message}</Alert>;
  }

  const clients = data?.clients ?? [];

  const pageIds = clients.map((c) => c.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));
  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  const askBulkDelete = async () => {
    if (selected.size === 0) return;
    if (await confirmDialog(`Excluir ${selected.size} cliente(s) selecionado(s)?\n\nPara cada um, também serão excluídos sites, áreas, equipamentos, contratos, gestores, planos e ordens vinculados.`)) {
      mBulkDelete.mutate([...selected]);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h2 className="h5 mb-0">SentinelGrid · Clientes</h2>
        <div className="d-flex align-items-center gap-3">
          <Button size="sm" variant="outline-primary" onClick={() => openImport(null)}>
            <span className="d-inline-flex align-items-center gap-1"><SgIcon name="import-report" size={17} />Buscar do Service Report</span>
          </Button>
          <Link to="/sentinelgrid" className="small">← Início do módulo</Link>
        </div>
      </div>

      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Card>
        <Card.Header>Novo cliente</Card.Header>
        <Card.Body>
          <Form className="row g-2 align-items-end" onSubmit={(e) => { e.preventDefault(); mCreate.mutate(); }}>
            <div className="col-md-4">
              <Form.Label>Nome</Form.Label>
              <RegistrySuggestField
                required
                currentModule="sg"
                value={novo.name}
                onChange={(v) => setNovo({ ...novo, name: v })}
                items={suggestItems}
                onImportPick={(it) => openImport(it.id)}
              />
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
              <Button type="submit" disabled={mCreate.isPending || !novo.name.trim()} aria-label="Adicionar cliente" title="Adicionar cliente">
                <SgIcon name="new-client" size={19} />
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <span>Clientes ({data?.total ?? clients.length})</span>
            {selected.size > 0 && (
              <div className="d-flex align-items-center gap-2">
                <Badge bg="secondary">{selected.size} selecionado(s)</Badge>
                <Button size="sm" variant="outline-danger" disabled={mBulkDelete.isPending} onClick={askBulkDelete}>
                  {mBulkDelete.isPending ? "Excluindo…" : "Excluir selecionados"}
                </Button>
                <Button size="sm" variant="link" className="p-0 text-decoration-none" onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            )}
          </div>
          <Form.Control
            size="sm"
            style={{ maxWidth: 260 }}
            placeholder="Buscar por nome ou CNPJ…"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </Card.Header>
        <Table striped responsive hover className="mb-0">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  className="form-check-input"
                  aria-label="Selecionar todos nesta página"
                  checked={allOnPageSelected}
                  ref={(el) => { if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected; }}
                  onChange={toggleAllOnPage}
                  disabled={clients.length === 0}
                />
              </th>
              <th>Nome</th><th>CNPJ</th><th>Segmento</th><th>Status</th><th className="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhum cliente.</td></tr>}
            {clients.map((c) => (
              <tr key={c.id} className={selected.has(c.id) ? "table-active" : undefined}>
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label={`Selecionar ${c.name}`}
                    checked={selected.has(c.id)}
                    onChange={() => toggleOne(c.id)}
                  />
                </td>
                <td>{c.name}</td>
                <td>{c.tax_id}</td>
                <td>{c.segment}</td>
                <td><Badge bg={STATUS_VARIANT[c.status] || "secondary"}>{c.status}</Badge></td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="pencil" label="Editar" variant="outline-secondary" onClick={() => openEdit(c)} />
                    <IconAction icon="trash" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o cliente "${c.name}"?\n\nIsso também exclui sites, áreas, equipamentos, contratos, gestores, planos e ordens vinculados a ele.`)) mDelete.mutate(c.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager page={data?.page ?? page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
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

      <RegistrySyncModal
        show={showImport}
        onHide={() => { setShowImport(false); setImportPreselect(null); }}
        preselectId={importPreselect}
        title="Buscar cliente do Service Report"
        description="Importa um cliente ainda não vinculado (e, opcionalmente, seus sites e equipamentos) do Service Report para o SentinelGrid. Clientes já vinculados ficam bloqueados."
        items={importItems}
        disableLinkedItems
        loading={rsImportable.isLoading}
        loadError={rsImportable.error ? (rsImportable.error as Error).message : null}
        confirmLabel="Importar"
        onConfirm={async (id, opts) => (await importFromReportService(id, opts)).result}
        onDone={() => {
          invalidate();
          qc.invalidateQueries({ queryKey: ["sentinelgrid", "integration", "rs-importable"] });
        }}
      />
    </div>
  );
}
