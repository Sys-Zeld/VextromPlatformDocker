import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { changePassword } from "../../../api/expenses";
import { PageHeader, errorMessage } from "../shared";
import { useExpensesMe } from "./ExpensesGuard";

// Troca de senha pelo próprio usuário. Obrigatória após senha provisória.
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useExpensesMe();
  const forced = Boolean(me.data?.user.mustChangePassword);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = Boolean(confirm) && next !== confirm;
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      setCurrent(""); setNext(""); setConfirm("");
      if (forced) navigate("/expenses", { replace: true });
      else setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="d-flex flex-column gap-4" style={{ maxWidth: 520 }}>
      <PageHeader
        title="Trocar senha"
        subtitle={forced ? "Você entrou com uma senha provisória. Defina uma senha pessoal para continuar." : "Ao trocar a senha, as outras sessões abertas são encerradas."}
      />
      {done && <Alert variant="success" dismissible onClose={() => setDone(false)} className="mb-0">Senha alterada.</Alert>}
      {error && <Alert variant="danger" className="mb-0">{error}</Alert>}
      <Card>
        <Card.Body>
          <Form onSubmit={onSubmit} className="d-flex flex-column gap-3">
            <Form.Group>
              <Form.Label>Senha atual</Form.Label>
              <Form.Control type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Nova senha</Form.Label>
              <Form.Control type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Confirme a nova senha</Form.Label>
              <Form.Control type="password" autoComplete="new-password" required value={confirm} isInvalid={mismatch}
                onChange={(e) => setConfirm(e.target.value)} />
              <Form.Control.Feedback type="invalid">As senhas não conferem.</Form.Control.Feedback>
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button type="submit" disabled={busy || !current || !next || mismatch || !confirm}>
                {busy ? <Spinner animation="border" size="sm" /> : "Salvar nova senha"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
