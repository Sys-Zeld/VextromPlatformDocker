import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, ProgressBar, Row, Spinner } from "react-bootstrap";
import {
  DuplicateWarning,
  ExpenseAttachment,
  ExpenseCategory,
  ExpenseItem,
  ItemInput,
  addItem,
  attachmentUrl,
  deleteAttachment,
  updateItem,
  uploadAttachment
} from "../../api/expenses";
import { confirmDialog } from "../../components/ConfirmDialog";
import { ViewableFile } from "./AttachmentViewer";
import { errorMessage } from "./shared";

interface Props {
  show: boolean;
  reportId: number;
  item: ExpenseItem | null; // null = nova despesa
  attachments: ExpenseAttachment[];
  duplicates: Record<string, DuplicateWarning[]>;
  categories: ExpenseCategory[];
  allowedExtensions: string[];
  maxFileMb: number;
  onView: (f: ViewableFile) => void;
  onClose: () => void;
  onChanged: () => void;
}

interface Pending {
  key: string;
  file: File;
  state: "queued" | "uploading" | "done" | "error";
  message?: string;
}

export const EMPTY_ITEM: ItemInput = { expenseDate: "", categoryId: "", description: "", justification: "", amount: "", merchant: "", notes: "" };

export const toInput = (i: ExpenseItem): ItemInput => ({
  expenseDate: String(i.expense_date).slice(0, 10),
  categoryId: i.category_id,
  description: i.description,
  justification: i.justification,
  amount: String(i.amount).replace(".", ","),
  merchant: i.merchant || "",
  notes: i.notes || ""
});

// Aceita só dígitos e uma vírgula com até 2 casas (o servidor revalida).
export function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^\d,]/g, "");
  const [int, ...rest] = cleaned.split(",");
  return rest.length ? `${int},${rest.join("").slice(0, 2)}` : int;
}

