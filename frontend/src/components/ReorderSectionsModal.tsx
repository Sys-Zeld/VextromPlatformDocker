import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import {
  ReportSection,
  TableNameChange,
  TocSection,
  getTocTables,
  renameTocTables,
  reorderSections,
  saveSection
} from "../api/reportEditor";

const TYPE_LABELS: Record<string, string> = {
  measurements: "Ensaios/Medições",
  discharge: "Descarga",
  components: "Componentes",
  timesheet: "Time Sheet",
  techteam: "Equipe Técnica",
  equipments: "Equipamentos",
  other: "Tabela"
};

function stripHtml(html: string | null): string {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export default function ReorderSectionsModal(props: {
  show: boolean;
  orderId: number;
  sections: ReportSection[];
  onHide: () => void;
  onSaved: () => void;
}) {
  const { show, orderId, sections, onHide, onSaved } = props;
  const [order, setOrder] = useState<string[]>([]); // section keys na ordem atual
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [toc, setToc] = useState<TocSection[]>([]);
  const [loadingToc, setLoadingToc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const originalTitles = useRef<Record<string, string>>({});
  const originalTableTitles = useRef<Record<string, string>>({});
  const sectionByKey = useRef<Record<string, ReportSection>>({});
  const dragIndex = useRef<number | null>(null);

  useEffect(() => {
    if (!show) return;
    setErr(null);
    const t: Record<string, string> = {};
    const byKey: Record<string, ReportSection> = {};
    sections.forEach((s) => { t[s.section_key] = s.section_title_text || ""; byKey[s.section_key] = s; });
    setTitles(t);
    setOrder(sections.map((s) => s.section_key));
    originalTitles.current = { ...t };
    sectionByKey.current = byKey;
    setToc([]);
    setLoadingToc(true);
    getTocTables(orderId)
      .then((r) => {
        const secs = r.sections || [];
        setToc(secs);
        const map: Record<string, string> = {};
        secs.forEach((sec) => sec.tables.forEach((tbl) => {
          if ((tbl.tableType === "measurements" || tbl.tableType === "discharge") && tbl.itemId) {
            map[`${tbl.tableType}:${tbl.itemId}`] = String(tbl.title || tbl.label || "");
          }
        }));
        originalTableTitles.current = map;
      })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoadingToc(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, orderId]);

  const tablesFor = (sectionKey: string) => toc.find((s) => s.sectionKey === sectionKey)?.tables ?? [];

  const updateTable = (sectionKey: string, anchorId: string, patch: Partial<{ visible: boolean; title: string }>) => {
    setToc((prev) => prev.map((sec) => sec.sectionKey !== sectionKey ? sec : {
      ...sec,
      tables: sec.tables.map((t) => t.anchorId === anchorId ? { ...t, ...patch } : t)
    }));
  };

  const onDragStart = (index: number) => { dragIndex.current = index; };
  const onDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === index) return;
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    dragIndex.current = index;
  };
  const onDragEnd = () => { dragIndex.current = null; };

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      // 1) Renomear capítulos alterados (preservando o conteúdo existente).
      const changedChapters = order.filter((key) => (titles[key] || "").trim() !== (originalTitles.current[key] || "").trim());
      await Promise.all(changedChapters.map((key) => {
        const orig = sectionByKey.current[key];
        return saveSection(orderId, key, {
          sectionTitleHtml: "",
          sectionTitleText: (titles[key] || "").trim(),
          contentHtml: orig?.content_html || "",
          contentText: orig?.content_text ?? stripHtml(orig?.content_html || ""),
          isVisible: orig?.is_visible !== false
        });
      }));

      // 2) Renomear tabelas (measurements/discharge) alteradas.
      const changedTables: TableNameChange[] = [];
      const tocTablesConfig: Record<string, boolean> = {};
      toc.forEach((sec) => sec.tables.forEach((t) => {
        if (t.configKey) tocTablesConfig[t.configKey] = t.visible;
        if ((t.tableType === "measurements" || t.tableType === "discharge") && t.itemId) {
          const orig = (originalTableTitles.current[`${t.tableType}:${t.itemId}`] || "").trim();
          const cur = (t.title || "").trim();
          if (cur !== orig) changedTables.push({ type: t.tableType, id: t.itemId, title: cur });
        }
      }));
      if (changedTables.length) await renameTocTables(orderId, changedTables);

      // 3) Salvar ordem + visibilidade das tabelas no sumário.
      await reorderSections(orderId, order, tocTablesConfig);

      onSaved();
      onHide();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" scrollable>
      <Modal.Header closeButton><Modal.Title className="h6 mb-0">Reordenar e editar capítulos</Modal.Title></Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-2">Arraste pela alça (☰) para reordenar. Edite o título do capítulo e os nomes das tabelas. Marque as tabelas que devem aparecer no sumário.</p>
        {err && <Alert variant="danger" dismissible onClose={() => setErr(null)}>{err}</Alert>}
        {loadingToc && <div className="text-muted small mb-2"><Spinner animation="border" size="sm" /> Carregando tabelas…</div>}
        <ul className="list-group list-group-flush">
          {order.map((key, index) => {
            const tables = tablesFor(key);
            return (
              <li key={key} className="list-group-item" onDragOver={onDragOver(index)}>
                <div className="d-flex align-items-center gap-2">
                  <span
                    className="text-muted"
                    title="Arrastar"
                    draggable
                    onDragStart={() => onDragStart(index)}
                    onDragEnd={onDragEnd}
                    style={{ cursor: "grab", userSelect: "none" }}
                  >&#9776;</span>
                  <Badge bg="secondary">{index + 1}</Badge>
                  <Form.Control
                    size="sm"
                    className="flex-grow-1"
                    value={titles[key] ?? ""}
                    placeholder="Título do capítulo"
                    onChange={(e) => setTitles((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                  <code className="small text-muted">{key}</code>
                </div>
                {tables.length > 0 && (
                  <ul className="list-unstyled mb-0 mt-1 ms-4 ps-1">
                    {tables.map((t) => {
                      const editable = (t.tableType === "measurements" || t.tableType === "discharge") && t.itemId;
                      return (
                        <li key={t.anchorId} className="d-flex align-items-center gap-2 py-1">
                          <Form.Check
                            type="checkbox"
                            checked={t.visible}
                            onChange={(e) => updateTable(key, t.anchorId, { visible: e.target.checked })}
                          />
                          {editable ? (
                            <Form.Control
                              size="sm"
                              value={t.title || ""}
                              placeholder="Nome da tabela"
                              style={{ flex: 1, fontSize: "0.78rem", height: 26 }}
                              onChange={(e) => updateTable(key, t.anchorId, { title: e.target.value })}
                            />
                          ) : (
                            <label className="small text-muted mb-0 flex-grow-1">{t.title || t.label}</label>
                          )}
                          <Badge bg="light" text="secondary" className="border" style={{ fontSize: "0.65rem", whiteSpace: "nowrap" }}>
                            {TYPE_LABELS[t.tableType] || t.tableType}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" size="sm" onClick={onHide}>Cancelar</Button>
        <Button size="sm" disabled={saving || loadingToc} onClick={save}>{saving ? "Salvando…" : "Salvar alterações"}</Button>
      </Modal.Footer>
    </Modal>
  );
}
