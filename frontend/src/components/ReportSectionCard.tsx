import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form } from "react-bootstrap";
import RichTextEditor from "./RichTextEditor";
import SectionAiReviseModal from "./SectionAiReviseModal";
import { ReportSection, deleteSection, saveSection } from "../api/reportEditor";

function stripHtml(html: string | null): string {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export default function ReportSectionCard(props: {
  orderId: number;
  section: ReportSection;
  index: number;
  locked: boolean;
  onChanged: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onShowTags: () => void;
}) {
  const { orderId, section, index, locked, onChanged, onDirtyChange, onShowTags } = props;
  const [titleHtml, setTitleHtml] = useState(section.section_title_html || "");
  const [contentHtml, setContentHtml] = useState(section.content_html || "");
  const [isVisible, setIsVisible] = useState(section.is_visible !== false);
  const [err, setErr] = useState<string | null>(null);
  const [showRevise, setShowRevise] = useState(false);

  // Ressincroniza quando a seção muda (ex.: após reorder/invalidate).
  useEffect(() => {
    setTitleHtml(section.section_title_html || "");
    setContentHtml(section.content_html || "");
    setIsVisible(section.is_visible !== false);
    onDirtyChange?.(false);
  }, [section.section_key, section.section_title_html, section.content_html, section.is_visible]);

  useEffect(() => {
    onDirtyChange?.(
      titleHtml !== (section.section_title_html || "") ||
      contentHtml !== (section.content_html || "") ||
      isVisible !== (section.is_visible !== false)
    );
  }, [contentHtml, isVisible, onDirtyChange, section.content_html, section.is_visible, section.section_title_html, titleHtml]);

  const onError = (e: unknown) => setErr((e as Error).message);
  const mSave = useMutation({
    mutationFn: () => saveSection(orderId, section.section_key, {
      sectionTitleHtml: titleHtml,
      sectionTitleText: stripHtml(titleHtml),
      contentHtml,
      contentText: stripHtml(contentHtml),
      isVisible
    }),
    onSuccess: () => { setErr(null); onDirtyChange?.(false); onChanged(); },
    onError
  });
  const mDelete = useMutation({
    mutationFn: () => deleteSection(orderId, section.section_key),
    onSuccess: () => { onDirtyChange?.(false); onChanged(); },
    onError
  });

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <Badge bg="secondary">Capítulo {index + 1}</Badge>
          <code className="small">{section.section_key}</code>
        </div>
        <Form.Check
          type="switch"
          label="Exibir"
          checked={isVisible}
          disabled={locked}
          onChange={(e) => setIsVisible(e.target.checked)}
        />
      </Card.Header>
      <Card.Body>
        {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
        <Form.Label className="small text-muted mb-1">Título do capítulo</Form.Label>
        <RichTextEditor value={titleHtml} onChange={setTitleHtml} readOnly={locked} placeholder="Título do capítulo…" />
        <Form.Label className="small text-muted mb-1 mt-3">Conteúdo do capítulo</Form.Label>
        <RichTextEditor value={contentHtml} onChange={setContentHtml} readOnly={locked} placeholder="Conteúdo do capítulo…" />
      </Card.Body>
      {!locked && (
        <Card.Footer className="d-flex flex-wrap gap-2 justify-content-between">
          <div className="d-flex gap-2">
            <Button size="sm" variant="link" className="p-0 text-decoration-none" onClick={onShowTags}>Ver tags disponíveis</Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setShowRevise(true)}>Revisar com IA</Button>
          </div>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-primary" disabled={mSave.isPending} onClick={() => mSave.mutate()}>{mSave.isPending ? "Salvando…" : "Salvar capítulo"}</Button>
            <Button size="sm" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm("Excluir este capítulo?")) mDelete.mutate(); }}>Excluir</Button>
          </div>
        </Card.Footer>
      )}
      <SectionAiReviseModal
        show={showRevise}
        orderId={orderId}
        text={stripHtml(contentHtml)}
        html={contentHtml}
        onHide={() => setShowRevise(false)}
        onApplied={(revisedHtml) => setContentHtml(revisedHtml)}
      />
    </Card>
  );
}
