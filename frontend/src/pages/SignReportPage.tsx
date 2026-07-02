import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import IconAction from "../components/IconAction";
import {
  createTechnicianSignature,
  deleteSignature,
  getSignReport,
  type SignReportTechnician
} from "../api/reportEditor";

function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function SignReportPage() {
  const orderId = Number(useParams().id);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["sign-report", orderId], queryFn: () => getSignReport(orderId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["sign-report", orderId] });

  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [signerCompany, setSignerCompany] = useState("Vextrom");
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const [empty, setEmpty] = useState(true);

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 160 * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = "160px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctxRef.current = ctx;
  };

  useEffect(() => {
    setupCanvas();
    window.addEventListener("resize", setupCanvas);
    return () => window.removeEventListener("resize", setupCanvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.canSign]);

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : null;
    const clientX = t ? t.clientX : (e as React.MouseEvent).clientX;
    const clientY = t ? t.clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    const ctx = ctxRef.current; if (!ctx) return;
    drawing.current = true; hasDrawn.current = true; setEmpty(false);
    const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current; if (!ctx) return;
    const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke();
    if ("touches" in e) e.preventDefault();
  };
  const end = () => { drawing.current = false; };
  const clear = () => {
    const canvas = canvasRef.current; const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    hasDrawn.current = false; setEmpty(true);
  };

  const mCreate = useMutation({
    mutationFn: () => {
      const canvas = canvasRef.current!;
      return createTechnicianSignature(orderId, {
        signatureData: canvas.toDataURL("image/png"),
        signerName, signerRole, signerCompany
      });
    },
    onSuccess: () => { setDone(true); setActionError(null); clear(); setSignerName(""); setSignerRole(""); invalidate(); },
    onError: (e: unknown) => { setDone(false); setActionError((e as Error).message); }
  });
  const mDelete = useMutation({ mutationFn: (sigId: number) => deleteSignature(orderId, sigId), onSuccess: invalidate, onError: (e: unknown) => setActionError((e as Error).message) });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setActionError(null); setDone(false);
    if (!hasDrawn.current) { setActionError("Desenhe a assinatura antes de confirmar."); return; }
    mCreate.mutate();
  };

  const pickTechnician = (t: SignReportTechnician | undefined) => {
    if (!t) return;
    setSignerName(t.name || "");
    if (t.role) setSignerRole(t.role);
    if (t.company) setSignerCompany(t.company);
  };

  if (isLoading) return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error || !data) return <Alert variant="danger">Falha ao carregar: {(error as Error)?.message}</Alert>;

  const { order, technicians, signatures, canSign } = data;
  const osLabel = order.service_order_display || order.service_order_code || `#${order.id}`;

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Assinar relatório · OS {osLabel} <Badge bg="secondary" className="ms-2">{order.status}</Badge></span>
          <div className="d-flex gap-2">
            <Link className="btn btn-sm btn-outline-secondary" to={`/orders/${orderId}/report`}>← Editor de relatório</Link>
            <Link className="btn btn-sm btn-outline-secondary" to={`/orders/${orderId}/editor`}>Editor da OS</Link>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="text-muted">{order.title} — {order.customer_name}</div>
        </Card.Body>
      </Card>

      {!canSign && <Alert variant="warning">A OS precisa estar com status <strong>valid</strong> para permitir a assinatura do técnico.</Alert>}
      {done && <Alert variant="success" dismissible onClose={() => setDone(false)}>Assinatura registrada com sucesso.</Alert>}
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      <div className="row g-4">
        <div className="col-12 col-xl-7">
          <Card>
            <Card.Header>Assinatura do técnico</Card.Header>
            <Card.Body>
              <Form onSubmit={submit} className="row g-2">
                <div className="col-12">
                  <Form.Label>Técnicos vinculados</Form.Label>
                  <Form.Select disabled={!canSign} onChange={(e) => pickTechnician(technicians.find((t) => String(t.id) === e.target.value))} defaultValue="">
                    <option value="">Selecione um técnico…</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.role ? ` - ${t.role}` : ""}{t.company ? ` (${t.company})` : ""}</option>
                    ))}
                  </Form.Select>
                  {technicians.length === 0 && <div className="form-text text-warning">Nenhum técnico vinculado à OS.</div>}
                </div>
                <div className="col-12 col-md-6"><Form.Control placeholder="Nome do signatário" required disabled={!canSign} value={signerName} onChange={(e) => setSignerName(e.target.value)} /></div>
                <div className="col-12 col-md-6"><Form.Control placeholder="Cargo / Função" disabled={!canSign} value={signerRole} onChange={(e) => setSignerRole(e.target.value)} /></div>
                <div className="col-12"><Form.Control placeholder="Empresa" disabled={!canSign} value={signerCompany} onChange={(e) => setSignerCompany(e.target.value)} /></div>
                <div className="col-12">
                  <Form.Label>Assinatura</Form.Label>
                  <div style={{ position: "relative", border: "2px solid #b0c4b1", borderRadius: 8, background: "#fafcfa", height: 160 }}>
                    <canvas
                      ref={canvasRef}
                      style={{ display: "block", width: "100%", height: 160, touchAction: "none", cursor: canSign ? "crosshair" : "not-allowed" }}
                      onMouseDown={canSign ? start : undefined}
                      onMouseMove={canSign ? move : undefined}
                      onMouseUp={end}
                      onMouseLeave={end}
                      onTouchStart={canSign ? start : undefined}
                      onTouchMove={canSign ? move : undefined}
                      onTouchEnd={end}
                    />
                    {empty && <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: "#a0b4a2", fontSize: "0.88rem", pointerEvents: "none", userSelect: "none" }}>Assine aqui</span>}
                    <button type="button" onClick={clear} style={{ position: "absolute", top: 8, right: 10, fontSize: "0.78rem", color: "#888", background: "none", border: "none", cursor: "pointer" }}>Limpar</button>
                  </div>
                </div>
                <div className="col-12 d-flex justify-content-end">
                  <Button type="submit" variant="success" size="sm" disabled={!canSign || mCreate.isPending}>{mCreate.isPending ? "Salvando…" : "Confirmar assinatura"}</Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <Card>
            <Card.Header>Assinaturas registradas <Badge bg="light" text="dark" className="ms-2">{signatures.length}</Badge></Card.Header>
            <Table striped responsive hover size="sm" className="mb-0 align-middle">
              <thead><tr><th>Nome</th><th>Função</th><th>Data</th><th className="text-end">Ações</th></tr></thead>
              <tbody>
                {signatures.length === 0 && <tr><td colSpan={4} className="text-muted">Nenhuma assinatura registrada.</td></tr>}
                {signatures.map((s) => (
                  <tr key={s.id}>
                    <td>{s.signer_name || "—"}</td>
                    <td>{s.signer_role || "—"}</td>
                    <td>{fmtDateTime(s.signed_at)}</td>
                    <td className="text-end">
                      <div className="vx-actions justify-content-end">
                        <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mDelete.isPending} onClick={() => { if (confirm("Excluir esta assinatura?")) mDelete.mutate(s.id); }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
