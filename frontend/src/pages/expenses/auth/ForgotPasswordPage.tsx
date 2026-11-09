import { FormEvent, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { forgotPassword } from "../../../api/expenses";
import { errorMessage } from "../shared";
import AuthShell from "./AuthShell";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(identifier.trim());
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Esqueci minha senha" subtitle="Enviaremos um link de redefinição para o e-mail cadastrado na sua conta.">
      {sent ? (
        // Mesma mensagem exista ou não a conta (não revela quem tem acesso).
        <Alert variant="success" className="mb-0 small">
          Se houver uma conta ativa com esses dados, você receberá um e-mail com o link para redefinir a senha.
          O link vale por 1 hora. Se não chegar, procure o administrador do módulo.
        </Alert>
      ) : (
        <Form onSubmit={onSubmit} className="d-flex flex-column gap-3">
          {error && <Alert variant="danger" className="mb-0 small">{error}</Alert>}
          <Form.Group>
            <Form.Label>Usuário ou e-mail</Form.Label>
            <Form.Control autoFocus required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          </Form.Group>
          <Button type="submit" disabled={busy || !identifier.trim()}>
            {busy ? <Spinner animation="border" size="sm" /> : "Enviar link"}
          </Button>
        </Form>
      )}
      <Link to="/expenses/login" className="small">Voltar ao login</Link>
    </AuthShell>
  );
}
