import { confirmDialog } from "./ConfirmDialog";
import { useCallback, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form } from "react-bootstrap";
import RichTextEditor, { QuillDelta } from "./RichTextEditor";
import SectionAiReviseModal from "./SectionAiReviseModal";
import { ReportSection, deleteSection, saveSection, uploadReportImage, reportImageUrl } from "../api/reportEditor";
import { trustedInitialDelta } from "../utils/quillDeltaTrust";

function stripHtml(html: string | null): string {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export default function ReportSectionCard(props: {
  orderId: number;
  section: ReportSection;
  index: number;
  locked: boolean;
  defaultModelHtml?: string;
  onChanged: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onShowTags: () => void;
}) {
  const { orderId, section, index, locked, defaultModelHtml, onChanged, onDirtyChange, onShowTags } = props;
  const [titleHtml, setTitleHtml] = useState(section.section_title_html || "");
  const [contentHtml, setContentHtml] = useState(section.content_html || "");
  // Delta do Quill: fonte de verdade para o editor (igual ao legado), quando
  // confiável (ver trustedInitialDelta — capítulos salvos antes desta versão
  // podem ter um Delta "degradado" sem formatação/imagens, mesmo com HTML
  // completo). Nulo também logo após a IA revisar o conteúdo (que só devolve
  // HTML) — nesses casos o RichTextEditor recebe o HTML diretamente até o
  // próximo edit, que volta a gerar um Delta correto.
  const [titleDelta, setTitleDelta] = useState<QuillDelta | null>(
    trustedInitialDelta(section.section_title_delta_json, section.section_title_html)
  );
  const [contentDelta, setContentDelta] = useState<QuillDelta | null>(
    trustedInitialDelta(section.content_delta_json, section.content_html)
  );
  const [isVisible, setIsVisible] = useState(section.is_visible !== false);
  const [err, setErr] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<{ variant: "success" | "warning"; message: string } | null>(null);
  const [showRevise, setShowRevise] = useState(false);

  // Ressincroniza quando a seção muda (ex.: após reorder/invalidate). O Delta
  // acompanha o HTML nessas mesmas dependências — eles sempre mudam juntos a
  // cada save real, então não precisa entrar no array de deps (evitaria a
  // dedução por igualdade de string do content_html, já que objetos vindos de
  // um novo fetch nunca são ===, mesmo com o mesmo conteúdo).
  useEffect(() => {
    setTitleHtml(section.section_title_html || "");
    setContentHtml(section.content_html || "");
    setTitleDelta(trustedInitialDelta(section.section_title_delta_json, section.section_title_html));
    setContentDelta(trustedInitialDelta(section.content_delta_json, section.content_html));
    setIsVisible(section.is_visible !== false);
    setModelStatus(null);
    onDirtyChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.section_key, section.section_title_html, section.content_html, section.is_visible]);

  useEffect(() => {
    onDirtyChange?.(
      titleHtml !== (section.section_title_html || "") ||
      contentHtml !== (section.content_html || "") ||
      isVisible !== (section.is_visible !== false)
    );
  }, [contentHtml, isVisible, onDirtyChange, section.content_html, section.is_visible, section.section_title_html, titleHtml]);

  const onError = (e: unknown) => setErr((e as Error).message);
  const canLoadDefaultModel = section.section_key === "scope" || section.section_key === "recommendations";
  const loadDefaultModel = () => {
    const modelHtml = String(defaultModelHtml || "").trim();
    if (!modelHtml) {
      setModelStatus({ variant: "warning", message: "Modelo padrão vazio para este capítulo." });
      return;
    }
    setErr(null);
    setContentHtml(modelHtml);
    setContentDelta(null);
    setModelStatus({ variant: "success", message: "Modelo padrão carregado no conteúdo do capítulo." });
  };
  // Botão "Imagem" do RichTextEditor: faz upload pelo mesmo endpoint do banco
  // de imagens (@img) e devolve a URL estável /docs/report/img/<arquivo>,
  // igual ao que o editor legado insere via insertEmbed. Sem isto, colar uma
  // imagem no Quill gera uma URL blob:/file: que o sanitizador do backend
  // remove ao salvar, deixando o <img> sem src — quebrado inclusive no PDF.
  //
  // useCallback é obrigatório aqui: o RichTextEditor usa esta função como
  // dependência do useMemo que monta `modules` (toolbar). Uma closure nova a
  // cada render faz `modules` mudar de referência a cada render, e o
  // react-quill-new destroi e recria o editor inteiro sempre que `modules`
  // muda (ver shouldComponentRegenerate/componentDidUpdate) — a cada tecla
  // digitada isso reinicia o editor em loop, disparando "Maximum update
  // depth exceeded" (React error #185) e deixando a página em branco.
  const handleContentImageUpload = useCallback(async (file: File): Promise<string> => {
    const resp = await uploadReportImage(orderId, file, "");
    if (!resp.ok || !resp.data) throw new Error(resp.error || "Falha ao enviar imagem.");
    return reportImageUrl(resp.data.filePath);
  }, [orderId]);
  const mSave = useMutation({
    mutationFn: () => saveSection(orderId, section.section_key, {
      sectionTitleHtml: titleHtml,
      sectionTitleText: stripHtml(titleHtml),
      sectionTitleDeltaJson: titleDelta || undefined,
      contentHtml,
      contentText: stripHtml(contentHtml),
      contentDeltaJson: contentDelta || undefined,
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
        {modelStatus && <Alert variant={modelStatus.variant} dismissible onClose={() => setModelStatus(null)}>{modelStatus.message}</Alert>}
        <Form.Label className="small text-muted mb-1">Título do capítulo</Form.Label>
        <RichTextEditor
          className="report-quill-title-editor"
          value={titleDelta || titleHtml}
          onChange={(html, delta) => { setTitleHtml(html); setTitleDelta(delta); }}
          readOnly={locked}
          placeholder="Título do capítulo…"
        />
        <Form.Label className="small text-muted mb-1 mt-3">Conteúdo do capítulo</Form.Label>
        <RichTextEditor
          className="report-quill-editor"
          value={contentDelta || contentHtml}
          onChange={(html, delta) => { setContentHtml(html); setContentDelta(delta); }}
          readOnly={locked}
          placeholder="Conteúdo do capítulo…"
          onImageUpload={handleContentImageUpload}
        />
      </Card.Body>
      {!locked && (
        <Card.Footer className="d-flex flex-wrap gap-2 justify-content-between">
          <div className="d-flex gap-2">
            {canLoadDefaultModel && <Button size="sm" variant="outline-secondary" onClick={loadDefaultModel}>Carregar modelo</Button>}
            <Button size="sm" variant="link" className="p-0 text-decoration-none" onClick={onShowTags}>Ver tags disponíveis</Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setShowRevise(true)}>Revisar com IA</Button>
          </div>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-primary" disabled={mSave.isPending} onClick={() => mSave.mutate()}>{mSave.isPending ? "Salvando…" : "Salvar capítulo"}</Button>
            <Button size="sm" variant="outline-danger" disabled={mDelete.isPending} onClick={async () => { if (await confirmDialog("Excluir este capítulo?")) mDelete.mutate(); }}>Excluir</Button>
          </div>
        </Card.Footer>
      )}
      <SectionAiReviseModal
        show={showRevise}
        orderId={orderId}
        text={stripHtml(contentHtml)}
        html={contentHtml}
        onHide={() => setShowRevise(false)}
        onApplied={(revisedHtml) => { setContentHtml(revisedHtml); setContentDelta(null); }}
      />
    </Card>
  );
}
