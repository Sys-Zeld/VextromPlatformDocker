import { useEffect, useRef, useState } from "react";
import { Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import {
  ComponentsStyleConfig,
  componentsStyleAi,
  componentsStyleDefault,
  componentsStyleReset
} from "../api/orderEditor";

type Bubble = { type: "ai" | "user" | "err"; text: string };

const CHIPS = [
  { label: "Cabeçalho verde", value: "Cabeçalho verde escuro, texto branco" },
  { label: "Cabeçalho azul", value: "Cabeçalho azul marinho, texto branco" },
  { label: "Fonte maior", value: "Aumentar fonte para 12px" },
  { label: "Bordas finas", value: "Bordas mais finas, cor cinza claro" },
  { label: "Linhas alternadas", value: "Linha de dados alternada em azul muito claro" }
];

export default function ComponentsStyleModal(props: {
  show: boolean;
  orderId: number;
  onHide: () => void;
  onSaved: () => void;
}) {
  const { show, orderId, onHide, onSaved } = props;
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [pendingStyle, setPendingStyle] = useState<ComponentsStyleConfig | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false); // overlay inicial
  const [busy, setBusy] = useState(false); // send/reset/default/save em andamento
  const [unsaved, setUnsaved] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const addBubble = (b: Bubble) => setMessages((m) => [...m, b]);

  useEffect(() => {
    if (!show) return;
    // Reset e carga inicial do preview ao abrir.
    setMessages([]);
    setInput("");
    setPendingStyle(null);
    setUnsaved(false);
    setPreviewHtml("");
    setLoading(true);
    componentsStyleAi(orderId, {})
      .then((r) => {
        setPreviewHtml(r.previewHtml);
        setPendingStyle(r.styleConfig);
        addBubble({ type: "ai", text: "Olá! Descreva o que deseja alterar na tabela de componentes: cores, fontes, bordas, tamanhos ou alinhamento. Use os atalhos abaixo ou escreva livremente." });
      })
      .catch(() => setPreviewHtml(`<p style="color:#dc2626;font-size:12px;">Erro ao carregar preview.</p>`))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, orderId]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    const instruction = input.trim();
    if (!instruction || busy) return;
    addBubble({ type: "user", text: instruction });
    setInput("");
    setBusy(true);
    componentsStyleAi(orderId, { instruction, currentStyle: pendingStyle })
      .then((r) => {
        setPreviewHtml(r.previewHtml);
        setPendingStyle(r.styleConfig);
        setUnsaved(true);
        addBubble({ type: "ai", text: "Feito! Verifique o preview ao lado. Você pode continuar ajustando ou salvar." });
      })
      .catch((e) => addBubble({ type: "err", text: `Erro: ${(e as Error).message}` }))
      .finally(() => setBusy(false));
  };

  const save = () => {
    if (!pendingStyle) return;
    setBusy(true);
    componentsStyleAi(orderId, { apply: true, currentStyle: pendingStyle })
      .then(() => { setUnsaved(false); onSaved(); onHide(); })
      .catch((e) => addBubble({ type: "err", text: `Erro ao salvar: ${(e as Error).message}` }))
      .finally(() => setBusy(false));
  };

  const saveDefault = () => {
    if (!pendingStyle) return;
    setBusy(true);
    componentsStyleDefault(orderId, pendingStyle)
      .then((r) => {
        setPreviewHtml(r.previewHtml);
        setPendingStyle(r.styleConfig ?? pendingStyle);
        setUnsaved(false);
        onSaved();
        addBubble({ type: "ai", text: "Estilo salvo como padrão e aplicado a esta OS." });
      })
      .catch((e) => addBubble({ type: "err", text: `Erro: ${(e as Error).message}` }))
      .finally(() => setBusy(false));
  };

  const reset = () => {
    setBusy(true);
    componentsStyleReset(orderId)
      .then((r) => {
        setPreviewHtml(r.previewHtml);
        setPendingStyle(r.styleConfig);
        setUnsaved(false);
        onSaved();
        addBubble({ type: "ai", text: "Estilo restaurado ao padrão." });
      })
      .catch((e) => addBubble({ type: "err", text: `Erro ao restaurar: ${(e as Error).message}` }))
      .finally(() => setBusy(false));
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="h6 mb-0">
          Customizar Visual — Componentes
          {unsaved && <Badge bg="warning" text="dark" className="ms-2">não salvo</Badge>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-0">
        <div className="row g-0" style={{ minHeight: 420 }}>
          {/* Preview */}
          <div className="col-lg-7 border-end position-relative" style={{ background: "#f8fafc", padding: 16, overflowY: "auto", maxHeight: 520 }}>
            {loading && (
              <div className="d-flex align-items-center justify-content-center text-muted" style={{ position: "absolute", inset: 0, background: "rgba(248,250,252,.8)", zIndex: 2 }}>
                <Spinner animation="border" size="sm" className="me-2" /> Gerando preview…
              </div>
            )}
            <iframe
              title="Preview visual da tabela de componentes"
              srcDoc={previewHtml}
              sandbox=""
              referrerPolicy="same-origin"
              style={{ width: "100%", minHeight: 460, border: 0, background: "#fff" }}
            />
          </div>
          {/* Chat */}
          <div className="col-lg-5 d-flex flex-column" style={{ maxHeight: 520 }}>
            <div ref={chatRef} className="flex-grow-1 p-3 d-flex flex-column gap-2" style={{ overflowY: "auto" }}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 rounded ${m.type === "user" ? "align-self-end bg-primary text-white" : m.type === "err" ? "align-self-start bg-danger-subtle text-danger" : "align-self-start bg-light"}`}
                  style={{ maxWidth: "85%", fontSize: 13 }}
                >
                  {m.text}
                </div>
              ))}
              {busy && <div className="align-self-start text-muted small"><Spinner animation="border" size="sm" /> …</div>}
            </div>
            <div className="d-flex flex-wrap gap-1 px-3 pb-2">
              {CHIPS.map((c) => (
                <Badge key={c.value} bg="light" text="dark" role="button" style={{ cursor: "pointer", border: "1px solid #e2e8f0" }} onClick={() => setInput(c.value)}>
                  {c.label}
                </Badge>
              ))}
            </div>
            <div className="p-2 border-top d-flex gap-2">
              <Form.Control
                size="sm"
                as="textarea"
                rows={1}
                placeholder="Descreva o ajuste…"
                value={input}
                disabled={busy || loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              />
              <Button size="sm" disabled={busy || loading || !input.trim()} onClick={send}>Enviar</Button>
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <Button size="sm" variant="outline-danger" disabled={busy || loading} onClick={reset}>Restaurar padrão</Button>
        <div className="d-flex gap-2">
          <Button size="sm" variant="outline-secondary" disabled={busy || loading || !pendingStyle} onClick={saveDefault}>Salvar como padrão</Button>
          <Button size="sm" disabled={busy || loading || !pendingStyle} onClick={save}>Salvar nesta OS</Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}
