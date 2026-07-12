import { confirmDialog } from "./ConfirmDialog";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import IconAction from "./IconAction";
import {
  Attachment,
  attachmentDownloadUrl,
  deleteAttachment,
  listAttachments,
  uploadAttachment
} from "../api/orderEditor";

function formatBytes(bytes: number | string | null): string {
  const b = Number(bytes);
  if (!b || Number.isNaN(b)) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const MAX_SIZE = 50 * 1024 * 1024;
const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([".html", ".htm", ".svg", ".js", ".mjs"]);

function fileExtension(name: string): string {
  const match = String(name || "").toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

export default function AttachmentsPanel(props: { orderId: number }) {
  const { orderId } = props;
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["order-attachments", orderId], queryFn: () => listAttachments(orderId) });
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["order-attachments", orderId] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mUpload = useMutation({
    mutationFn: (f: File) => uploadAttachment(orderId, f, label),
    onSuccess: () => { setFile(null); setLabel(""); if (fileRef.current) fileRef.current.value = ""; invalidate(); },
    onError
  });
  const mDelete = useMutation({ mutationFn: (attachmentId: number) => deleteAttachment(orderId, attachmentId), onSuccess: invalidate, onError });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setActionError(null);
    if (!file) return;
    if (file.size > MAX_SIZE) { setActionError("Arquivo muito grande. Limite: 50 MB."); return; }
    if (BLOCKED_ATTACHMENT_EXTENSIONS.has(fileExtension(file.name))) {
      setActionError("Tipo de arquivo não permitido para anexos.");
      return;
    }
    mUpload.mutate(file);
  };

  const attachments: Attachment[] = data?.data ?? [];

  return (
    <Card>
      <Card.Header>
        Arquivos da OS <Badge bg="light" text="dark" className="ms-2">{attachments.length}</Badge>
      </Card.Header>
      <Card.Body>
        <p className="text-muted small mb-3">Firmware, manuais, backups de parâmetros e outros arquivos vinculados a esta OS. Limite: 50 MB por arquivo.</p>
        {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
        <Form onSubmit={submit} className="row g-2">
          <div className="col-12 col-md-5">
            <Form.Control ref={fileRef} type="file" size="sm" required onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
          </div>
          <div className="col-12 col-md-5">
            <Form.Control size="sm" placeholder="Label (ex: Manual do equipamento)" maxLength={200} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="col-12 col-md-2 d-grid">
            <Button size="sm" type="submit" disabled={mUpload.isPending || !file}>{mUpload.isPending ? "Enviando…" : "Enviar"}</Button>
          </div>
        </Form>
      </Card.Body>
      {isLoading ? (
        <Card.Body className="text-muted d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</Card.Body>
      ) : error ? (
        <Alert variant="danger" className="m-3">Falha ao carregar anexos: {(error as Error).message}</Alert>
      ) : (
        <Table striped responsive hover className="mb-0 align-middle">
          <thead>
            <tr><th>Label</th><th>Nome do arquivo</th><th>Tamanho</th><th>Data</th><th className="text-end">Ações</th></tr>
          </thead>
          <tbody>
            {attachments.length === 0 && <tr><td colSpan={5} className="text-muted">Nenhum arquivo anexado.</td></tr>}
            {attachments.map((a) => (
              <tr key={a.id}>
                <td>{a.label || "—"}</td>
                <td>{a.original_name || "—"}</td>
                <td>{formatBytes(a.file_size)}</td>
                <td>{formatDate(a.created_at)}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <a className="btn btn-outline-secondary btn-sm" href={attachmentDownloadUrl(orderId, a.id)}>Baixar</a>
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog("Excluir este arquivo? Ação irreversível.")) mDelete.mutate(a.id); }} />
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
