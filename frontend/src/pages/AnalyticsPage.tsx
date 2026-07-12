import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Row, Spinner } from "react-bootstrap";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getAnalytics } from "../api/analytics";

// Paleta categórica ancorada na identidade Vextrom (verde da marca + status).
const PIE_COLORS = ["#4F7F2A", "#0E6BA8", "#DFAE18", "#C93F3F", "#8B5CF6", "#5F686D", "#E6512E"];

function Kpi({ label, value, icon }: { label: string; value: number | string; icon: string }) {
  return (
    <div className="vx-kpi h-100">
      <div className="d-flex align-items-center gap-3 p-3">
        <span className="vx-kpi__icon">
          <span className="material-symbols-outlined">{icon}</span>
        </span>
        <div>
          <div className="vx-kpi__value">{value}</div>
          <div className="vx-kpi__label">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["analytics"], queryFn: getAnalytics });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando dashboard…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar analytics: {(error as Error).message}</Alert>;
  }
  if (!data) return null;

  const { kpis, tables, monthlyTrend } = data;

  // Une as séries opened/closed por mês para o gráfico de tendência.
  const months = Array.from(
    new Set([...monthlyTrend.opened, ...monthlyTrend.closed].map((m) => m.month_ref))
  ).sort();
  const trendData = months.map((m) => ({
    month: m,
    Abertas: monthlyTrend.opened.find((x) => x.month_ref === m)?.qty ?? 0,
    Fechadas: monthlyTrend.closed.find((x) => x.month_ref === m)?.qty ?? 0
  }));

  const statusData = tables.ordersByStatus.map((s) => ({ name: s.status, value: s.qty }));
  const hoursData = tables.hoursByTechnician
    .slice(0, 10)
    .map((t) => ({ name: t.technician_name, horas: Number(t.total_hours) }));
  const customersData = tables.topCustomers.slice(0, 8).map((c) => ({ name: c.name, OS: c.os_qty }));

  return (
    <div className="d-flex flex-column gap-4">
      <h2 className="h5 mb-0">Analytics — Service Report</h2>

      <Row className="g-3">
        <Col xs={6} md={3}><Kpi label="Total de OS" value={kpis.total_os} icon="receipt_long" /></Col>
        <Col xs={6} md={3}><Kpi label="Aprovadas" value={kpis.total_approved} icon="task_alt" /></Col>
        <Col xs={6} md={3}><Kpi label="Em rascunho" value={kpis.total_draft} icon="draft" /></Col>
        <Col xs={6} md={3}><Kpi label="Méd. dias p/ fechar" value={kpis.avg_close_days} icon="schedule" /></Col>
      </Row>

      <Row className="g-4">
        <Col lg={5}>
          <Card className="h-100">
            <Card.Header>OS por status</Card.Header>
            <Card.Body style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" outerRadius={110} label>
                    {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={7}>
          <Card className="h-100">
            <Card.Header>Tendência mensal (abertas vs. fechadas)</Card.Header>
            <Card.Body style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Abertas" stroke="#0E6BA8" strokeWidth={2} />
                  <Line type="monotone" dataKey="Fechadas" stroke="#3F7D2A" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Horas por técnico (top 10)</Card.Header>
            <Card.Body style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={120} />
                  <Tooltip />
                  <Bar dataKey="horas" fill="#0E6BA8" />
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Header>Top clientes (por nº de OS)</Card.Header>
            <Card.Body style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customersData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="OS" fill="#4F7F2A" />
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
