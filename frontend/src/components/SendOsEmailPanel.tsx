import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Form } from "react-bootstrap";
import type { Technician } from "../api/assets";
import { sendOsEmail } from "../api/orderEditor";

export default function SendOsEmailPanel(props: { orderId: number; technicians: Technician[] }) {
  const { orderId, technicians } = props;
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const techsWithEmail = technicians.filter((t) => t.email);

  const mSend = useMutation({
    mutationFn: () => sendOsEmail(orderId, { to, cc }),
    onSuccess: (r) => {
      setErrMsg(null);
      setOkMsg(`OS enviada para ${r.recipients.length} destinatário(s): ${r.recipients.join(", ")}`);
      setTo("");
      setCc("");
    },
    onError: (e: unknown) => { setOkMsg(null); setErrMsg((e as Error).message); }
  });

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setOkMsg(null);
    setErrMsg(null);
    mSend.mutate();
  };

  return (
    <Card>
      <Card.Header>Enviar OS por e-mail</Card.Header>
      <Card.Body>
        <p className="text-muted small mb-3">
          Envia os dados desta OS para os e-mails dos técnicos vinculados. Adicione destinatários extras no campo abaixo.
        </p>
        {okMsg && <Alert variant="success" dismissible onClose={() => setOkMsg(null)}>{okMsg}</Alert>}
        {errMsg && <Alert variant="danger" dismissible onClose={() => setErrMsg(null)}>{errMsg}</Alert>}
        <Form onSubmit={submit} className="row g-3">
          <div className="col-12 col-md-6">
            <Form.Label>Destinatários extras (Para)</Form.Label>
            <Form.Control size="sm" placeholder="extra@empresa.com; outro@empresa.com" value={to} onChange={(e) => setTo(e.target.value)} />
            <Form.Text muted>
              Técnicos com e-mail cadastrado:{" "}
              {techsWithEmail.length
                ? <strong>{techsWithEmail.map((t) => `${t.name} <${t.email}>`).join(", ")}</strong>
                : <em>nenhum técnico com e-mail cadastrado nesta OS.</em>}
            </Form.Text>
          </div>
          <div className="col-12 col-md-4">
            <Form.Label>CC (opcional)</Form.Label>
            <Form.Control size="sm" placeholder="cc@empresa.com" value={cc} onChange={(e) => setCc(e.target.value)} />
          </div>
          <div className="col-12 col-md-2 d-flex align-items-end">
            <Button size="sm" type="submit" className="w-100" disabled={mSend.isPending}>
              {mSend.isPending ? "Enviando…" : "Enviar OS"}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
}
