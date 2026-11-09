import { Card } from "react-bootstrap";
import {
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
import { ExpenseStatus } from "../../api/expenses";
import { STATUS_LABEL, formatMoney } from "./shared";

// Mesma paleta categórica do Analytics (identidade Vextrom).
export const PALETTE = ["#4F7F2A", "#0E6BA8", "#DFAE18", "#C93F3F", "#8B5CF6", "#5F686D", "#E6512E"];

// Gráficos só exibem — os valores vêm prontos do servidor (string decimal).
const toNumber = (v: string) => Number(v);
const moneyTick = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k` : String(v));
const moneyTooltip = (v: number) => formatMoney(v.toFixed(2));

function ChartCard({ title, children, empty }: { title: string; children: JSX.Element; empty: boolean }) {
  return (
    <Card className="h-100">
      <Card.Header>{title}</Card.Header>
      <Card.Body style={{ height: 300 }}>
        {empty ? <div className="h-100 d-flex align-items-center justify-content-center text-muted small">Sem dados no período.</div> : (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        )}
      </Card.Body>
    </Card>
  );
}

export function MonthlyChart({ data }: { data: { month: string; amount: string }[] }) {
  const rows = data.map((d) => ({ month: `${d.month.slice(5)}/${d.month.slice(0, 4)}`, valor: toNumber(d.amount) }));
  return (
    <ChartCard title="Despesas mensais" empty={!rows.length}>
      <BarChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis tickFormatter={moneyTick} />
        <Tooltip formatter={moneyTooltip} />
        <Bar dataKey="valor" name="Valor" fill={PALETTE[0]} />
      </BarChart>
    </ChartCard>
  );
}

export function RankingChart({ title, data, color = PALETTE[1] }: { title: string; data: { label: string; amount: string }[]; color?: string }) {
  const rows = data.slice(0, 10).map((d) => ({ name: d.label, valor: toNumber(d.amount) }));
  return (
    <ChartCard title={title} empty={!rows.length}>
      <BarChart data={rows} layout="vertical" margin={{ left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tickFormatter={moneyTick} />
        <YAxis type="category" dataKey="name" width={130} />
        <Tooltip formatter={moneyTooltip} />
        <Bar dataKey="valor" name="Valor" fill={color} />
      </BarChart>
    </ChartCard>
  );
}

export function CategoryPie({ data }: { data: { label: string; amount: string }[] }) {
  const rows = data.map((d) => ({ name: d.label, value: toNumber(d.amount) }));
  return (
    <ChartCard title="Despesas por categoria" empty={!rows.length}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" outerRadius={100}>
          {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip formatter={moneyTooltip} />
        <Legend />
      </PieChart>
    </ChartCard>
  );
}

export function StatusPie({ data }: { data: { status: ExpenseStatus; count: number }[] }) {
  const rows = data.map((d) => ({ name: STATUS_LABEL[d.status], value: d.count }));
  return (
    <ChartCard title="Distribuição por status" empty={!rows.length}>
      <PieChart>
        <Pie data={rows} dataKey="value" nameKey="name" outerRadius={100} label>
          {rows.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ChartCard>
  );
}
