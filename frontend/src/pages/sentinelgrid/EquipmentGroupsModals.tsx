import { confirmDialog } from "../../components/ConfirmDialog";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import IconAction from "../../components/IconAction";
import SgIcon from "../../components/sentinelgrid/SgIcon";
import {
  SgEquipmentGroup,
  addGroupMembers,
  createEquipmentGroup,
  deleteEquipmentGroup,
  getEquipmentGroup,
  listEquipmentGroups,
  removeGroupMember
} from "../../api/sentinelgrid/equipmentGroups";

// Adiciona os equipamentos selecionados a um grupo (novo ou existente) do site deles.
export function AddToGroupModal({ equipmentIds, siteId, siteName, onHide, onDone }: {
  equipmentIds: number[]; siteId: number; siteName: string; onHide: () => void; onDone: () => void;
}) {
  const qc = useQueryClient();
  const groupsQuery = useQuery({ queryKey: ["sentinelgrid", "equipment-groups", siteId], queryFn: () => listEquipmentGroups({ siteId }) });
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [groupId, setGroupId] = useState<number | "">("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ added: number; skippedWrongSite: number } | null>(null);

  const groups = groupsQuery.data?.groups || [];

  const save = useMutation({
    mutationFn: async () => {
      let gid = groupId === "" ? 0 : Number(groupId);
      if (mode === "new") {
        const g = await createEquipmentGroup({ siteId, name: newName.trim() });
        gid = g.id;
      }
      if (!gid) throw new Error("Selecione um grupo.");
      return addGroupMembers(gid, equipmentIds);
    },
    onSuccess: (r) => {
      setError(null); setResult(r);
      qc.invalidateQueries({ queryKey: ["sentinelgrid", "equipment-groups"] });
    },
    onError: (e) => setError((e as Error).message)
  });

  const canSave = !save.isPending && (mode === "new" ? newName.trim().length > 0 : groupId !== "");

  return (
    <Modal show onHide={onHide}>
      <Modal.Header closeButton><Modal.Title className="h6 mb-0">Adicionar ao grupo</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {result ? (
          <Alert variant="success" className="mb-0">
            {result.added} equipamento(s) adicionado(s){result.skippedWrongSite > 0 && <> · {result.skippedWrongSite} de outro site ignorado(s)</>}.
            <div className="mt-2"><Button size="sm" onClick={onDone}>Concluir</Button></div>
          </Alert>
        ) : (
          <div className="d-flex flex-column gap-3">
            <div className="small text-muted">Site: <strong>{siteName}</strong> · {equipmentIds.length} equipamento(s) selecionado(s).</div>
            <div className="d-flex gap-3">
              <Form.Check type="radio" id="grp-existing" label="Grupo existente" checked={mode === "existing"} onChange={() => setMode("existing")} />
              <Form.Check type="radio" id="grp-new" label="Novo grupo" checked={mode === "new"} onChange={() => setMode("new")} />
            </div>
            {mode === "existing" ? (
              <Form.Select value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Selecione um grupo…</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.member_count})</option>)}
              </Form.Select>
            ) : (
              <Form.Control value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do novo grupo (ex.: Sala UPS)" />
            )}
            {mode === "existing" && groups.length === 0 && <div className="small text-muted">Nenhum grupo neste site ainda — crie um novo.</div>}
          </div>
        )}
      </Modal.Body>
      {!result && (
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave} className="d-inline-flex align-items-center gap-1"><SgIcon name="add-circle" size={16} className="sg-icon--mono" />{save.isPending ? "Salvando…" : "Adicionar"}</Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}

// Gerencia grupos: lista, remove membros, exclui grupo.
export function GroupsModal({ clients, onHide }: { clients: { id: number; name: string }[]; onHide: () => void }) {
  const qc = useQueryClient();
  const [clientFilter, setClientFilter] = useState<number | "">("");
  const [openId, setOpenId] = useState<number | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["sentinelgrid", "equipment-groups", "manage", clientFilter],
    queryFn: () => listEquipmentGroups({ clientId: clientFilter === "" ? undefined : clientFilter })
  });
  const detailQuery = useQuery({
    queryKey: ["sentinelgrid", "equipment-group", openId],
    queryFn: () => getEquipmentGroup(openId as number),
    enabled: openId != null
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sentinelgrid", "equipment-groups"] });
    if (openId != null) qc.invalidateQueries({ queryKey: ["sentinelgrid", "equipment-group", openId] });
  };
  const mDelete = useMutation({ mutationFn: deleteEquipmentGroup, onSuccess: () => { setOpenId(null); invalidate(); } });
  const mRemove = useMutation({ mutationFn: (p: { groupId: number; equipmentId: number }) => removeGroupMember(p.groupId, p.equipmentId), onSuccess: invalidate });

  const groups = groupsQuery.data?.groups || [];

  return (
    <Modal show onHide={onHide} size="lg">
      <Modal.Header closeButton><Modal.Title className="h6 mb-0">Grupos de equipamentos</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="d-flex justify-content-end mb-2">
          <Form.Select size="sm" style={{ maxWidth: 220 }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Form.Select>
        </div>
        {groupsQuery.isLoading ? (
          <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>
        ) : (
          <Table hover responsive className="mb-0 align-middle">
            <thead><tr><th>Grupo</th><th>Cliente / Site</th><th>Equip.</th><th className="text-end">Ações</th></tr></thead>
            <tbody>
              {groups.length === 0 && <tr><td colSpan={4} className="text-muted">Nenhum grupo.</td></tr>}
              {groups.map((g: SgEquipmentGroup) => (
                <>
                  <tr key={g.id}>
                    <td className="fw-medium">{g.name}</td>
                    <td className="small text-muted">{g.client_name} / {g.site_name}</td>
                    <td><Badge bg="secondary">{g.member_count}</Badge></td>
                    <td className="text-end">
                      <div className="vx-actions justify-content-end">
                        <IconAction icon={openId === g.id ? "expand_less_action" : "expand_more_action"} label="Exibir membros" variant="outline-secondary" onClick={() => setOpenId(openId === g.id ? null : g.id)} />
                        <IconAction icon="delete_record" label="Excluir grupo" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog(`Excluir o grupo "${g.name}"?`)) mDelete.mutate(g.id); }} />
                      </div>
                    </td>
                  </tr>
                  {openId === g.id && (
                    <tr>
                      <td colSpan={4} className="bg-light">
                        {detailQuery.isLoading ? (
                          <span className="small text-muted"><Spinner animation="border" size="sm" /> Carregando membros…</span>
                        ) : (detailQuery.data?.members || []).length === 0 ? (
                          <span className="small text-muted">Sem equipamentos no grupo.</span>
                        ) : (
                          <div className="d-flex flex-wrap gap-2">
                            {(detailQuery.data?.members || []).map((m) => (
                              <Badge key={m.id} bg="light" text="dark" className="border d-flex align-items-center gap-1">
                                {m.tag || m.serial_number || `#${m.id}`}
                                <span role="button" title="Remover" style={{ cursor: "pointer" }} onClick={() => mRemove.mutate({ groupId: g.id, equipmentId: m.id })}>✕</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </Table>
        )}
      </Modal.Body>
      <Modal.Footer><Button variant="secondary" onClick={onHide}>Fechar</Button></Modal.Footer>
    </Modal>
  );
}
