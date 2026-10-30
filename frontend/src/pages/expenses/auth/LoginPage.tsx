import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../../../api/expenses";
import { errorMessage } from "../shared";
import AuthShell from "./AuthShell";

// Só aceita voltar para telas do próprio módulo (evita redirecionamento aberto).
export function safeNext(raw: string | null): string {
  const next = String(raw || "");
  const stripped = next.startsWith("/app/") ? next.slice(4) : next;
  return stripped.startsWith("/expenses") && !stripped.startsWith("/expenses/login") ? stripped : "/expenses";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { user } = await login(identifier.trim(), password);
      // Descarta dados de uma sessão anterior (outro usuário no mesmo navegador).
      qc.removeQueries({ queryKey: ["expenses"] });
      navigate(user.mustChangePassword ? "/expenses/change-password" : safeNext(params.get("next")), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Entrar" subtitle="Use o usuário e a senha do Relatório de Despesas (não é o login do Service Hub).">
      {params.get("reset") === "1" && <Alert variant="success" className="mb-0 small">Senha definida. Entre com a nova senha.</Alert>}
      {params.get("logout") === "1" && <Alert variant="secondary" className="mb-0 small">Você saiu do módulo.</Alert>}
      {error && <Alert variant="danger" className="mb-0 small">{error}</Alert>}
      <Form onSubmit={onSubmit} className="d-flex flex-column gap-3">
        <Form.Group>
          <Form.Label>Usuário ou e-mail</Form.Label>
          <Form.Control autoFocus autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </Form.Group>
        <Form.Group>
          <Form.Label>Senha</Form.Label>
          <Form.Control type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </Form.Group>
        <Button type="submit" disabled={busy || !identifier.trim() || !password}>
          {busy ? <Spinner animation="border" size="sm" /> : "Entrar"}
        </Button>
      </Form>
      <div className="d-flex justify-content-between small">
        <Link to="/expenses/forgot-password">Esqueci minha senha</Link>
        <a href="/admin/hub" className="text-muted">Service Hub</a>
      </div>
    </AuthShell>
  );
}
