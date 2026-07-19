import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { listClients } from "../../api/sentinelgrid/clients";
import { getDashboard } from "../../api/sentinelgrid/operations";

const COLORS = {
  green: "#1f8a5b",
  lime: "#75b843",
  blue: "#2878d0",
  amber: "#e59a18",
  orange: "#dc6803",
  red: "#d92d20",
  magenta: "#c11574",
  slate: "#75847c"
};

const LABELS: Record<string, string> = {
  aberta: "Aberta",
  planejada: "Planejada",
  agendada: "Agendada",
  em_execucao: "Em execução",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  concluida_com_pendencias: "Concluída com pendências",
  cancelada: "Cancelada",
  preventiva: "Preventiva",
  preventiva_com_parada: "Preventiva com parada",
  preditiva: "Preditiva",
  corretiva: "Corretiva",
  inspecao: "Inspeção"
};

const labelOf = (value: string) => LABELS[value] || value.replace(/_/g, " ");
const percent = (value: number | null | undefined) => value == null ? "—" : `${value}%`;
const monthLabel = (value: string) => {
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
};

function Kpi({
  label,
  value,
  icon,
  note,
  tone = "green"
}: {
  label: string;
  value: number | string;
  icon: string;
  note: string;
  tone?: "green" | "blue" | "amber" | "red";
}) {
  return (
    <div className={`sg-dashboard-kpi sg-dashboard-kpi--${tone}`}>
      <div className="sg-dashboard-kpi__top">
        <span className="sg-dashboard-kpi__icon material-symbols-outlined">{icon}</span>
        <span className="sg-dashboard-kpi__label">{label}</span>
      </div>
      <div className="sg-dashboard-kpi__value">{value}</div>
      <div className="sg-dashboard-kpi__note">{note}</div>
    </div>
  );
}

function ChartTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card.Header className="sg-dashboard-chart-title">
      <strong>{title}</strong>
      <span>{subtitle}</span>
    </Card.Header>
  );
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [clientId, setClientId] = useState<number | "">("");
  const [year, setYear] = useState(currentYear);
  const clients = useQuery({
    queryKey: ["sentinelgrid", "clients", "dashboard"],
    queryFn: () => listClients({ pageSize: 100 })
  });
  const dashboard = useQuery({
    queryKey: ["sentinelgrid", "dashboard", clientId, year],
    queryFn: () => getDashboard({ clientId: clientId === "" ? undefined : clientId, year })
  });
  const data = dashboard.data;

  const adherenceData = data ? [
    { name: "No prazo", value: data.adherence.noPrazo, color: COLORS.green },
    { name: "Aproximado", value: data.adherence.aproximado, color: COLORS.amber },
    { name: "Fora do prazo", value: data.adherence.foraPrazo, color: COLORS.red },
    { name: "Em aberto", value: data.adherence.emAberto, color: COLORS.orange },
    { name: "Lacunas", value: data.adherence.lacunas, color: COLORS.magenta }
  ].filter((item) => item.value > 0) : [];
  const statusData = (data?.ordersByStatus || []).map((item, index) => ({
    name: labelOf(item.key),
    value: item.value,
    fill: [COLORS.green, COLORS.blue, COLORS.amber, COLORS.orange, COLORS.red, COLORS.slate][index % 6]
  }));
  const typeData = (data?.ordersByType || []).map((item, index) => ({
    name: labelOf(item.key),
    value: item.value,
    fill: [COLORS.green, COLORS.blue, COLORS.orange, COLORS.amber, COLORS.magenta][index % 5]
  }));
  const trendData = (data?.monthlyTrend || []).map((item) => ({
    month: monthLabel(item.month),
    Planejadas: item.planned,
    Concluídas: item.completed,
    Corretivas: item.corrective
  }));
  const clientLabel = clientId === ""
    ? "Visão consolidada de todos os clientes"
    : clients.data?.clients.find((client) => Number(client.id) === clientId)?.name || `Cliente #${clientId}`;

  return (
    <div className="d-flex flex-column gap-4 sg-dashboard">
      <section className="sg-dashboard-hero">
        <div>
          <div className="sg-dashboard-hero__eyebrow">SentinelGrid · Inteligência de manutenção</div>
          <h2>Visão executiva operacional</h2>
          <p>{clientLabel}. Indicadores de execução, aderência ao cronograma, risco e cobertura dos ativos.</p>
        </div>
        <div className="sg-dashboard-filters">
          <div>
            <Form.Label>Cliente</Form.Label>
            <Form.Select value={clientId} onChange={(event) => setClientId(event.target.value ? Number(event.target.value) : "")}>
              <option value="">Todos os clientes</option>
              {(clients.data?.clients || []).map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </Form.Select>
          </div>
          <div>
            <Form.Label>Ano analisado</Form.Label>
            <Form.Select value={year} onChange={(event) => setYear(Number(event.target.value))}>
              {Array.from({ length: 5 }, (_, index) => currentYear - 3 + index).map((item) => <option key={item}>{item}</option>)}
            </Form.Select>
          </div>
        </div>
      </section>

      {dashboard.isLoading ? (
        <div className="sg-dashboard-loading"><Spinner animation="border" size="sm" /> Consolidando indicadores...</div>
      ) : dashboard.error ? (
        <Alert variant="danger">{(dashboard.error as Error).message}</Alert>
      ) : data && (
        <>
          <section className="sg-dashboard-kpis">
            <Kpi
              label="Aderência ao cronograma"
              value={percent(data.adherence.adherenceRate)}
              icon="track_changes"
              note={`${data.adherence.noPrazo + data.adherence.aproximado} de ${data.adherence.esperadasPassado} ocorrências aderentes`}
              tone={data.adherence.adherenceRate == null || data.adherence.adherenceRate >= 85 ? "green" : data.adherence.adherenceRate >= 60 ? "amber" : "red"}
            />
            <Kpi
              label="Execução do previsto"
              value={percent(data.adherence.executionRate)}
              icon="task_alt"
              note={`${data.adherence.cumpridas} manutenções cumpridas no período`}
              tone={data.adherence.executionRate == null || data.adherence.executionRate >= 85 ? "green" : data.adherence.executionRate >= 60 ? "amber" : "red"}
            />
            <Kpi
              label="Conclusão das OMs"
              value={percent(data.orders.completionRate)}
              icon="assignment_turned_in"
              note={`${data.orders.done} concluídas de ${data.orders.total} ordens em ${year}`}
              tone="blue"
            />
            <Kpi
              label="OMs vencidas"
              value={data.orders.overdue}
              icon="running_with_errors"
              note="Planejadas no passado e ainda não concluídas"
              tone={data.orders.overdue > 0 ? "red" : "green"}
            />
          </section>

          <section className="sg-dashboard-pulse">
            <div><span className="material-symbols-outlined">precision_manufacturing</span><strong>{data.equipment}</strong><small>Equipamentos</small></div>
            <div><span className="material-symbols-outlined">build_circle</span><strong>{data.orders.open}</strong><small>OMs em aberto</small></div>
            <div><span className="material-symbols-outlined">build</span><strong>{data.orders.corrective}</strong><small>Corretivas</small></div>
            <div className={data.equipmentWithoutPlan ? "has-risk" : ""}><span className="material-symbols-outlined">event_busy</span><strong>{data.equipmentWithoutPlan}</strong><small>Sem plano ativo</small></div>
            <div className={data.equipmentRisk.critical ? "has-risk" : ""}><span className="material-symbols-outlined">emergency_home</span><strong>{data.equipmentRisk.critical}</strong><small>Ativos críticos</small></div>
            <div className={data.recommendations.critical ? "has-risk" : ""}><span className="material-symbols-outlined">priority_high</span><strong>{data.recommendations.critical}</strong><small>Recomendações críticas</small></div>
          </section>

          <section className="row g-4">
            <div className="col-xl-8">
              <Card className="h-100 sg-dashboard-chart">
                <ChartTitle title="Ritmo mensal de manutenção" subtitle="Planejadas, concluídas e corretivas ao longo do ano" />
                <Card.Body>
                  <div className="sg-dashboard-chart__canvas">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="sgPlanned" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.blue} stopOpacity={0.35} /><stop offset="95%" stopColor={COLORS.blue} stopOpacity={0.02} /></linearGradient>
                          <linearGradient id="sgDone" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.green} stopOpacity={0.38} /><stop offset="95%" stopColor={COLORS.green} stopOpacity={0.02} /></linearGradient>
                        </defs>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
                        <XAxis dataKey="month" stroke="var(--muted-text)" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} stroke="var(--muted-text)" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Legend />
                        <Area type="monotone" dataKey="Planejadas" stroke={COLORS.blue} strokeWidth={2.5} fill="url(#sgPlanned)" />
                        <Area type="monotone" dataKey="Concluídas" stroke={COLORS.green} strokeWidth={2.5} fill="url(#sgDone)" />
                        <Area type="monotone" dataKey="Corretivas" stroke={COLORS.orange} strokeWidth={2} fill="transparent" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </div>
            <div className="col-xl-4">
              <Card className="h-100 sg-dashboard-chart">
                <ChartTitle title="Qualidade da aderência" subtitle="Composição das ocorrências esperadas até hoje" />
                <Card.Body>
                  {adherenceData.length ? (
                    <div className="sg-dashboard-chart__canvas">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={adherenceData} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="78%" paddingAngle={2}>
                            {adherenceData.map((item) => <Cell key={item.name} fill={item.color} />)}
                          </Pie>
                          <Tooltip />
                          <Legend iconType="circle" />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : <div className="sg-dashboard-empty">Sem ocorrências previstas para calcular a aderência.</div>}
                </Card.Body>
              </Card>
            </div>
          </section>

          <section className="row g-4">
            <div className="col-lg-6">
              <Card className="h-100 sg-dashboard-chart">
                <ChartTitle title="Ordens por status" subtitle={`${data.orders.total} ordens no período selecionado`} />
                <Card.Body>
                  <div className="sg-dashboard-chart__canvas sg-dashboard-chart__canvas--bars">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusData} layout="vertical" margin={{ left: 18, right: 16 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} hide />
                        <YAxis type="category" dataKey="name" width={132} tick={{ fill: "var(--muted-text)", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Ordens" radius={[0, 7, 7, 0]}>
                          {statusData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </div>
            <div className="col-lg-6">
              <Card className="h-100 sg-dashboard-chart">
                <ChartTitle title="Perfil de manutenção" subtitle="Distribuição das ordens por tipo de intervenção" />
                <Card.Body>
                  <div className="sg-dashboard-chart__canvas sg-dashboard-chart__canvas--bars">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeData} margin={{ left: -14, right: 8 }}>
                        <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "var(--muted-text)", fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} tick={{ fill: "var(--muted-text)", fontSize: 11 }} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" name="Ordens" radius={[7, 7, 0, 0]}>
                          {typeData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </div>
          </section>

          <section className="sg-dashboard-alerts">
            <div className="sg-dashboard-alerts__header">
              <div>
                <span>Foco gerencial</span>
                <h3>Pontos que pedem ação</h3>
              </div>
              <Link to="/sentinelgrid/maintenance-orders">Ver ordens de manutenção →</Link>
            </div>
            <div className="sg-dashboard-alert-grid">
              <Link to="/sentinelgrid/auditor/client">
                <span className="material-symbols-outlined">calendar_month</span>
                <strong>{data.adherence.lacunas}</strong>
                <div><b>Lacunas no cronograma</b><small>Ocorrências passadas que não possuem OM correspondente.</small></div>
              </Link>
              <Link to="/sentinelgrid/recommendations">
                <span className="material-symbols-outlined">recommend</span>
                <strong>{data.recommendations.open}</strong>
                <div><b>Recomendações abertas</b><small>{data.recommendations.overdue} vencidas e {data.recommendations.critical} críticas.</small></div>
              </Link>
              <Link to="/sentinelgrid/equipment">
                <span className="material-symbols-outlined">shield_with_heart</span>
                <strong>{data.equipmentRisk.attention}</strong>
                <div><b>Ativos em atenção</b><small>Equipamentos fora do estado operacional normal.</small></div>
              </Link>
              <Link to="/sentinelgrid/schedule">
                <span className="material-symbols-outlined">event_repeat</span>
                <strong>{data.overdue}</strong>
                <div><b>Eventos vencidos</b><small>Entradas planejadas no calendário que ainda estão pendentes.</small></div>
              </Link>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
