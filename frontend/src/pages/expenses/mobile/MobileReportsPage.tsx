import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Alert, Button, Spinner } from "react-bootstrap";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ExpenseReport, ExpenseStatus, listMyReports } from "../../../api/expenses";
import { STATUS_LABEL, StatusBadge, errorMessage, formatMoney, formatPeriod } from "../shared";
import { useMobileTopbar } from "./MobileShell";

const PAGE_SIZE = 20;
// Rascunho e devolvido pedem ação do colaborador: aparecem primeiro.
const NEEDS_ACTION = new Set(["RASCUNHO", "DEVOLVIDO"]);
// Ordem do filtro: o que pede ação primeiro, depois o fluxo até o pagamento.
const STATUS_FILTERS: ExpenseStatus[] = ["RASCUNHO", "DEVOLVIDO", "ENVIADO", "EM_ANALISE", "APROVADO", "PAGO", "REJEITADO"];

export default function MobileReportsPage() {
  useMobileTopbar("Meus relatórios");
  // Filtro na URL: ao abrir um relatório e voltar, continua aplicado.
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") || "") as ExpenseStatus | "";
  const setStatus = (value: ExpenseStatus | "") => setParams(value ? { status: value } : {}, { replace: true });

  const q = useInfiniteQuery({
    queryKey: ["expenses", "my-reports", "mobile", status],
    queryFn: ({ pageParam }) => listMyReports({ page: pageParam, pageSize: PAGE_SIZE, status }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData
  });

  const reports = q.data?.pages.flatMap((p) => p.reports) ?? [];
  // Sem filtro, separa o que pede ação; com filtro, a lista já é de um status só.
  const pending = status ? [] : reports.filter((r) => NEEDS_ACTION.has(r.status));
  const others = status ? reports : reports.filter((r) => !NEEDS_ACTION.has(r.status));

  return (
    <>
      <div className="exm-chips exm-chips--scroll" role="radiogroup" aria-label="Filtrar por status">
        {[["", "Todos"] as const, ...STATUS_FILTERS.map((s) => [s, STATUS_LABEL[s]] as const)].map(([value, label]) => (
          <button key={value || "all"} type="button" role="radio" aria-checked={status === value}
            className={`exm-chip${status === value ? " is-active" : ""}`} onClick={() => setStatus(value)}>
            {label}
          </button>
        ))}
      </div>

      {q.isLoading && <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>}
      {q.error && <Alert variant="danger" className="mb-0">{errorMessage(q.error)}</Alert>}
      {!q.isLoading && !q.error && reports.length === 0 && (
        status ? (
          <p className="text-center text-muted py-5 mb-0">Nenhum relatório com status <strong>{STATUS_LABEL[status]}</strong>.</p>
        ) : (
          <div className="text-center text-muted py-5">
            <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: 48 }}>receipt_long</span>
            Você ainda não tem relatórios.<br />Toque em <strong>Novo relatório</strong> para começar.
          </div>
        )
      )}

      <div className={`d-flex flex-column gap-3${q.isPlaceholderData ? " opacity-50" : ""}`}>
        {pending.length > 0 && <h2 className="exm-section-title">Em andamento</h2>}
        {pending.map((r) => <ReportCard key={r.id} report={r} />)}
        {!status && others.length > 0 && <h2 className="exm-section-title">Enviados</h2>}
        {others.map((r) => <ReportCard key={r.id} report={r} />)}
      </div>

      {q.hasNextPage && (
        <Button variant="outline-secondary" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? <Spinner animation="border" size="sm" /> : "Carregar mais"}
        </Button>
      )}

      <Link to="/expenses/m/reports/new" className="btn btn-primary exm-fab">
        <span className="material-symbols-outlined">add</span>Novo relatório
      </Link>
    </>
  );
}

// Leva junto a tela de origem (com o filtro), para o "voltar" retornar a ela.
export function ReportCard({ report: r }: { report: ExpenseReport }) {
  const { pathname, search } = useLocation();
  return (
    <Link to={`/expenses/m/reports/${r.id}`} state={{ from: pathname + search }} className="exm-card">
      <div className="exm-card__row">
        <span className="exm-card__meta">{r.report_number}</span>
        <StatusBadge status={r.status} />
      </div>
      <div className="exm-card__title">{r.title}</div>
      <div className="exm-card__row">
        <span className="exm-card__meta">{formatPeriod(r)}</span>
        <span className="exm-card__amount">{formatMoney(r.total_amount)}</span>
      </div>
    </Link>
  );
}
