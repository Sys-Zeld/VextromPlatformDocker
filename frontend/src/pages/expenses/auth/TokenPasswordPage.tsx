import { FormEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { completeToken, getTokenInfo } from "../../../api/expenses";
import { errorMessage } from "../shared";
import AuthShell from "./AuthShell";

// Definição de senha por link de uso único: convite (primeiro acesso) ou
// redefinição ("esqueci minha senha").
export default function TokenPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const info = useQuery({ queryKey: ["expenses-token", token], queryFn: () => getTokenInfo(token), enabled: Boolean(token), retry: false });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = Boolean(confirm) && password !== confirm;
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await completeToken(token, password);
      navigate("/expenses/login?reset=1", { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const invite = info.data?.kind === "invite";
  return (
    <AuthShell
      title={invite ? "Crie sua senha" : "Redefinir senha"}
      subtitle={info.data ? `Usuário: ${info.data.username}` : undefined}
    >
      {!token || info.error ? (
        <Alert variant="danger" className="mb-0 small">
          {token ? errorMessage(info.error) : "Link incompleto."} Peça um novo link ao administrador ou use “Esqueci minha senha”.
        </Alert>
      ) : info.isLoading ? (
        <div><Spinner animation="border" size="sm" /> Validando link…</div>
      ) : (
        <Form onSubmit={onSubmit} className="d-flex flex-column gap-3">
          {error && <Alert variant="danger" className="mb-0 small">{error}</Alert>}
          <Form.Text muted>{info.data?.requirements}</Form.Text>
          <Form.Group>
            <Form.Label>Nova senha</Form.Label>
            <Form.Control type="password" autoComplete="new-password" autoFocus required value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Confirme a nova senha</Form.Label>
            <Form.Control type="password" autoComplete="new-password" required value={confirm} isInvalid={mismatch}
              onChange={(e) => setConfirm(e.target.value)} />
            <Form.Control.Feedback type="invalid">As senhas não conferem.</Form.Control.Feedback>
          </Form.Group>
          <Button type="submit" disabled={busy || !password || mismatch || !confirm}>
            {busy ? <Spinner animation="border" size="sm" /> : "Salvar senha"}
          </Button>
        </Form>
      )}
      <Link to="/expenses/login" className="small">Ir para o login</Link>
    </AuthShell>
  );
}
