import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Spinner } from "react-bootstrap";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ExpenseItem, checkSubmission, deleteReport, getReport, submitReport } from "../../../api/expenses";
import { confirmDialog } from "../../../components/ConfirmDialog";
import { formatDate } from "../../../utils/format";
import { StatusBadge, errorMessage, formatMoney, formatPeriod } from "../shared";
import { useMobileTopbar } from "./MobileShell";
import { setViewPreference } from "./uiMode";

// Resumo do relatório, despesas em cards e as ações do colaborador
// (adicionar despesa, enviar para aprovação, excluir rascunho).
export default function MobileReportPage() {
  const reportId = Number(useParams().id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", "report", reportId],
    queryFn: () => getReport(reportId),
    enabled: Number.isFinite(reportId)
  });
  // Volta para onde veio (lista filtrada, painel); sem origem, para a lista.
  const from = (useLocation().state as { from?: string } | null)?.from;
  useMobileTopbar(data?.report.report_number ?? "Relatório", from?.startsWith("/expenses/m") ? from : "/expenses/m");

  const mSubmit = useMutation({
    mutationFn: () => submitReport(reportId),
    onSuccess: () => { setIssues([]); setActionError(null); qc.invalidateQueries({ queryKey: ["expenses"] }); },
    onError: async (e) => {
      setActionError(errorMessage(e));
      // O servidor bloqueou: busca a lista do que falta para mostrar.
      const check = await checkSubmission(reportId).catch(() => null);
      if (check) setIssues(check.issues);
    }
  });
  const mDelete = useMutation({
    mutationFn: () => deleteReport(reportId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); navigate("/expenses/m", { replace: true }); },
    onError: (e) => setActionError(errorMessage(e))
  });

  if (isLoading) return <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error || !data) return <Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert>;

  const { report: r, items, attachments, permissions } = data;
  const receiptsOf = (itemId: number) => attachments.filter((a) => a.item_id === itemId).length;
  const canSubmit = permissions.actions.includes("SUBMIT") || permissions.actions.includes("RESUBMIT");
  const needsBankData = issues.some((i) => i.startsWith("Cadastro de reembolso"));

  const onSubmit = async () => {
    const label = r.status === "DEVOLVIDO" ? "Reenviar" : "Enviar";
    if (await confirmDialog(`${label} o relatório ${r.report_number} para aprovação? Depois disso ele não poderá ser alterado.`)) mSubmit.mutate();
  };
  const onDelete = async () => {
    if (await confirmDialog(`Excluir o relatório ${r.report_number}?`)) mDelete.mutate();
  };
  // Dados bancários ficam só na versão completa.
  const openBankData = () => {
    setViewPreference("desktop");
    window.location.href = "/app/expenses/profile";
  };

  return (
    <>
      {(r.status === "DEVOLVIDO" || r.status === "REJEITADO") && r.last_decision_reason && (
        <Alert variant={r.status === "DEVOLVIDO" ? "warning" : "danger"} className="mb-0">
          <strong>{r.status === "DEVOLVIDO" ? "Devolvido para correção" : "Rejeitado"}:</strong> {r.last_decision_reason}
        </Alert>
      )}
      {actionError && (
        <Alert variant="danger" className="mb-0">
          {actionError}
          {issues.length > 0 && <ul className="mb-0 mt-1 ps-3">{issues.map((i) => <li key={i}>{i}</li>)}</ul>}
          {needsBankData && (
            <Button size="sm" variant="outline-danger" className="mt-2" onClick={openBankData}>Completar dados bancários (versão completa)</Button>
          )}
        </Alert>
      )}
      {mSubmit.isSuccess && <Alert variant="success" className="mb-0">Relatório enviado para aprovação.</Alert>}

      <div className="exm-card">
        <div className="exm-card__row">
          <StatusBadge status={r.status} />
          {permissions.canEdit && (
            <Link to={`/expenses/m/reports/${r.id}/edit`} className="btn btn-sm btn-outline-secondary">
              <span className="material-symbols-outlined align-middle" style={{ fontSize: 18 }}>edit</span> Editar
            </Link>
          )}
        </div>
        <div className="exm-card__title">{r.title}</div>
        <div className="exm-card__meta">{formatPeriod(r)}</div>
        {(r.project_name || r.cost_center) && (
          <div className="exm-card__meta">{[r.project_name, r.cost_center].filter(Boolean).join(" · ")}</div>
        )}
        <div className="exm-card__row mt-2">
          <span className="exm-card__meta">Total</span>
          <span className="exm-card__amount fs-5">{formatMoney(r.total_amount)}</span>
        </div>
      </div>

      <h2 className="exm-section-title">Despesas ({items.length})</h2>
      {items.length === 0 && (
        <p className="text-muted small mb-0">
          Nenhuma despesa lançada.{permissions.canEdit && " Toque em Adicionar despesa e fotografe o recibo."}
        </p>
      )}
      {items.map((i) => (
        <ItemCard key={i.id} item={i} receipts={receiptsOf(i.id)} to={permissions.canEdit ? `/expenses/m/reports/${r.id}/items/${i.id}` : null} />
      ))}

      {permissions.canDelete && (
        <Button variant="link" className="text-danger align-self-center" disabled={mDelete.isPending} onClick={onDelete}>Excluir relatório</Button>
      )}

      {(permissions.canEdit || canSubmit) && (
        <div className="exm-actionbar">
          {permissions.canEdit && (
            <Link to={`/expenses/m/reports/${r.id}/items/new`} className="btn btn-outline-primary d-inline-flex align-items-center justify-content-center gap-1">
              <span className="material-symbols-outlined">add_a_photo</span>Adicionar despesa
            </Link>
          )}
          {canSubmit && (
            <Button disabled={mSubmit.isPending || items.length === 0} onClick={onSubmit}>
              {mSubmit.isPending ? <Spinner animation="border" size="sm" /> : r.status === "DEVOLVIDO" ? "Reenviar" : "Enviar para aprovação"}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

function ItemCard({ item: i, receipts, to }: { item: ExpenseItem; receipts: number; to: string | null }) {
  const body = (
    <>
      <div className="exm-card__row">
        <span className="exm-card__meta">{formatDate(i.expense_date)} · {i.category_name}</span>
        <span className="exm-card__amount">{formatMoney(i.amount)}</span>
      </div>
      <div className="exm-card__title">{i.description}</div>
      <div className={`exm-card__meta${receipts ? "" : " text-danger"}`}>
        <span className="material-symbols-outlined align-middle" style={{ fontSize: 16 }}>receipt</span>{" "}
        {receipts ? `${receipts} recibo(s)` : "Sem recibo"}
      </div>
    </>
  );
  return to ? <Link to={to} className="exm-card">{body}</Link> : <div className="exm-card">{body}</div>;
}
