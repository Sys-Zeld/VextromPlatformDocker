import { FormEvent, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Collapse, Form, Spinner } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import {
  DuplicateWarning,
  ExpenseAttachment,
  ExpenseItem,
  ItemInput,
  addItem,
  attachmentUrl,
  deleteAttachment,
  deleteItem,
  getReport,
  updateItem,
  uploadAttachment
} from "../../../api/expenses";
import { confirmDialog } from "../../../components/ConfirmDialog";
import { EMPTY_ITEM, sanitizeAmount, toInput } from "../ExpenseItemModal";
import { errorMessage, useExpensesMeta } from "../shared";
import { compressImage, readAsDataUrl } from "./compressImage";
import { useMobileTopbar } from "./MobileShell";

// Despesa no celular: recibo primeiro (câmera ou galeria), depois os campos.
// Mesmo fluxo do modal da versão completa: salva a despesa e então envia a
// fila de recibos, um por vez, com nova tentativa para o que falhar.

interface Pending {
  key: string;
  file: File;
  preview: string | null;
  state: "preparing" | "queued" | "uploading" | "done" | "error";
  message?: string;
}

const today = () => new Date().toLocaleDateString("sv-SE");
const describeDuplicates = (dups: DuplicateWarning[]) =>
  dups.map((d) => (d.sameReport ? "neste relatório" : d.reportNumber)).join(", ");

