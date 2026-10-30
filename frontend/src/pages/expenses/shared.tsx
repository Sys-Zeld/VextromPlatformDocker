import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Form, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { ExpenseReport, ExpenseStatus, getMeta } from "../../api/expenses";
import { ApiError } from "../../api/client";
import { formatDate } from "../../utils/format";

// Peças comuns das telas do módulo de Despesas.

export const STATUS_LABEL: Record<ExpenseStatus, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  EM_ANALISE: "Em análise",
  DEVOLVIDO: "Devolvido",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  PAGO: "Pago"
};

const STATUS_VARIANT: Record<ExpenseStatus, string> = {
  RASCUNHO: "secondary",
  ENVIADO: "info",
  EM_ANALISE: "primary",
  DEVOLVIDO: "warning",
  APROVADO: "success",
  REJEITADO: "danger",
  PAGO: "dark"
};

export const ACTION_LABEL: Record<string, string> = {
  SUBMIT: "Envio",
  RESUBMIT: "Reenvio",
  START_REVIEW: "Início da análise",
  APPROVE: "Aprovação",
  REJECT: "Rejeição",
  RETURN: "Devolução",
  PAY: "Pagamento"
};

export function StatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge bg={STATUS_VARIANT[status] || "secondary"}>{STATUS_LABEL[status] || status}</Badge>;
}

// "1234.5" → "R$ 1.234,50", sem passar por ponto flutuante.
export function formatMoney(value?: string | null): string {
  if (value === null || value === undefined || value === "") return "-";
  const [intRaw, dec = ""] = String(value).split(".");
  const negative = intRaw.startsWith("-");
  const intPart = intRaw.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}R$ ${intPart},${(dec + "00").slice(0, 2)}`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("pt-BR");
}

export function formatPeriod(r: Pick<ExpenseReport, "start_date" | "end_date">): string {
  return `${formatDate(r.start_date)} a ${formatDate(r.end_date)}`;
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// Problemas de envio (422) chegam em details.issues — o client só repassa a
// mensagem, então a tela consulta /submission-check para listá-los.
export function isApiError(e: unknown, status: number): boolean {
  return e instanceof ApiError && e.status === status;
}

export function useExpensesMeta() {
  return useQuery({ queryKey: ["expenses", "meta"], queryFn: getMeta, staleTime: 5 * 60_000 });
}

export function Kpi({ label, value, icon, tone }: { label: string; value: ReactNode; icon: string; tone?: string }) {
  return (
    <div className="vx-kpi h-100">
      <div className="d-flex align-items-center gap-3 p-3">
        <span className="vx-kpi__icon" style={tone ? { color: tone } : undefined}>
          <span className="material-symbols-outlined">{icon}</span>
        </span>
        <div className="min-w-0">
          <div className="vx-kpi__value" style={{ fontSize: typeof value === "string" && value.length > 9 ? "1.35rem" : undefined }}>
            {value}
          </div>
          <div className="vx-kpi__label">{label}</div>
        </div>
      </div>
    </div>
  );
}

export interface Period { from: string; to: string }

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="d-flex align-items-end gap-2 flex-wrap">
      <Form.Group>
        <Form.Label className="small mb-1">De</Form.Label>
        <Form.Control size="sm" type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
      </Form.Group>
      <Form.Group>
        <Form.Label className="small mb-1">Até</Form.Label>
        <Form.Control size="sm" type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
      </Form.Group>
      {(value.from || value.to) && (
        <Button size="sm" variant="outline-secondary" onClick={() => onChange({ from: "", to: "" })}>Limpar</Button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div>
        <h2 className="h5 mb-1">{title}</h2>
        {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

type Column = "number" | "requester" | "title" | "period" | "items" | "total" | "approved" | "submitted" | "approvedAt" | "status" | "created";

const COLUMN_LABEL: Record<Column, string> = {
  number: "Número",
  requester: "Solicitante",
  title: "Título",
  period: "Período",
  items: "Despesas",
  total: "Valor total",
  approved: "Valor aprovado",
  submitted: "Envio",
  approvedAt: "Aprovação",
  status: "Status",
  created: "Criação"
};

function cell(r: ExpenseReport, c: Column): ReactNode {
  switch (c) {
    case "number": return <span className="fw-semibold text-nowrap">{r.report_number}</span>;
    case "requester": return r.requester_name || r.requester_username;
    case "title": return r.title;
    case "period": return <span className="text-nowrap">{formatPeriod(r)}</span>;
    case "items": return r.items_count ?? "-";
    case "total": return <span className="text-nowrap">{formatMoney(r.total_amount)}</span>;
    case "approved": return <span className="text-nowrap">{formatMoney(r.approved_amount)}</span>;
    case "submitted": return formatDate(r.submitted_at);
    case "approvedAt": return formatDate(r.approved_at);
    case "status": return <StatusBadge status={r.status} />;
    case "created": return formatDate(r.created_at);
    default: return null;
  }
}

// Tabela de relatórios usada pelas listagens (usuário e gestão).
export function ReportsTable({
  reports,
  columns,
  linkTo,
  actionLabel = "Abrir",
  empty = "Nenhum relatório encontrado."
}: {
  reports: ExpenseReport[];
  columns: Column[];
  linkTo: (r: ExpenseReport) => string;
  actionLabel?: string;
  empty?: string;
}) {
  return (
    <Table responsive hover className="mb-0 align-middle">
      <thead>
        <tr>
          {columns.map((c) => <th key={c} className={c === "total" || c === "approved" ? "text-end" : undefined}>{COLUMN_LABEL[c]}</th>)}
          <th className="text-end">Ações</th>
        </tr>
      </thead>
      <tbody>
        {reports.length === 0 && (
          <tr><td colSpan={columns.length + 1} className="text-muted">{empty}</td></tr>
        )}
        {reports.map((r) => (
          <tr key={r.id}>
            {columns.map((c) => <td key={c} className={c === "total" || c === "approved" ? "text-end" : undefined}>{cell(r, c)}</td>)}
            <td className="text-end">
              <Link to={linkTo(r)} className="btn btn-sm btn-outline-primary text-nowrap">{actionLabel}</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
