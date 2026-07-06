import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Card, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { getSentinelHealth } from "../../api/sentinelgrid/client";

// Stub da Fase 0 (fatia 0.2): confirma que o módulo está montado e as migrations
// rodaram, consumindo GET /admin/api/v2/sentinelgrid/health. As telas de produto
// entram a partir da Fase 1 (cadastros).
export default function SentinelHomePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sentinelgrid", "health"],
    queryFn: getSentinelHealth
  });

  const online = !isLoading && !isError && data?.status === "ok";

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <span className="d-flex align-items-center gap-2">
            <strong>SentinelGrid</strong>
            <Badge bg="warning" text="dark">Em desenvolvimento</Badge>
          </span>
          <a className="small" href="/admin/hub">← Service Hub</a>
        </Card.Header>
        <Card.Body>
          <p className="text-muted mb-0">
            Gestão de manutenção de equipamentos críticos de energia (UPS, retificadores,
            baterias, BMS, chaves estáticas). Módulo orientado ao equipamento, com hierarquia
            Cliente → Site → Área → Equipamento.
          </p>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Status do módulo</Card.Header>
        <Card.Body>
          {isLoading && (
            <div className="d-flex align-items-center gap-2 text-muted">
              <Spinner animation="border" size="sm" /> Verificando o backend…
            </div>
          )}
          {isError && (
            <Alert variant="danger" className="mb-0">
              Não foi possível falar com o backend do SentinelGrid: {(error as Error)?.message}
            </Alert>
          )}
          {!isLoading && !isError && (
            <div className="d-flex flex-column gap-2">
              <div className="d-flex align-items-center gap-2">
                <Badge bg={online ? "success" : "secondary"}>{online ? "Online" : "Indisponível"}</Badge>
                <span className="text-muted">Façade JSON respondendo em <code>/admin/api/v2/sentinelgrid</code></span>
              </div>
              <div className="small text-muted">Migrations aplicadas: <strong>{data?.migrations ?? 0}</strong></div>
            </div>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Cadastros (Fase 1)</Card.Header>
        <Card.Body className="d-flex flex-wrap gap-2">
          <Link to="/sentinelgrid/clients" className="btn btn-outline-primary btn-sm">Clientes</Link>
          <Link to="/sentinelgrid/sites" className="btn btn-outline-primary btn-sm">Sites</Link>
          <Link to="/sentinelgrid/catalog" className="btn btn-outline-primary btn-sm">Catálogo</Link>
          <Link to="/sentinelgrid/equipment" className="btn btn-outline-primary btn-sm">Equipamentos</Link>
          <Link to="/sentinelgrid/management" className="btn btn-outline-primary btn-sm">Contratos &amp; Gestores</Link>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Próximas fases</Card.Header>
        <Card.Body>
          <div className="mb-3">
            <Link to="/sentinelgrid/programs" className="btn btn-outline-primary btn-sm">Programas de manutencao</Link>
            <Link to="/sentinelgrid/plans" className="btn btn-outline-primary btn-sm ms-2">Planos do equipamento</Link>
            <Link to="/sentinelgrid/checklists" className="btn btn-outline-primary btn-sm ms-2">Checklists</Link>
            <Link to="/sentinelgrid/maintenance-orders" className="btn btn-outline-primary btn-sm ms-2">Ordens de manutencao</Link>
            <Link to="/sentinelgrid/calendar" className="btn btn-outline-primary btn-sm ms-2">Calendario</Link>
            <Link to="/sentinelgrid/alerts" className="btn btn-outline-primary btn-sm ms-2">Alertas</Link>
            <Link to="/sentinelgrid/history" className="btn btn-outline-primary btn-sm ms-2">Historico</Link>
            <Link to="/sentinelgrid/recommendations" className="btn btn-outline-primary btn-sm ms-2">Recomendacoes</Link>
            <Link to="/sentinelgrid/dashboard" className="btn btn-outline-primary btn-sm ms-2">Dashboard</Link>
          </div>
          <ol className="mb-0 text-muted">
            <li>Fase 1 — Cadastros base (Cliente → Site → Área → Equipamento + apoio)</li>
            <li>Fase 2 — Programas &amp; Planos de manutenção</li>
            <li>Fase 3 — Ordens de Manutenção (preventiva s/parada, c/parada, corretiva)</li>
          </ol>
        </Card.Body>
      </Card>
    </div>
  );
}
