import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Alert, Button, Card, Form, Spinner, Tab, Tabs } from "react-bootstrap";
import ReportSectionCard from "../components/ReportSectionCard";
import ReportTagsModal from "../components/ReportTagsModal";
import ReorderSectionsModal from "../components/ReorderSectionsModal";
import ImagesPanel from "../components/ImagesPanel";
import ReportPreviewPanel from "../components/ReportPreviewPanel";
import SignRequestsPanel from "../components/SignRequestsPanel";
import TranslationPanel from "../components/TranslationPanel";
import { createSection, getReportEditor } from "../api/reportEditor";

export default function ReportEditorPage() {
  const orderId = Number(useParams().id);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["report-editor", orderId], queryFn: () => getReportEditor(orderId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["report-editor", orderId] });

  const [newTitle, setNewTitle] = useState("");
  const [insertAfter, setInsertAfter] = useState("end");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasUnsavedChapter, setHasUnsavedChapter] = useState(false);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sections = data?.sections ?? [];
  const active = sections.length ? Math.min(activeIndex, sections.length - 1) : 0;
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mCreate = useMutation({
    mutationFn: () => createSection(orderId, { sectionTitle: newTitle, insertAfter }),
    onSuccess: () => {
      const currentIndex = sections.findIndex((s) => s.section_key === insertAfter);
      const nextIndex = insertAfter === "start" ? 0 : insertAfter === "end" ? sections.length : Math.max(currentIndex + 1, sections.length);
      setNewTitle("");
      setInsertAfter("end");
      setSlideDir("next");
      setActiveIndex(nextIndex);
      setHasUnsavedChapter(false);
      invalidate();
    },
    onError
  });

  useEffect(() => {
    setActiveIndex((current) => {
      if (!sections.length) return 0;
      return Math.min(current, sections.length - 1);
    });
  }, [sections.length]);

  const goToChapter = (index: number): boolean => {
    if (index < 0 || index >= sections.length || index === active) return false;
    if (hasUnsavedChapter && !window.confirm("Há alterações não salvas neste capítulo. Trocar de capítulo mesmo assim?")) {
      return false;
    }
    setActionError(null);
    setHasUnsavedChapter(false);
    setSlideDir(index > active ? "next" : "prev");
    setActiveIndex(index);
    return true;
  };

  // Mantém a miniatura do capítulo ativo visível na trilha ao navegar por botões/dropdown/teclado.
  useEffect(() => {
    itemRefs.current[active]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [active]);

  const onTrackKeyDown = (ev: React.KeyboardEvent<HTMLDivElement>) => {
    let target = -1;
    if (ev.key === "ArrowRight" || ev.key === "ArrowDown") target = active + 1;
    else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") target = active - 1;
    else if (ev.key === "Home") target = 0;
    else if (ev.key === "End") target = sections.length - 1;
    else return;
    ev.preventDefault();
    if (goToChapter(target)) requestAnimationFrame(() => itemRefs.current[target]?.focus());
  };

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error || !data) {
    return <Alert variant="danger">Falha ao carregar o relatório: {(error as Error)?.message}</Alert>;
  }

  const { order, images, locked, reportTemplates, templateKey, signRequests, signRequestGuard, reportLanguages, reportLanguage } = data;
  const osLabel = order.service_order_display || order.service_order_code || order.os_number || `#${order.id}`;

  const submitNew = (ev: React.FormEvent) => { ev.preventDefault(); setActionError(null); mCreate.mutate(); };

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Relatório · OS {osLabel} <Link to={`/orders/${orderId}/editor`} className="ms-2 small">← Editor da OS</Link></span>
          <a className="btn btn-sm btn-outline-primary" href={`/admin/report-service/orders/${order.id}/report-editor`}>Editor de relatório (legado)</a>
        </Card.Header>
        {locked && <Card.Body><Alert variant="warning" className="mb-0">OS aprovada — somente leitura.</Alert></Card.Body>}
      </Card>

      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <Tabs defaultActiveKey="capitulos" id="report-editor-tabs" className="mb-3" mountOnEnter>
        <Tab eventKey="capitulos" title="Capítulos">
          {!locked && (
            <Card className="mb-3">
              <Card.Header>Adicionar capítulo</Card.Header>
              <Card.Body>
                <Form onSubmit={submitNew} className="row g-2 align-items-end">
                  <div className="col-12 col-md-5">
                    <Form.Label>Título do novo capítulo</Form.Label>
                    <Form.Control required value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título do novo capítulo" />
                  </div>
                  <div className="col-12 col-md-5">
                    <Form.Label>Posição</Form.Label>
                    <Form.Select value={insertAfter} onChange={(e) => setInsertAfter(e.target.value)}>
                      <option value="end">Inserir no final</option>
                      <option value="start">Inserir no início</option>
                      {sections.map((s, idx) => (
                        <option key={s.section_key} value={s.section_key}>Após: {idx + 1}. {s.section_title_text || s.section_key}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-12 col-md-2 d-grid">
                    <Button type="submit" disabled={mCreate.isPending || !newTitle.trim()}>{mCreate.isPending ? "Adicionando…" : "Adicionar"}</Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          )}

          {!locked && sections.length > 0 && (
            <div className="d-flex justify-content-end mb-3">
              <Button size="sm" variant="outline-secondary" onClick={() => setShowReorder(true)}>Reordenar / editar capítulos</Button>
            </div>
          )}

          {sections.length === 0 && <p className="text-muted">Nenhum capítulo cadastrado.</p>}
          {sections.length > 0 && (() => {
            const section = sections[active];
            const defaultModelHtml = section.section_key === "scope"
              ? data.defaultChapterModels?.scope
              : section.section_key === "recommendations"
                ? data.defaultChapterModels?.recommendations
                : undefined;
            return (
              <>
                <Card className="vx-chapter-carousel mb-3">
                  <Card.Body className="py-3">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <Button size="sm" variant="outline-secondary" disabled={active === 0} onClick={() => goToChapter(active - 1)}>‹ Anterior</Button>
                      <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 220 }}>
                        <span className="text-muted small text-nowrap">Capítulo {active + 1} de {sections.length}</span>
                        <Form.Select size="sm" value={active} onChange={(e) => goToChapter(Number(e.target.value))}>
                          {sections.map((s, i) => (
                            <option key={s.section_key} value={i}>{i + 1}. {s.section_title_text || s.section_key}</option>
                          ))}
                        </Form.Select>
                      </div>
                      <Button size="sm" variant="outline-secondary" disabled={active === sections.length - 1} onClick={() => goToChapter(active + 1)}>Próximo ›</Button>
                    </div>
                    <div className="vx-chapter-carousel__track mt-3" role="tablist" aria-label="Capítulos do relatório" onKeyDown={onTrackKeyDown}>
                      {sections.map((s, i) => (
                        <button
                          key={s.section_key}
                          ref={(el) => { itemRefs.current[i] = el; }}
                          type="button"
                          className={`vx-chapter-carousel__item${i === active ? " is-active" : ""}`}
                          onClick={() => goToChapter(i)}
                          role="tab"
                          aria-selected={i === active}
                          tabIndex={i === active ? 0 : -1}
                        >
                          <span className="vx-chapter-carousel__index">{i + 1}</span>
                          <span className="vx-chapter-carousel__title">{s.section_title_text || s.section_key}</span>
                          {s.is_visible === false && <span className="vx-chapter-carousel__hidden">Oculto</span>}
                        </button>
                      ))}
                    </div>
                  </Card.Body>
                </Card>
                {hasUnsavedChapter && <div className="text-warning small mb-2">Este capítulo tem alterações não salvas.</div>}
                <div className="vx-chapter-stage">
                  <div key={section.section_key} className={`vx-chapter-slide${slideDir ? ` vx-chapter-slide--${slideDir}` : ""}`}>
                    <ReportSectionCard
                      orderId={orderId}
                      section={section}
                      index={active}
                      locked={locked}
                      defaultModelHtml={defaultModelHtml}
                      onChanged={invalidate}
                      onDirtyChange={setHasUnsavedChapter}
                      onShowTags={() => setShowTags(true)}
                    />
                  </div>
                </div>
              </>
            );
          })()}
        </Tab>

        <Tab eventKey="imagens" title="Imagens">
          <ImagesPanel orderId={orderId} images={images} locked={locked} onChanged={invalidate} />
        </Tab>
        <Tab eventKey="assinaturas" title="Assinaturas">
          <SignRequestsPanel orderId={orderId} signRequests={signRequests} guard={signRequestGuard} locked={locked} onChanged={invalidate} />
        </Tab>
        <Tab eventKey="preview" title="Preview / PDF">
          <ReportPreviewPanel orderId={orderId} templates={reportTemplates} defaultTemplateKey={templateKey} />
        </Tab>
        <Tab eventKey="traducao" title="Tradução">
          <TranslationPanel orderId={orderId} languages={reportLanguages} currentLanguage={reportLanguage} locked={locked} onTranslated={invalidate} />
        </Tab>
      </Tabs>

      <ReportTagsModal show={showTags} onHide={() => setShowTags(false)} />
      <ReorderSectionsModal show={showReorder} orderId={orderId} sections={sections} onHide={() => setShowReorder(false)} onSaved={invalidate} />
    </div>
  );
}