const fmtSize = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`);

export default function ExpenseItemModal(props: Props) {
  const { show, reportId, item, categories, allowedExtensions, maxFileMb } = props;
  const [form, setForm] = useState<ItemInput>(EMPTY_ITEM);
  const [savedItem, setSavedItem] = useState<ExpenseItem | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const replaceRef = useRef<HTMLInputElement | null>(null);
  const [replacing, setReplacing] = useState<ExpenseAttachment | null>(null);

  useEffect(() => {
    if (!show) return;
    setForm(item ? toInput(item) : EMPTY_ITEM);
    setSavedItem(item);
    setPending([]);
    setError(null);
    setWarnings([]);
  }, [show, item]);

  const current = savedItem ?? item;
  const existing = current ? props.attachments.filter((a) => a.item_id === current.id) : [];
  const activeCategories = categories.filter((c) => c.active || c.id === form.categoryId);
  const valid = Boolean(form.expenseDate && form.categoryId && form.description.trim() && form.justification.trim()
    && /^\d+(,\d{1,2})?$/.test(form.amount) && Number(form.amount.replace(",", ".")) > 0);

  // Validação prévia no navegador (extensão e tamanho); o tipo real é checado no servidor.
  const addFiles = (files: FileList | File[]) => {
    const accepted: Pending[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!allowedExtensions.includes(ext)) problems.push(`${file.name}: formato não permitido.`);
      else if (file.size > maxFileMb * 1024 * 1024) problems.push(`${file.name}: excede ${maxFileMb} MB.`);
      else accepted.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, state: "queued" });
    }
    setError(problems.length ? problems.join(" ") : null);
    setPending((p) => [...p, ...accepted]);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const describeDuplicates = (dups: DuplicateWarning[]) =>
    dups.map((d) => (d.sameReport ? "neste relatório" : d.reportNumber)).join(", ");

  async function uploadQueue(target: ExpenseItem) {
    const found: string[] = [];
    let failed = 0;
    for (const p of pending.filter((x) => x.state === "queued" || x.state === "error")) {
      setPending((list) => list.map((x) => (x.key === p.key ? { ...x, state: "uploading", message: undefined } : x)));
      try {
        const res = await uploadAttachment(reportId, target.id, p.file);
        if (res.duplicateWarnings.length) {
          found.push(`${p.file.name}: arquivo idêntico já enviado (${describeDuplicates(res.duplicateWarnings)}).`);
        }
        setPending((list) => list.map((x) => (x.key === p.key ? { ...x, state: "done" } : x)));
      } catch (e) {
        failed += 1;
        setPending((list) => list.map((x) => (x.key === p.key ? { ...x, state: "error", message: errorMessage(e) } : x)));
      }
    }
    return { found, failed };
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = current ? await updateItem(reportId, current.id, form) : await addItem(reportId, form);
      setSavedItem(res.item);
      const { found, failed } = await uploadQueue(res.item);
      props.onChanged();
      setWarnings(found);
      setPending((list) => list.filter((x) => x.state !== "done"));
      // Fecha só se tudo subiu e não há alerta para o usuário ler.
      if (!failed && !found.length) props.onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeExisting = async (a: ExpenseAttachment) => {
    if (!(await confirmDialog(`Remover o comprovante "${a.original_name}"?`))) return;
    try {
      await deleteAttachment(reportId, a.id);
      props.onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  // Substituir = enviar o novo e, só se der certo, remover o antigo.
  const onReplacePicked = async (files: FileList | null) => {
    const file = files?.[0];
    const old = replacing;
    setReplacing(null);
    if (!file || !old || !current) return;
    setBusy(true);
    try {
      await uploadAttachment(reportId, current.id, file);
      await deleteAttachment(reportId, old.id);
      props.onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const view = (a: ExpenseAttachment) =>
    props.onView({ name: a.original_name, mime: a.mime_type, url: attachmentUrl(a.id), downloadUrl: attachmentUrl(a.id, true) });

  const accept = allowedExtensions.map((x) => `.${x}`).join(",");
  const uploading = pending.filter((p) => p.state === "uploading" || p.state === "done").length;

  return (
    <Modal show={show} onHide={() => !busy && props.onClose()} size="lg" backdrop={busy ? "static" : true}>
      <Form onSubmit={onSubmit}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title as="h6">{current ? "Editar despesa" : "Nova despesa"}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
          {warnings.map((w) => <Alert key={w} variant="warning" className="mb-0 small">Possível duplicidade — {w}</Alert>)}
          <Row className="g-3">
            <Col sm={6} md={4}>
              <Form.Label>Data *</Form.Label>
              <Form.Control type="date" required value={form.expenseDate} onChange={(e) => setForm({ ...form, expenseDate: e.target.value })} />
            </Col>
            <Col sm={6} md={4}>
              <Form.Label>Categoria *</Form.Label>
              <Form.Select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value ? Number(e.target.value) : "" })}>
                <option value="">Selecione…</option>
                {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Valor (R$) *</Form.Label>
              <Form.Control
                required
                inputMode="decimal"
                placeholder="0,00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: sanitizeAmount(e.target.value) })}
              />
            </Col>
            <Col md={8}>
              <Form.Label>Descrição *</Form.Label>
              <Form.Control required maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Label>Estabelecimento</Form.Label>
              <Form.Control maxLength={200} value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
            </Col>
            <Col md={12}>
              <Form.Label>Justificativa *</Form.Label>
              <Form.Control as="textarea" rows={2} required maxLength={2000} value={form.justification}
                onChange={(e) => setForm({ ...form, justification: e.target.value })} />
            </Col>
            <Col md={12}>
              <Form.Label>Observações</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Col>
          </Row>

          <div>
            <Form.Label className="mb-1">Comprovantes *</Form.Label>
            {existing.length > 0 && (
              <ul className="list-group mb-2">
                {existing.map((a) => (
                  <li key={a.id} className="list-group-item d-flex align-items-center gap-2 flex-wrap">
                    <span className="material-symbols-outlined text-muted">{a.mime_type === "application/pdf" ? "picture_as_pdf" : "image"}</span>
                    <span className="flex-grow-1 text-truncate">{a.original_name} <small className="text-muted">({fmtSize(a.file_size)})</small></span>
                    {props.duplicates[a.id]?.length ? <Badge bg="warning" text="dark" title={describeDuplicates(props.duplicates[a.id])}>Possível duplicidade</Badge> : null}
                    <Button size="sm" variant="outline-secondary" onClick={() => view(a)}>Ver</Button>
                    <Button size="sm" variant="outline-secondary" disabled={busy} onClick={() => { setReplacing(a); replaceRef.current?.click(); }}>Substituir</Button>
                    <Button size="sm" variant="outline-danger" disabled={busy} onClick={() => removeExisting(a)}>Remover</Button>
                  </li>
                ))}
              </ul>
            )}
            <div
              role="button"
              tabIndex={0}
              className={`border rounded-3 p-4 text-center ${dragOver ? "border-primary bg-primary-subtle" : "border-2"}`}
              style={{ borderStyle: "dashed", cursor: "pointer" }}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <span className="material-symbols-outlined fs-2 text-muted d-block">upload_file</span>
              <div>Arraste os arquivos aqui ou clique para selecionar</div>
              <small className="text-muted">{allowedExtensions.join(", ").toUpperCase()} · até {maxFileMb} MB cada · vários arquivos por despesa</small>
            </div>
            <input ref={inputRef} type="file" multiple accept={accept} hidden
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={replaceRef} type="file" accept={accept} hidden
              onChange={(e) => { onReplacePicked(e.target.files); e.target.value = ""; }} />

            {pending.length > 0 && (
              <ul className="list-group mt-2">
                {pending.map((p) => (
                  <li key={p.key} className="list-group-item d-flex align-items-center gap-2">
                    <span className="flex-grow-1 text-truncate">{p.file.name} <small className="text-muted">({fmtSize(p.file.size)})</small></span>
                    {p.state === "queued" && <Badge bg="secondary">Aguardando salvar</Badge>}
                    {p.state === "uploading" && <Spinner animation="border" size="sm" />}
                    {p.state === "done" && <Badge bg="success">Enviado</Badge>}
                    {p.state === "error" && <Badge bg="danger" title={p.message}>{p.message || "Falha"}</Badge>}
                    {(p.state === "queued" || p.state === "error") && !busy && (
                      <Button size="sm" variant="link" className="text-danger p-0" onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))}>remover</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {busy && pending.length > 0 && (
              <ProgressBar className="mt-2" now={(uploading / pending.length) * 100} label={`${uploading}/${pending.length}`} />
            )}
            {!existing.length && !pending.length && (
              <Form.Text muted>É possível salvar sem comprovante, mas ele é obrigatório para enviar o relatório.</Form.Text>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" disabled={busy} onClick={props.onClose}>Fechar</Button>
          <Button type="submit" disabled={!valid || busy}>
            {busy ? <Spinner animation="border" size="sm" /> : current ? "Salvar alterações" : "Adicionar despesa"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
