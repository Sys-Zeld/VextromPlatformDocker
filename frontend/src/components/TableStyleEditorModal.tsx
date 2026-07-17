import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import { confirmDialog } from "./ConfirmDialog";
import {
  resetTableStylePreview,
  TableStyleConfig,
  TableStyleType,
  updateTableStyle
} from "../api/tableStyles";

type Bubble = { type: "ai" | "user" | "error"; text: string };

const SUGGESTIONS = [
  { label: "Cabeçalho verde", value: "Cabeçalho verde escuro, texto branco" },
  { label: "Cabeçalho azul", value: "Cabeçalho azul marinho, texto branco" },
  { label: "Fonte maior", value: "Aumentar fonte das células para 12px" },
  { label: "Sem zebra", value: "Remover o fundo alternado nas linhas, deixar todas brancas" },
  { label: "Borda grossa", value: "Borda preta mais grossa 2px sólida" }
];

function previewDocument(fragment: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 18px; color: #17201c; background: #fff; font-family: Inter, "Segoe UI", sans-serif; }
    body > div { width: 100%; }
    table { width: 100%; max-width: 100%; border-collapse: collapse; color: #17201c; background: #fff; font-size: 12px; }
    caption { padding: 9px 12px; color: #fff; background: #1f2937; font-size: 13px; font-weight: 700; text-align: left; caption-side: top; }
    th, td { padding: 7px 9px; border: 1px solid #cbd5e1; vertical-align: middle; }
    thead th { color: #fff; background: #334155; font-size: 11px; font-weight: 700; text-align: center; }
    tbody tr:nth-child(even) td { background: #f1f5f9; }
  </style>
</head>
<body>${fragment || ""}</body>
</html>`;
}

export default function TableStyleEditorModal(props: {
  table: TableStyleType | null;
  onHide: () => void;
  onSaved: () => void;
}) {
  const { table, onHide, onSaved } = props;
  const [previewHtml, setPreviewHtml] = useState("");
  const [pendingStyle, setPendingStyle] = useState<TableStyleConfig | null>(null);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const srcDoc = useMemo(() => previewDocument(previewHtml), [previewHtml]);

  const addMessage = (message: Bubble) => setMessages((current) => [...current, message]);

  useEffect(() => {
    if (!table) return;
    setPreviewHtml("");
    setPendingStyle(null);
    setMessages([]);
    setInput("");
    setUnsaved(false);
    setLoading(true);
    updateTableStyle(table.key)
      .then((result) => {
        setPreviewHtml(result.previewHtml);
        setPendingStyle(result.styleConfig);
        setMessages([{
          type: "ai",
          text: "Descreva o visual desejado. Você pode ajustar cores, fontes, bordas, espaçamento e alinhamento em várias etapas antes de salvar."
        }]);
      })
      .catch((error) => {
        setMessages([{ type: "error", text: `Erro ao carregar o preview: ${(error as Error).message}` }]);
      })
      .finally(() => setLoading(false));
  }, [table]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, busy]);

  const sendInstruction = () => {
    if (!table || busy || loading) return;
    const instruction = input.trim();
    if (!instruction) return;
    addMessage({ type: "user", text: instruction });
    setInput("");
    setBusy(true);
    updateTableStyle(table.key, { instruction, currentStyle: pendingStyle })
      .then((result) => {
        setPreviewHtml(result.previewHtml);
        setPendingStyle(result.styleConfig);
        setUnsaved(true);
        addMessage({ type: "ai", text: "Ajuste aplicado ao preview. Continue refinando ou salve o visual quando estiver satisfeito." });
      })
      .catch((error) => addMessage({ type: "error", text: `Falha na IA: ${(error as Error).message}` }))
      .finally(() => setBusy(false));
  };

  const save = () => {
    if (!table || !pendingStyle || busy) return;
    setBusy(true);
    updateTableStyle(table.key, { currentStyle: pendingStyle, apply: true })
      .then(() => {
        setUnsaved(false);
        onSaved();
        onHide();
      })
      .catch((error) => addMessage({ type: "error", text: `Erro ao salvar: ${(error as Error).message}` }))
      .finally(() => setBusy(false));
  };

  const reset = async () => {
    if (!table || busy) return;
    if (!await confirmDialog(`Restaurar o estilo padrão de "${table.label}"?`)) return;
    setBusy(true);
    resetTableStylePreview(table.key)
      .then((result) => {
        setPreviewHtml(result.previewHtml);
        setPendingStyle(result.styleConfig);
        setUnsaved(false);
        onSaved();
        setMessages([{ type: "ai", text: "Visual padrão do sistema restaurado. Você pode iniciar uma nova personalização." }]);
      })
      .catch((error) => addMessage({ type: "error", text: `Erro ao restaurar: ${(error as Error).message}` }))
      .finally(() => setBusy(false));
  };

  return (
    <Modal show={Boolean(table)} onHide={onHide} size="xl" scrollable centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6 mb-0">
          Customizar visual — {table?.label || "Tabela"}
          {unsaved && <Badge bg="warning" text="dark" className="ms-2">não salvo</Badge>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        <div className="row g-0 table-style-editor">
          <div className="col-lg-8 table-style-editor__preview position-relative">
            {loading && (
              <div className="table-style-editor__overlay">
                <Spinner animation="border" size="sm" />
                <span>Gerando preview...</span>
              </div>
            )}
            <div className="table-style-editor__preview-label">Visualização do relatório</div>
            <iframe
              key={`${table?.key || "table"}-${previewHtml.length}`}
              title={`Preview da tabela ${table?.label || ""}`}
              srcDoc={srcDoc}
              sandbox=""
              referrerPolicy="no-referrer"
              className="table-style-editor__frame"
            />
          </div>

          <div className="col-lg-4 table-style-editor__assistant">
            <div className="table-style-editor__assistant-title">Assistente de design IA</div>
            <div ref={chatRef} className="table-style-editor__chat">
              {messages.map((message, index) => (
                <div
                  key={`${message.type}-${index}`}
                  className={`table-style-editor__bubble table-style-editor__bubble--${message.type}`}
                >
                  {message.text}
                </div>
              ))}
              {busy && (
                <div className="table-style-editor__bubble table-style-editor__bubble--ai">
                  <Spinner animation="border" size="sm" /> Aplicando...
                </div>
              )}
            </div>
            <div className="table-style-editor__suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion.value}
                  type="button"
                  disabled={busy || loading}
                  onClick={() => setInput(suggestion.value)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
            <div className="table-style-editor__input">
              <Form.Control
                as="textarea"
                rows={2}
                value={input}
                disabled={busy || loading}
                placeholder="Descreva a alteração desejada..."
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendInstruction();
                  }
                }}
              />
              <Button size="sm" disabled={busy || loading || !input.trim()} onClick={sendInstruction}>
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="justify-content-between">
        <Button variant="outline-danger" size="sm" disabled={busy || loading} onClick={reset}>
          Restaurar padrão
        </Button>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" disabled={busy} onClick={onHide}>Fechar</Button>
          <Button variant="success" size="sm" disabled={busy || loading || !pendingStyle || !unsaved} onClick={save}>
            Salvar visual
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