export default function MobileItemPage() {
  const params = useParams();
  const reportId = Number(params.id);
  const itemId = params.itemId ?? null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const backTo = `/expenses/m/reports/${reportId}`;
  useMobileTopbar(itemId ? "Editar despesa" : "Nova despesa", backTo);

  const meta = useExpensesMeta();
  const detail = useQuery({ queryKey: ["expenses", "report", reportId], queryFn: () => getReport(reportId), enabled: Number.isFinite(reportId) });
  // O id pode chegar como texto (bigint do Postgres): compara como string.
  const item: ExpenseItem | null = (itemId && detail.data?.items.find((i) => String(i.id) === itemId)) || null;

  const [form, setForm] = useState<ItemInput>({ ...EMPTY_ITEM, expenseDate: today() });
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!item) return;
    setForm(toInput(item));
    if (item.merchant || item.notes) setMoreOpen(true);
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (detail.isLoading || meta.isLoading) return <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (detail.error || !detail.data) return <Alert variant="danger" className="mb-0">{errorMessage(detail.error)}</Alert>;
  if (!detail.data.permissions.canEdit) return <Alert variant="warning" className="mb-0">Este relatório não pode mais ser editado.</Alert>;
  if (itemId && !item) return <Alert variant="warning" className="mb-0">Despesa não encontrada.</Alert>;

  const allowedExtensions = meta.data?.allowedExtensions ?? [];
  const maxFileMb = meta.data?.maxFileMb ?? 10;
  const categories = (meta.data?.categories ?? []).filter((c) => c.active || c.id === form.categoryId);
  const existing = item ? detail.data.attachments.filter((a) => a.item_id === item.id) : [];
  const duplicates = detail.data.duplicates;
  const valid = Boolean(form.expenseDate && form.categoryId && form.description.trim() && form.justification.trim()
    && /^\d+(,\d{1,2})?$/.test(form.amount) && Number(form.amount.replace(",", ".")) > 0);
  const preparing = pending.some((p) => p.state === "preparing");

  const update = (key: string, patch: Partial<Pending>) =>
    setPending((list) => list.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // Comprime fotos e valida formato/tamanho no navegador (o servidor revalida).
  const addFiles = async (files: FileList) => {
    setError(null);
    for (const original of Array.from(files)) {
      const key = `${original.name}-${original.size}-${Math.random()}`;
      setPending((p) => [...p, { key, file: original, preview: null, state: "preparing" }]);
      const file = await compressImage(original, allowedExtensions);
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!allowedExtensions.includes(ext)) {
        update(key, { file, state: "error", message: "Formato não permitido" });
      } else if (file.size > maxFileMb * 1024 * 1024) {
        update(key, { file, state: "error", message: `Excede ${maxFileMb} MB` });
      } else {
        const preview = file.type.startsWith("image/") ? await readAsDataUrl(file).catch(() => null) : null;
        update(key, { file, preview, state: "queued" });
      }
    }
  };

  async function uploadQueue(target: ExpenseItem) {
    const found: string[] = [];
    let failed = 0;
    for (const p of pending.filter((x) => x.state === "queued" || (x.state === "error" && x.message === undefined))) {
      update(p.key, { state: "uploading", message: undefined });
      try {
        const res = await uploadAttachment(reportId, target.id, p.file);
        if (res.duplicateWarnings.length) found.push(`${p.file.name}: recibo idêntico já enviado (${describeDuplicates(res.duplicateWarnings)}).`);
        update(p.key, { state: "done" });
      } catch (e) {
        failed += 1;
        update(p.key, { state: "error", message: undefined });
        setError(errorMessage(e));
      }
    }
    return { found, failed };
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy || preparing) return;
    setBusy(true);
    setError(null);
    try {
      const res = item ? await updateItem(reportId, item.id, form) : await addItem(reportId, form);
      const { found, failed } = await uploadQueue(res.item);
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      setPending((list) => list.filter((x) => x.state !== "done"));
      setWarnings(found);
      if (!failed && !found.length) navigate(backTo, { replace: true });
      // Algo para o usuário ver: fica na tela, já como edição da despesa salva.
      else if (!item) navigate(`${backTo}/items/${res.item.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeExisting = async (a: ExpenseAttachment) => {
    if (!(await confirmDialog("Remover este recibo?"))) return;
    try {
      await deleteAttachment(reportId, a.id);
      await qc.invalidateQueries({ queryKey: ["expenses"] });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const removeItem = async () => {
    if (!item || !(await confirmDialog("Excluir esta despesa e seus recibos?"))) return;
    setBusy(true);
    try {
      await deleteItem(reportId, item.id);
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      navigate(backTo, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const set = (key: keyof ItemInput) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const accept = allowedExtensions.map((x) => `.${x}`).join(",");

  return (
    <Form onSubmit={onSubmit} className="d-flex flex-column gap-3">
      {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
      {warnings.map((w) => <Alert key={w} variant="warning" className="mb-0 small">Possível duplicidade — {w}</Alert>)}

      <section>
        <Form.Label className="mb-2">Recibos</Form.Label>
        <div className="exm-receipts">
          {existing.map((a) => (
            <div key={a.id} className="exm-receipt">
              <a href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" aria-label={`Abrir ${a.original_name}`}>
                {a.mime_type.startsWith("image/")
                  ? <img src={attachmentUrl(a.id)} alt={a.original_name} />
                  : <span className="material-symbols-outlined">picture_as_pdf</span>}
              </a>
              {duplicates[a.id]?.length ? <span className="exm-receipt__badge bg-warning text-dark">Duplicado?</span> : null}
              <button type="button" className="exm-receipt__remove" aria-label="Remover recibo" disabled={busy} onClick={() => removeExisting(a)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.key} className={`exm-receipt${p.state === "error" ? " is-error" : ""}`}>
              {p.preview ? <img src={p.preview} alt={p.file.name} /> : (
                <span className="material-symbols-outlined">{p.file.type === "application/pdf" ? "picture_as_pdf" : "image"}</span>
              )}
              {(p.state === "preparing" || p.state === "uploading") && <span className="exm-receipt__overlay"><Spinner animation="border" size="sm" /></span>}
              {p.state === "done" && <span className="exm-receipt__badge bg-success">Enviado</span>}
              {p.state === "error" && <span className="exm-receipt__badge bg-danger">{p.message || "Falhou"}</span>}
              {p.state !== "uploading" && p.state !== "done" && !busy && (
                <button type="button" className="exm-receipt__remove" aria-label="Remover" onClick={() => setPending((l) => l.filter((x) => x.key !== p.key))}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="d-flex gap-2 mt-2">
          <Button variant="outline-primary" className="flex-fill exm-pick" disabled={busy} onClick={() => cameraRef.current?.click()}>
            <span className="material-symbols-outlined">photo_camera</span>Tirar foto
          </Button>
          <Button variant="outline-secondary" className="flex-fill exm-pick" disabled={busy} onClick={() => galleryRef.current?.click()}>
            <span className="material-symbols-outlined">photo_library</span>Galeria ou PDF
          </Button>
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept={`${accept},image/*`} multiple hidden
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        {!existing.length && !pending.length && (
          <Form.Text muted>Pode salvar sem recibo, mas ele é obrigatório para enviar o relatório.</Form.Text>
        )}
      </section>

      <div>
        <Form.Label>Valor (R$) *</Form.Label>
        <Form.Control required inputMode="decimal" placeholder="0,00" className="exm-amount" value={form.amount}
          onChange={(e) => setForm({ ...form, amount: sanitizeAmount(e.target.value) })} />
      </div>
      <div>
        <Form.Label>Data *</Form.Label>
        <Form.Control type="date" required value={form.expenseDate} onChange={set("expenseDate")} />
      </div>
      <div>
        <Form.Label className="d-block">Categoria *</Form.Label>
        <div className="exm-chips" role="radiogroup" aria-label="Categoria">
          {categories.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={form.categoryId === c.id}
              className={`exm-chip${form.categoryId === c.id ? " is-active" : ""}`}
              onClick={() => setForm({ ...form, categoryId: c.id })}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Form.Label>Descrição *</Form.Label>
        <Form.Control required maxLength={500} placeholder="Ex.: Almoço com equipe" value={form.description} onChange={set("description")} />
      </div>
      <div>
        <Form.Label>Justificativa *</Form.Label>
        <Form.Control as="textarea" rows={2} required maxLength={2000} value={form.justification} onChange={set("justification")} />
      </div>

      <Button variant="link" className="align-self-start p-0" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
        {moreOpen ? "Menos detalhes" : "Mais detalhes (estabelecimento, observações)"}
      </Button>
      <Collapse in={moreOpen}>
        <div>
          <div className="d-flex flex-column gap-3">
            <div>
              <Form.Label>Estabelecimento</Form.Label>
              <Form.Control maxLength={200} value={form.merchant} onChange={set("merchant")} />
            </div>
            <div>
              <Form.Label>Observações</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={2000} value={form.notes} onChange={set("notes")} />
            </div>
          </div>
        </div>
      </Collapse>

      {item && (
        <Button variant="outline-danger" disabled={busy} onClick={removeItem}>Excluir despesa</Button>
      )}

      <div className="exm-actionbar">
        <Button type="submit" disabled={!valid || busy || preparing}>
          {busy ? <Spinner animation="border" size="sm" /> : item ? "Salvar despesa" : "Adicionar despesa"}
        </Button>
      </div>
    </Form>
  );
}
