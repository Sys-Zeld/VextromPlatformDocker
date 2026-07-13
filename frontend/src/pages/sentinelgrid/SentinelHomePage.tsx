import { useQuery } from "@tanstack/react-query";
import { Alert, Badge, Card, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { getSentinelHealth } from "../../api/sentinelgrid/client";
import SgIcon, { SgIconName } from "../../components/sentinelgrid/SgIcon";

const BRAND_ICON = `${import.meta.env.BASE_URL}img/SentinelGrid-icone.png`;

// Home do módulo: hero com a marca + grade de acesso rápido com os ícones de
// contexto (troca automática para a arte "-dark" no tema DarkVextrom). Mantém o
// cartão de status que confirma que a façade e as migrations estão de pé.

interface HomeCard {
  to: string;
  icon: SgIconName;
  title: string;
  desc: string;
}

const CARDS: HomeCard[] = [
  { to: "/sentinelgrid/equipment", icon: "equipment", title: "Equipamentos", desc: "Ativos críticos e ficha técnica" },
  { to: "/sentinelgrid/maintenance-orders", icon: "orders", title: "Ordens", desc: "Ordens de manutenção (OM)" },
  { to: "/sentinelgrid/calendar", icon: "calendar", title: "Calendário", desc: "Mapa de manutenção e vencimentos" },
  { to: "/sentinelgrid/schedule", icon: "year", title: "Cronograma", desc: "Planilha anual estilo Planner" },
  { to: "/sentinelgrid/checklists", icon: "checklist", title: "Checklists", desc: "Templates de execução técnica" },
  { to: "/sentinelgrid/programs", icon: "program", title: "Programas", desc: "Planos e periodicidades" },
  { to: "/sentinelgrid/assets", icon: "new-doc", title: "Assets", desc: "Manuais, plaquetas e checklists" },
  { to: "/sentinelgrid/alerts", icon: "alerts", title: "Alertas", desc: "Pendências e corretivas em prazo" }
];

const QUICK_LINKS: { to: string; label: string }[] = [
  { to: "/sentinelgrid/clients", label: "Clientes" },
  { to: "/sentinelgrid/sites", label: "Sites" },
  { to: "/sentinelgrid/catalog", label: "Catálogo" },
  { to: "/sentinelgrid/management", label: "Contratos & Gestores" },
  { to: "/sentinelgrid/plans", label: "Planos" },
  { to: "/sentinelgrid/history", label: "Histórico" },
  { to: "/sentinelgrid/recommendations", label: "Recomendações" },
  { to: "/sentinelgrid/dashboard", label: "Dashboard" }
];

export default function SentinelHomePage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["sentinelgrid", "health"],
    queryFn: getSentinelHealth
  });

  const online = !isLoading && !isError && data?.status === "ok";

  return (
    <div className="d-flex flex-column gap-4">
      <Card>
        <Card.Body className="sg-home-hero">
          <img src={BRAND_ICON} alt="SentinelGrid" width={88} height={88} className="sg-home-brand" />
          <div className="me-auto">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <strong className="fs-5">SentinelGrid</strong>
              <Badge bg="warning" text="dark">Em desenvolvimento</Badge>
            </div>
            <p className="text-muted mb-0 mt-1">
              Gestão de manutenção de equipamentos críticos de energia (UPS, retificadores,
              baterias, BMS, chaves estáticas). Módulo orientado ao equipamento, com hierarquia
              Cliente → Site → Área → Equipamento.
            </p>
          </div>
          <a className="small align-self-start" href="/admin/hub">← Service Hub</a>
        </Card.Body>
      </Card>

      <div>
        <div className="fw-semibold text-muted small mb-2">Acesso rápido</div>
        <div className="sg-home-grid">
          {CARDS.map((c) => (
            <Link key={c.to} to={c.to} className="sg-home-card">
              <span className="sg-home-card__icon">
                <SgIcon name={c.icon} size={42} />
              </span>
              <span>
                <span className="sg-home-card__title d-block">{c.title}</span>
                <span className="sg-home-card__desc">{c.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

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
        <Card.Header>Cadastros &amp; mais</Card.Header>
        <Card.Body className="d-flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="btn btn-outline-primary btn-sm">{l.label}</Link>
          ))}
        </Card.Body>
      </Card>
    </div>
  );
}
