import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Spinner } from "react-bootstrap";
import { api } from "../api/client";

interface SessionInfo {
  authenticated: boolean;
  username: string | null;
  role: string | null;
  lang: string;
  reactAppEnabled: boolean;
}

// Valida os pilares da Fase 0: a sessão de admin legada é reconhecida pelo façade /admin/api/v2.
export default function HealthPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["session"],
    queryFn: () => api<SessionInfo>("/session")
  });

  if (isLoading) {
    return (
      <div className="d-flex align-items-center gap-2">
        <Spinner animation="border" size="sm" /> Verificando sessão…
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">Falha ao consultar a sessão: {(error as Error).message}</Alert>;
  }

  return (
    <Card>
      <Card.Header>Verificação da Fase 0</Card.Header>
      <Card.Body>
        <dl className="row mb-0">
          <dt className="col-sm-3">Autenticado</dt>
          <dd className="col-sm-9">{data?.authenticated ? "sim" : "não"}</dd>
          <dt className="col-sm-3">Usuário</dt>
          <dd className="col-sm-9">{data?.username ?? "—"}</dd>
          <dt className="col-sm-3">Perfil</dt>
          <dd className="col-sm-9">{data?.role ?? "—"}</dd>
          <dt className="col-sm-3">Idioma</dt>
          <dd className="col-sm-9">{data?.lang ?? "—"}</dd>
        </dl>
      </Card.Body>
    </Card>
  );
}
