import { confirmDialog } from "./ConfirmDialog";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Form, Modal, Table } from "react-bootstrap";
import IconAction from "./IconAction";
import {
  SignRequest,
  SignRequestGuard,
  SignRequestInput,
  cancelSignRequest,
  createSignRequest,
  deleteSignRequest,
  updateSignRequest
} from "../api/reportEditor";

const EMPTY: SignRequestInput = { signerName: "", signerRole: "", signerCompany: "", signerEmail: "", notes: "", notifyTechnicians: true, notificationEmails: "" };

const EMAIL_STATUS_MSG: Record<string, string> = {
  sent: "Link gerado e e-mail enviado ao signatário.",
  smtp: "Link gerado, mas o SMTP não está configurado — copie e envie o link manualmente.",
  send_failed: "Link gerado, mas houve falha ao enviar o e-mail ao signatário.",
  notification_failed: "Link enviado ao signatário, mas houve falha ao notificar os técnicos."
};

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function signLinkFor(token: string): string {
  return `${window.location.origin}/r/sign/${token}`;
}

export default function SignRequestsPanel(props: {
  orderId: number;
  signRequests: SignRequest[];
  guard: SignRequestGuard;
  locked: boolean;
  onChanged: () => void;
}) {
  const { orderId, signRequests, guard, locked, onChanged } = props;
  const [form, setForm] = useState<SignRequestInput>(EMPTY);
  const [result, setResult] = useState<{ variant: string; msg: string; link?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<SignRequestInput>(EMPTY);

  const onError = (e: unknown) => setError((e as Error).message);
  const mCreate = useMutation({
    mutationFn: () => createSignRequest(orderId, form),
    onSuccess: (r) => {
      setError(null);
      setResult({ variant: r.emailStatus === "sent" ? "success" : "warning", msg: EMAIL_STATUS_MSG[r.emailStatus] || "Link gerado.", link: r.link });
      setForm(EMPTY);
      onChanged();
    },
    onError
  });
  const mUpdate = useMutation({
    mutationFn: () => updateSignRequest(orderId, editId as number, { signerName: editForm.signerName, signerRole: editForm.signerRole, signerCompany: editForm.signerCompany, signerEmail: editForm.signerEmail, notes: editForm.notes }),
    onSuccess: () => { setEditId(null); onChanged(); },
    onError
  });
  const mCancel = useMutation({ mutationFn: (id: number) => cancelSignRequest(orderId, id), onSuccess: onChanged, onError });
  const mDelete = useMutation({ mutationFn: (id: number) => deleteSignRequest(orderId, id), onSuccess: onChanged, onError });

  const active = signRequests.filter((r) => r.status === "pending" || r.status === "signed");
  const refused = signRequests.filter((r) => String(r.status || "").toLowerCase() === "cancelled" && String(r.notes || "").toUpperCase().startsWith("RECUSA:"));

  const openEdit = (r: SignRequest) => {
    setEditId(r.id);
    setEditForm({ signerName: r.signer_name || "", signerRole: r.signer_role || "", signerCompany: r.signer_company || "", signerEmail: r.signer_email || "", notes: r.notes || "" });
    setError(null);
  };
  const submitCreate = (ev: React.FormEvent) => { ev.preventDefault(); setResult(null); setError(null); mCreate.mutate(); };
  const copyLink = (link: string) => { navigator.clipboard?.writeText(link).catch(() => { /* ignore */ }); };

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Assinatura eletrônica — links</span>
        <Link className="btn btn-sm btn-outline-primary" to={`/orders/${orderId}/sign`}>Assinar (técnico Vextrom)</Link>
      </Card.Header>
      <Card.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {result && (
          <Alert variant={result.variant} dismissible onClose={() => setResult(null)}>
            {result.msg}
            {result.link && (
              <div className="d-flex gap-2 align-items-center mt-2">
                <Form.Control size="sm" readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} />
                <Button size="sm" variant="outline-secondary" onClick={() => copyLink(result.link as string)}>Copiar</Button>
              </div>
            )}
          </Alert>
        )}

        {!guard.allowed && (
          <Alert variant="warning">
            <div className="fw-semibold mb-1">Não é possível gerar o link de assinatura eletrônica:</div>
            <ul className="mb-0">{guard.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </Alert>
        )}

        {/* Links ativos */}
        {active.length > 0 ? (
          <Table striped responsive hover size="sm" className="align-middle mb-4">
            <thead><tr><th>Destinatário</th><th>Empresa</th><th>E-mail</th><th>Status</th><th>Expiração</th><th>Link</th><th className="text-end">Ações</th></tr></thead>
            <tbody>
              {active.map((r) => (
                <tr key={r.id}>
                  <td>{r.signer_name || "—"}{r.signer_role && <><br /><small className="text-muted">{r.signer_role}</small></>}</td>
                  <td>{r.signer_company || "—"}</td>
                  <td>{r.signer_email || "—"}</td>
                  <td><Badge bg={r.status === "signed" ? "success" : "warning"} text={r.status === "signed" ? undefined : "dark"}>{r.status === "signed" ? "Assinado" : "Aguardando"}</Badge></td>
                  <td>{fmtDate(r.expires_at)}</td>
                  <td style={{ minWidth: 220 }}>
                    {r.status === "pending" ? (
                      <div className="d-flex gap-1">
                        <Form.Control size="sm" readOnly value={signLinkFor(r.token)} onFocus={(e) => e.currentTarget.select()} style={{ fontSize: "0.75rem" }} />
                        <Button size="sm" variant="outline-secondary" onClick={() => copyLink(signLinkFor(r.token))}>Copiar</Button>
                      </div>
                    ) : <span className="text-muted small">—</span>}
                  </td>
                  <td className="text-end">
                    <div className="vx-actions justify-content-end">
                      {!locked && r.status === "pending" && <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => openEdit(r)} />}
                      {!locked && r.status === "pending" && <Button size="sm" variant="outline-warning" disabled={mCancel.isPending} onClick={async () => { if (await confirmDialog("Cancelar este link de assinatura?")) mCancel.mutate(r.id); }}>Cancelar</Button>}
                      {!locked && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog("Excluir esta assinatura eletrônica?")) mDelete.mutate(r.id); }} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-muted small">Nenhum link de assinatura ativo. Gere um link para enviar ao responsável do cliente.</p>
        )}

        {/* Recusados */}
        {refused.length > 0 && (
          <>
            <h3 className="h6 mb-2">Assinaturas recusadas</h3>
            <Table striped responsive hover size="sm" className="align-middle mb-4">
              <thead><tr><th>Destinatário</th><th>Empresa</th><th>Data</th><th>Motivo da recusa</th><th className="text-end">Ações</th></tr></thead>
              <tbody>
                {refused.map((r) => (
                  <tr key={r.id}>
                    <td>{r.signer_name || "—"}</td>
                    <td>{r.signer_company || "—"}</td>
                    <td>{fmtDate(r.updated_at)}</td>
                    <td>{String(r.notes || "").replace(/^RECUSA:\s*/i, "") || "—"}</td>
                    <td className="text-end">
                      {!locked && <IconAction icon="delete" label="Excluir recusa" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog("Excluir esta recusa de assinatura?")) mDelete.mutate(r.id); }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}

        {/* Gerar novo link */}
        {!locked && guard.allowed && (
          <Card className="bg-light">
            <Card.Header className="py-2 small fw-semibold">Gerar novo link de assinatura</Card.Header>
            <Card.Body>
              <Form onSubmit={submitCreate} className="row g-2">
                <div className="col-12 col-md-4"><Form.Label className="small mb-1">Nome do signatário *</Form.Label><Form.Control size="sm" required value={form.signerName} onChange={(e) => setForm({ ...form, signerName: e.target.value })} /></div>
                <div className="col-12 col-md-4"><Form.Label className="small mb-1">Cargo / Função</Form.Label><Form.Control size="sm" value={form.signerRole} onChange={(e) => setForm({ ...form, signerRole: e.target.value })} /></div>
                <div className="col-12 col-md-4"><Form.Label className="small mb-1">Empresa</Form.Label><Form.Control size="sm" value={form.signerCompany} onChange={(e) => setForm({ ...form, signerCompany: e.target.value })} /></div>
                <div className="col-12 col-md-6"><Form.Label className="small mb-1">E-mail *</Form.Label><Form.Control size="sm" type="email" required value={form.signerEmail} onChange={(e) => setForm({ ...form, signerEmail: e.target.value })} /></div>
                <div className="col-12 col-md-6"><Form.Label className="small mb-1">Observações</Form.Label><Form.Control size="sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
                <div className="col-12">
                  <Form.Check type="checkbox" label="Notificar técnicos vinculados à OS" checked={form.notifyTechnicians} onChange={(e) => setForm({ ...form, notifyTechnicians: e.target.checked })} />
                </div>
                <div className="col-12"><Form.Label className="small mb-1">E-mails adicionais para notificação</Form.Label><Form.Control size="sm" placeholder="email1@empresa.com; email2@empresa.com" value={form.notificationEmails} onChange={(e) => setForm({ ...form, notificationEmails: e.target.value })} /></div>
                <div className="col-12 d-flex align-items-center gap-2">
                  <Button size="sm" type="submit" disabled={mCreate.isPending || !form.signerName.trim() || !form.signerEmail.trim()}>{mCreate.isPending ? "Gerando…" : "Gerar link de assinatura"}</Button>
                  <span className="text-muted small">O link expira em 30 dias.</span>
                </div>
              </Form>
            </Card.Body>
          </Card>
        )}
      </Card.Body>

      {/* Modal editar link pendente */}
      <Modal show={editId !== null} onHide={() => setEditId(null)}>
        <Modal.Header closeButton><Modal.Title className="h6 mb-0">Editar link de assinatura</Modal.Title></Modal.Header>
        <Form onSubmit={(e) => { e.preventDefault(); mUpdate.mutate(); }}>
          <Modal.Body className="row g-2">
            <div className="col-12"><Form.Label className="small mb-1">Nome do signatário *</Form.Label><Form.Control size="sm" required value={editForm.signerName} onChange={(e) => setEditForm({ ...editForm, signerName: e.target.value })} /></div>
            <div className="col-12 col-md-6"><Form.Label className="small mb-1">Cargo / Função</Form.Label><Form.Control size="sm" value={editForm.signerRole} onChange={(e) => setEditForm({ ...editForm, signerRole: e.target.value })} /></div>
            <div className="col-12 col-md-6"><Form.Label className="small mb-1">Empresa</Form.Label><Form.Control size="sm" value={editForm.signerCompany} onChange={(e) => setEditForm({ ...editForm, signerCompany: e.target.value })} /></div>
            <div className="col-12"><Form.Label className="small mb-1">E-mail</Form.Label><Form.Control size="sm" type="email" value={editForm.signerEmail} onChange={(e) => setEditForm({ ...editForm, signerEmail: e.target.value })} /></div>
            <div className="col-12"><Form.Label className="small mb-1">Observações</Form.Label><Form.Control size="sm" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={() => setEditId(null)}>Cancelar</Button>
            <Button size="sm" type="submit" disabled={mUpdate.isPending}>{mUpdate.isPending ? "Salvando…" : "Salvar"}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Card>
  );
}
