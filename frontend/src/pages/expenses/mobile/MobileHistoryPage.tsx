import { useInfiniteQuery } from "@tanstack/react-query";
import { Alert, Button, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { listMyHistory } from "../../../api/expenses";
import { ACTION_LABEL, STATUS_LABEL, errorMessage, formatDateTime } from "../shared";
import { useMobileTopbar } from "./MobileShell";

const PAGE_SIZE = 30;

// Movimentações dos relatórios do colaborador (envios, decisões, pagamentos).
export default function MobileHistoryPage() {
  useMobileTopbar("Histórico", "/expenses/m/more");
  const q = useInfiniteQuery({
    queryKey: ["expenses", "my-history", "mobile"],
    queryFn: ({ pageParam }) => listMyHistory({ page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined)
  });
  const history = q.data?.pages.flatMap((p) => p.history) ?? [];

  if (q.isLoading) return <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (q.error) return <Alert variant="danger" className="mb-0">{errorMessage(q.error)}</Alert>;

  return (
    <>
      {history.length === 0 && <p className="text-muted text-center py-5 mb-0">Nenhuma movimentação ainda.</p>}
      {history.map((h) => (
        <Link key={h.id} to={`/expenses/m/reports/${h.report_id}`} className="exm-card">
          <div className="exm-card__row">
            <span className="exm-card__meta">{h.report_number}</span>
            <span className="exm-card__meta">{formatDateTime(h.created_at)}</span>
          </div>
          <div className="exm-card__title">{ACTION_LABEL[h.action] || h.action}</div>
          <div className="exm-card__meta">
            {h.previous_status ? `${STATUS_LABEL[h.previous_status]} → ` : ""}{STATUS_LABEL[h.new_status]} · {h.performed_by_name}
          </div>
          {h.reason && <div className="small mt-1" style={{ whiteSpace: "pre-line" }}>{h.reason}</div>}
        </Link>
      ))}
      {q.hasNextPage && (
        <Button variant="outline-secondary" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? <Spinner animation="border" size="sm" /> : "Carregar mais"}
        </Button>
      )}
    </>
  );
}
