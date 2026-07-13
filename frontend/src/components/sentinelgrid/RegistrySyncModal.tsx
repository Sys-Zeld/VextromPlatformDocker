import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Form, ListGroup, Modal, Spinner } from "react-bootstrap";
import type { SyncOptions, SyncResult } from "../../api/sentinelgrid/integration";

export interface SyncPickItem {
  id: number;
  name: string;
  subtitle?: string;
  linked: boolean;
}

interface Props {
  show: boolean;
  onHide: () => void;
  title: string;
  description: string;
  items: SyncPickItem[];
  loading: boolean;
  loadError?: string | null;
  confirmLabel: string;
  onConfirm: (id: number, opts: SyncOptions) => Promise<SyncResult>;
  onConfirmMany?: (ids: number[], opts: SyncOptions) => Promise<string>;
  onDone?: () => void;
  preselectId?: number | null;
  showHierarchyOptions?: boolean;
  multiSelect?: boolean;
  disableLinkedItems?: boolean;
  successMessage?: (result: SyncResult) => string;
}

export default function RegistrySyncModal({
  show,
  onHide,
  title,
  description,
  items,
  loading,
  loadError,
  confirmLabel,
  onConfirm,
  onConfirmMany,
  onDone,
  preselectId,
  showHierarchyOptions = true,
  multiSelect = false,
  disableLinkedItems = false,
  successMessage
}: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [withSites, setWithSites] = useState(true);
  const [withEquipment, setWithEquipment] = useState(true);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  useEffect(() => {
    if (!show || !preselectId) return;
    if (disableLinkedItems && items.some((it) => it.id === preselectId && it.linked)) return;
    setSelectedId(preselectId);
    setSelectedIds(new Set([preselectId]));
  }, [show, preselectId, items, disableLinkedItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.name.toLowerCase().includes(q) || (it.subtitle || "").toLowerCase().includes(q));
  }, [items, search]);

  const reset = () => {
    setSelectedId(null);
    setSelectedIds(new Set());
    setSearch("");
    setPending(false);
    setError(null);
    setResult(null);
    setBatchResult(null);
    setWithSites(true);
    setWithEquipment(true);
  };

  const close = () => {
    reset();
    onHide();
  };

  const opts = () => ({ withSites, withEquipment: withSites ? withEquipment : false });

  const submit = async () => {
    if (!selectedId) return;
    if (disableLinkedItems && items.some((it) => it.id === selectedId && it.linked)) {
      setError("Este cliente já está vinculado e não pode ser importado novamente.");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);
    setBatchResult(null);
    try {
      const r = await onConfirm(selectedId, opts());
      setResult(r);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const submitMany = async (ids: number[]) => {
    if (!onConfirmMany || ids.length === 0) return;
    setPending(true);
    setError(null);
    setResult(null);
    setBatchResult(null);
    try {
      const message = await onConfirmMany(ids, opts());
      setBatchResult(message);
      onDone?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const toggleSelected = (id: number) => {
    if (disableLinkedItems && items.some((it) => it.id === id && it.linked)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectableItems = disableLinkedItems ? items.filter((it) => !it.linked) : items;
  const allIds = selectableItems.map((it) => it.id);
  const selectedCount = selectedIds.size;

  const defaultSuccess =
    result &&
    `${result.direction === "rs_to_sg"
      ? `Cliente "${result.clientName}" ${result.clientReused ? "atualizado" : "importado"}`
      : `Cliente "${result.rsCustomerName}" enviado ao Service Report`} - ${result.sites} site(s) e ${result.equipment} equipamento(s) sincronizados.`;

  return (
    <Modal show={show} onHide={close} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        <p className="text-muted small mb-0">{description}</p>

        {(result || batchResult) && (
          <Alert variant="success" className="mb-0">
            <strong>Concluido.</strong>{" "}
            {batchResult || (result && successMessage ? successMessage(result) : defaultSuccess)}
          </Alert>
        )}
        {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
        {loadError && <Alert variant="danger" className="mb-0">{loadError}</Alert>}

        <Form.Control size="sm" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />

        {multiSelect && (
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <span className="text-muted small">{selectedCount} selecionado(s)</span>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedIds(new Set(filtered.filter((it) => !disableLinkedItems || !it.linked).map((it) => it.id)))} disabled={filtered.every((it) => disableLinkedItems && it.linked) || pending}>
                Selecionar visiveis
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setSelectedIds(new Set())} disabled={selectedCount === 0 || pending}>
                Limpar
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando...</div>
        ) : (
          <ListGroup style={{ maxHeight: 320, overflowY: "auto" }}>
            {filtered.length === 0 && <ListGroup.Item className="text-muted">Nenhum registro.</ListGroup.Item>}
            {filtered.map((it) => {
              const itemDisabled = disableLinkedItems && it.linked;
              return (
              <ListGroup.Item
                key={it.id}
                action
                disabled={itemDisabled}
                active={!multiSelect && selectedId === it.id}
                onClick={() => {
                  if (itemDisabled) return;
                  if (multiSelect) toggleSelected(it.id);
                  else setSelectedId(it.id);
                }}
                className="d-flex justify-content-between align-items-center gap-2"
              >
                <span className="d-flex align-items-center gap-2">
                  {multiSelect && (
                    <Form.Check
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      disabled={itemDisabled}
                      onChange={() => toggleSelected(it.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Selecionar ${it.name}`}
                    />
                  )}
                  <span>
                    <span className="fw-medium">{it.name}</span>
                    {it.subtitle && <span className="text-muted small ms-2">{it.subtitle}</span>}
                  </span>
                </span>
                {it.linked && <Badge bg="info">já vinculado</Badge>}
              </ListGroup.Item>
              );
            })}
          </ListGroup>
        )}

        {showHierarchyOptions && (
          <div className="d-flex flex-wrap gap-3">
            <Form.Check
              type="checkbox"
              id="sync-with-sites"
              label="Incluir sites"
              checked={withSites}
              onChange={(e) => setWithSites(e.target.checked)}
            />
            <Form.Check
              type="checkbox"
              id="sync-with-equipment"
              label="Incluir equipamentos"
              checked={withSites && withEquipment}
              disabled={!withSites}
              onChange={(e) => setWithEquipment(e.target.checked)}
            />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>Fechar</Button>
        {multiSelect ? (
          <>
            <Button variant="outline-primary" onClick={() => submitMany(allIds)} disabled={allIds.length === 0 || pending || !onConfirmMany}>
              {pending ? <><Spinner animation="border" size="sm" /> Processando...</> : `${confirmLabel} tudo`}
            </Button>
            <Button onClick={() => submitMany(Array.from(selectedIds))} disabled={selectedCount === 0 || pending || !onConfirmMany}>
              {pending ? <><Spinner animation="border" size="sm" /> Processando...</> : `${confirmLabel} selecionados`}
            </Button>
          </>
        ) : (
          <Button onClick={submit} disabled={!selectedId || pending || (disableLinkedItems && items.some((it) => it.id === selectedId && it.linked))}>
            {pending ? <><Spinner animation="border" size="sm" /> Processando...</> : confirmLabel}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
