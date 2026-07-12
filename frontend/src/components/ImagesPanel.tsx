import { confirmDialog } from "./ConfirmDialog";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, Pagination, Table } from "react-bootstrap";
import IconAction from "./IconAction";
import {
  ReportImage,
  deleteImage,
  imageFileName,
  reportImageUrl,
  updateImageCaption,
  updateImageRotation,
  uploadReportImage
} from "../api/reportEditor";

interface PreviewState { imageId: number; src: string; caption: string; rotation: number }

const PAGE_SIZE = 20;
const MAX_IMAGE_SIZE = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// Números de página com reticências (janela ao redor da página atual).
function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

export default function ImagesPanel(props: { orderId: number; images: ReportImage[]; locked: boolean; onChanged: () => void }) {
  const { orderId, images, locked, onChanged } = props;
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [savingRotation, setSavingRotation] = useState(false);
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = images.map((img) => ({ ...img, refId: img.ref_id ?? img.id }));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstIndex = rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastIndex = (currentPage - 1) * PAGE_SIZE + pageRows.length;

  useEffect(() => {
    const map: Record<number, string> = {};
    rows.forEach((r) => { map[r.refId] = r.caption || ""; });
    setCaptions(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  const onError = (e: unknown) => setErr((e as Error).message);
  const mUpload = useMutation({
    mutationFn: () => uploadReportImage(orderId, file as File, caption),
    onSuccess: () => { setFile(null); setCaption(""); if (fileRef.current) fileRef.current.value = ""; onChanged(); },
    onError
  });
  const mCaption = useMutation({ mutationFn: (p: { imageId: number; caption: string }) => updateImageCaption(orderId, p.imageId, p.caption), onSuccess: onChanged, onError });
  const mDelete = useMutation({ mutationFn: (imageId: number) => deleteImage(orderId, imageId), onSuccess: onChanged, onError });

  const submitUpload = (ev: React.FormEvent) => {
    ev.preventDefault();
    setErr(null);
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) { setErr("Formato de imagem inválido."); return; }
    if (file.size > MAX_IMAGE_SIZE) { setErr("Imagem muito grande. Limite: 15 MB."); return; }
    mUpload.mutate();
  };

  const saveRotation = async () => {
    if (!preview) return;
    setSavingRotation(true);
    setErr(null);
    try {
      await updateImageRotation(orderId, preview.imageId, preview.rotation);
      setPreview(null);
      onChanged();
    } catch (e) {
      onError(e);
    } finally {
      setSavingRotation(false);
    }
  };

  return (
    <Card>
      <Card.Header>Banco de imagens para tags (@img=ID) <Badge bg="light" text="dark" className="ms-2">{rows.length}</Badge></Card.Header>
      <Card.Body>
        {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
        {!locked && (
          <Form onSubmit={submitUpload} className="row g-2 align-items-end border rounded p-3 bg-light mb-3">
            <div className="col-12 col-md-6">
              <Form.Label className="mb-1">Arquivo de imagem</Form.Label>
              <Form.Control ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" required onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
            </div>
            <div className="col-12 col-md-4">
              <Form.Label className="mb-1">Legenda (opcional)</Form.Label>
              <Form.Control value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Imagem importada" maxLength={200} />
            </div>
            <div className="col-12 col-md-2 d-grid">
              <Button type="submit" variant="outline-primary" disabled={mUpload.isPending || !file}>{mUpload.isPending ? "Importando…" : "Importar"}</Button>
            </div>
          </Form>
        )}
        <p className="text-muted small mb-0">Use no texto do capítulo <code>@img=ID</code> para renderizar a imagem no ponto da tag.</p>
      </Card.Body>
      <Table striped responsive hover className="mb-0 align-middle">
        <thead>
          <tr><th style={{ width: 60 }}>ID</th><th style={{ width: 70 }}>Preview</th><th>Arquivo</th><th>Legenda</th><th className="text-end">Ações</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={5} className="text-muted">Sem imagens cadastradas.</td></tr>}
          {pageRows.map((img) => {
            const src = reportImageUrl(img.file_path);
            const rotation = Number(img.rotation || 0);
            return (
              <tr key={img.refId}>
                <td><code>{img.refId}</code></td>
                <td>
                  <img
                    src={src}
                    alt={img.caption || ""}
                    title="Clique para ampliar"
                    onClick={() => setPreview({ imageId: img.refId, src, caption: img.caption || "", rotation })}
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, border: "1px solid #dee2e6", cursor: "pointer", transform: rotation ? `rotate(${rotation}deg)` : undefined }}
                  />
                </td>
                <td><code className="small" title={imageFileName(img.file_path)}>{imageFileName(img.file_path)}</code></td>
                <td>
                  <div className="d-flex gap-1 align-items-center">
                    <Form.Control size="sm" value={captions[img.refId] ?? ""} placeholder="Sem legenda" maxLength={200} disabled={locked} onChange={(e) => setCaptions((p) => ({ ...p, [img.refId]: e.target.value }))} />
                    {!locked && <Button size="sm" variant="outline-primary" disabled={mCaption.isPending} onClick={() => mCaption.mutate({ imageId: img.refId, caption: captions[img.refId] ?? "" })}>Salvar</Button>}
                  </div>
                </td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <Button size="sm" variant="outline-secondary" onClick={() => setPreview({ imageId: img.refId, src, caption: img.caption || "", rotation })}>Ver</Button>
                    {!locked && <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog("Excluir esta imagem do banco de tags?")) mDelete.mutate(img.refId); }} />}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Card.Footer className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <span className="text-muted small">
          {rows.length > 0 ? `Mostrando ${firstIndex}–${lastIndex} de ${rows.length} imagem(ns)` : "Nenhuma imagem"}
        </span>
        {totalPages > 1 && (
          <Pagination size="sm" className="mb-0">
            <Pagination.Prev disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} />
            {pageWindow(currentPage, totalPages).map((p, i) =>
              p === "…" ? (
                <Pagination.Ellipsis key={`e${i}`} disabled />
              ) : (
                <Pagination.Item key={p} active={p === currentPage} onClick={() => setPage(p)}>{p}</Pagination.Item>
              )
            )}
            <Pagination.Next disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} />
          </Pagination>
        )}
      </Card.Footer>

      <Modal show={!!preview} onHide={() => setPreview(null)} centered size="lg">
        <Modal.Header closeButton><Modal.Title className="h6 mb-0">{preview?.caption || "Preview da imagem"}</Modal.Title></Modal.Header>
        <Modal.Body className="text-center" style={{ overflow: "hidden" }}>
          {preview && (
            <img
              src={preview.src}
              alt={preview.caption}
              style={{ maxWidth: "100%", maxHeight: "60vh", transform: `rotate(${preview.rotation}deg)`, transition: "transform .2s" }}
            />
          )}
        </Modal.Body>
        {preview && !locked && (
          <Modal.Footer className="justify-content-between">
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary" onClick={() => setPreview((p) => p && ({ ...p, rotation: (p.rotation - 90 + 360) % 360 }))}>⟲ Girar</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setPreview((p) => p && ({ ...p, rotation: (p.rotation + 90) % 360 }))}>⟳ Girar</Button>
            </div>
            <Button size="sm" disabled={savingRotation} onClick={saveRotation}>{savingRotation ? "Salvando…" : "Salvar rotação"}</Button>
          </Modal.Footer>
        )}
      </Modal>
    </Card>
  );
}
