import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Form, InputGroup, Row, Spinner } from "react-bootstrap";
import { EmailSettingsInput, getEmailSettings, saveEmailSettings, sendTestEmail } from "../../../api/expenses";
import { PageHeader, errorMessage } from "../shared";

const EMPTY: EmailSettingsInput = {
  mode: "platform",
  notificationsEnabled: false,
  smtp: { host: "", port: 587, secure: false, user: "", from: "", pass: "" },
  clearPassword: false
};

// Atalhos para servidores comuns (só preenchem host/porta/segurança).
const PRESETS: { label: string; host: string; port: number; secure: boolean }[] = [
  { label: "Mailtrap Sandbox (teste)", host: "sandbox.smtp.mailtrap.io", port: 2525, secure: false },
  { label: "Mailtrap Sending (envio real)", host: "live.smtp.mailtrap.io", port: 587, secure: false },
  { label: "Microsoft 365", host: "smtp.office365.com", port: 587, secure: false },
  { label: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 465, secure: true }
];

// Configurações do módulo — e-mail usado nas notificações e nos convites.
export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["expenses", "settings", "email"], queryFn: getEmailSettings });
  const [form, setForm] = useState<EmailSettingsInput>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    const e = data.email;
    setForm({ mode: e.mode, notificationsEnabled: e.notificationsEnabled, smtp: { ...e.smtp, pass: "" }, clearPassword: false });
  }, [data]);

  const mSave = useMutation({
    mutationFn: () => saveEmailSettings(form),
    onSuccess: (res) => {
      qc.setQueryData(["expenses", "settings", "email"], res);
      setSaved(true);
      setTestResult(null);
    }
  });
  const mTest = useMutation({
    mutationFn: () => sendTestEmail(testTo),
    onSuccess: () => setTestResult({ ok: true, message: `E-mail de teste enviado para ${testTo}.` }),
    onError: (e) => setTestResult({ ok: false, message: errorMessage(e) })
  });

  const setSmtp = (patch: Partial<EmailSettingsInput["smtp"]>) => {
    setSaved(false);
    setForm((f) => ({ ...f, smtp: { ...f.smtp, ...patch } }));
  };

  if (isLoading) return <div><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error) return <Alert variant="danger">{errorMessage(error)}</Alert>;

  const custom = form.mode === "custom";
  const hasPassword = Boolean(data?.email.hasPassword) && !form.clearPassword;
  const valid = !custom || (form.smtp.host.trim() && form.smtp.from.trim() && form.smtp.port > 0);
  const dirty = data && JSON.stringify({ ...form, smtp: { ...form.smtp, pass: "" } })
    !== JSON.stringify({ mode: data.email.mode, notificationsEnabled: data.email.notificationsEnabled, smtp: { ...data.email.smtp, pass: "" }, clearPassword: false })
    || Boolean(form.smtp.pass);

  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (valid && !mSave.isPending) mSave.mutate(); };

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Configurações"
        subtitle="E-mail usado pelo módulo nas notificações (envio, análise, decisão, pagamento) e nos convites de novas contas."
      />
      {mSave.error && <Alert variant="danger" className="mb-0">{errorMessage(mSave.error)}</Alert>}
      {saved && <Alert variant="success" dismissible onClose={() => setSaved(false)} className="mb-0">Configurações salvas.</Alert>}

      <Form onSubmit={onSubmit} className="d-flex flex-column gap-4">
        <Card>
          <Card.Header>Notificações por e-mail</Card.Header>
          <Card.Body>
            <Form.Check
              type="switch"
              id="notif-enabled"
              label="Enviar e-mail aos envolvidos a cada movimentação dos relatórios"
              checked={form.notificationsEnabled}
              onChange={(e) => { setSaved(false); setForm({ ...form, notificationsEnabled: e.target.checked }); }}
            />
            <Form.Text muted>
              As notificações dentro do sistema (sino) funcionam sempre. Convites de novas contas são enviados mesmo com esta opção desligada.
              O e-mail do colaborador vem do perfil de reembolso dele.
            </Form.Text>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>Servidor de envio (SMTP)</Card.Header>
          <Card.Body className="d-flex flex-column gap-3">
            <div>
              <Form.Check type="radio" id="mode-platform" name="mode" label="Usar o SMTP da plataforma (Configuração do sistema)"
                checked={!custom} onChange={() => { setSaved(false); setForm({ ...form, mode: "platform" }); }} />
              <Form.Check type="radio" id="mode-custom" name="mode" label="Usar um SMTP próprio para este módulo"
                checked={custom} onChange={() => { setSaved(false); setForm({ ...form, mode: "custom" }); }} />
            </div>

            {custom && (
              <>
                <div className="d-flex gap-2 flex-wrap align-items-center">
                  <span className="small text-muted">Preencher com:</span>
                  {PRESETS.map((p) => (
                    <Button key={p.label} size="sm" variant="outline-secondary"
                      onClick={() => setSmtp({ host: p.host, port: p.port, secure: p.secure })}>{p.label}</Button>
                  ))}
                </div>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Label>Servidor *</Form.Label>
                    <Form.Control required value={form.smtp.host} placeholder="smtp.exemplo.com"
                      onChange={(e) => setSmtp({ host: e.target.value })} />
                  </Col>
                  <Col xs={6} md={3}>
                    <Form.Label>Porta *</Form.Label>
                    <Form.Control type="number" min={1} max={65535} value={form.smtp.port}
                      onChange={(e) => setSmtp({ port: Number(e.target.value) || 0 })} />
                  </Col>
                  <Col xs={6} md={3} className="d-flex align-items-end">
                    <Form.Check type="switch" id="smtp-secure" label="SSL/TLS direto"
                      checked={form.smtp.secure} onChange={(e) => setSmtp({ secure: e.target.checked })} />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Usuário</Form.Label>
                    <Form.Control autoComplete="off" value={form.smtp.user} onChange={(e) => setSmtp({ user: e.target.value })} />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Senha</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="password"
                        autoComplete="new-password"
                        value={form.smtp.pass}
                        placeholder={hasPassword ? "•••••••• (salva — deixe em branco para manter)" : ""}
                        onChange={(e) => setSmtp({ pass: e.target.value })}
                      />
                      {data?.email.hasPassword && (
                        <Button variant={form.clearPassword ? "danger" : "outline-secondary"}
                          onClick={() => { setSaved(false); setForm({ ...form, clearPassword: !form.clearPassword, smtp: { ...form.smtp, pass: "" } }); }}>
                          {form.clearPassword ? "Será apagada" : "Apagar"}
                        </Button>
                      )}
                    </InputGroup>
                    <Form.Text muted>Gravada criptografada; nunca é exibida.</Form.Text>
                  </Col>
                  <Col md={12}>
                    <Form.Label>Remetente *</Form.Label>
                    <Form.Control required value={form.smtp.from} placeholder="Despesas Vextrom <despesas@suaempresa.com.br>"
                      onChange={(e) => setSmtp({ from: e.target.value })} />
                    <Form.Text muted>Em serviços de envio real o domínio do remetente precisa estar verificado no provedor.</Form.Text>
                  </Col>
                </Row>
                <Alert variant="light" className="small mb-0">
                  Porta 465 → ligue <strong>SSL/TLS direto</strong>. Portas 587 e 2525 → deixe desligado (a conexão usa STARTTLS).
                </Alert>
              </>
            )}
          </Card.Body>
        </Card>

        <div className="d-flex justify-content-end">
          <Button type="submit" disabled={!valid || !dirty || mSave.isPending}>
            {mSave.isPending ? <Spinner animation="border" size="sm" /> : "Salvar configurações"}
          </Button>
        </div>
      </Form>

      <Card>
        <Card.Header>Testar envio</Card.Header>
        <Card.Body className="d-flex flex-column gap-2">
          <Form onSubmit={(e: FormEvent) => { e.preventDefault(); setTestResult(null); mTest.mutate(); }}>
            <InputGroup style={{ maxWidth: 520 }}>
              <Form.Control type="email" required placeholder="destinatario@exemplo.com" value={testTo}
                onChange={(e) => setTestTo(e.target.value)} />
              <Button type="submit" variant="outline-primary" disabled={!testTo || mTest.isPending || Boolean(dirty)}>
                {mTest.isPending ? <Spinner animation="border" size="sm" /> : "Enviar teste"}
              </Button>
            </InputGroup>
          </Form>
          <Form.Text muted>{dirty ? "Salve as alterações antes de testar — o teste usa a configuração salva." : "Usa a configuração salva."}</Form.Text>
          {testResult && <Alert variant={testResult.ok ? "success" : "danger"} className="mb-0">{testResult.message}</Alert>}
        </Card.Body>
      </Card>
    </div>
  );
}
