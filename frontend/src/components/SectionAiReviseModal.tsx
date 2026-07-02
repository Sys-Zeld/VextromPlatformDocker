import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { reviseSectionText } from "../api/reportEditor";

const DEFAULT_PROMPT = "Revise o texto abaixo sem mudar muitas palavras";

export default function SectionAiReviseModal(props: {
  show: boolean;
  orderId: number;
  text: string;
  html: string;
  onHide: () => void;
  onApplied: (revisedHtml: string) => void;
}) {
  const { show, orderId, text, html, onHide, onApplied } = props;
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (show) { setPrompt(DEFAULT_PROMPT); setErr(null); setBusy(false); }
  }, [show]);

  const confirm = async () => {
    const p = prompt.trim();
    if (!p) { setErr("Informe a instrução para a IA."); return; }
    setBusy(true);
    setErr(null);
    try {
      const r = await reviseSectionText(orderId, { text, html, prompt: p, preserveFormatting: true });
      onApplied(r.revisedHtml || html);
      onHide();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h6 mb-0">Revisar texto com IA</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Label className="small fw-semibold">Instrução para a IA</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ex: Revise o texto mantendo o tom técnico…"
        />
        <Form.Text muted>
          O conteúdo atual do capítulo será enviado junto com esta instrução. A formatação é preservada. A ação substitui o conteúdo e não pode ser desfeita automaticamente.
        </Form.Text>
        {err && <Alert variant="danger" className="mt-3 mb-0 py-2">{err}</Alert>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" size="sm" disabled={busy} onClick={onHide}>Cancelar</Button>
        <Button variant="success" size="sm" disabled={busy || !prompt.trim()} onClick={confirm}>
          {busy ? "Revisando…" : "Revisar texto"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
