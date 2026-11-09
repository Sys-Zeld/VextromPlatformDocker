import { useQuery } from "@tanstack/react-query";
import { Alert, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { getDashboard } from "../../../api/expenses";
import { errorMessage, formatMoney } from "../shared";
import { useMobileTopbar } from "./MobileShell";
import { ReportCard } from "./MobileReportsPage";

// Painel do colaborador: valores e situação dos relatórios. Os gráficos ficam
// na versão completa — aqui só o que se lê de relance.
export default function MobileDashboardPage() {
  useMobileTopbar("Painel");
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", "dashboard", { from: "", to: "" }],
    queryFn: () => getDashboard({})
  });

  if (isLoading) return <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error || !data) return <Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert>;

  const c = data.counts;
  const tiles = [
    { label: "Rascunhos", value: c.RASCUNHO },
    { label: "Devolvidos", value: c.DEVOLVIDO, alert: c.DEVOLVIDO > 0 },
    { label: "Em análise", value: c.ENVIADO + c.EM_ANALISE },
    { label: "Aprovados", value: c.APROVADO },
    { label: "Pagos", value: c.PAGO },
    { label: "Rejeitados", value: c.REJEITADO }
  ];

  return (
    <>
      <div className="exm-card">
        <div className="exm-card__row py-1">
          <span className="exm-card__meta">Valor solicitado</span>
          <span className="exm-card__amount">{formatMoney(data.requestedAmount)}</span>
        </div>
        <div className="exm-card__row py-1">
          <span className="exm-card__meta">Aprovado, a receber</span>
          <span className="exm-card__amount">{formatMoney(data.approvedUnpaidAmount)}</span>
        </div>
        <div className="exm-card__row py-1">
          <span className="exm-card__meta">Reembolsado</span>
          <span className="exm-card__amount text-success">{formatMoney(data.reimbursedAmount)}</span>
        </div>
      </div>

      <h2 className="exm-section-title">Meus relatórios ({data.total})</h2>
      <div className="exm-kpis">
        {tiles.map((t) => (
          <div key={t.label} className={`exm-kpi${t.alert ? " is-alert" : ""}`}>
            <div className="exm-kpi__value">{t.value}</div>
            <div className="exm-kpi__label">{t.label}</div>
          </div>
        ))}
      </div>

      {(data.recent ?? []).length > 0 && (
        <>
          <div className="d-flex justify-content-between align-items-end">
            <h2 className="exm-section-title">Recentes</h2>
            <Link to="/expenses/m" className="small">Ver todos</Link>
          </div>
          {(data.recent ?? []).slice(0, 5).map((r) => <ReportCard key={r.id} report={r} />)}
        </>
      )}
    </>
  );
}
