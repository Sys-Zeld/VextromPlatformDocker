import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Nav, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import Pager from "../../../components/sentinelgrid/Pager";
import { listPayments, listPendingReimbursements } from "../../../api/expenses";
import { formatDate } from "../../../utils/format";
import { PageHeader, Period, PeriodFilter, ReportsTable, errorMessage, formatMoney } from "../shared";

const PAGE_SIZE = 20;

// "Reembolsos pendentes" (aprovados a pagar) e "Histórico de pagamentos".
export default function PaymentsPage() {
  const [tab, setTab] = useState<"pending" | "paid">("pending");
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<Period>({ from: "", to: "" });

  const pending = useQuery({
    queryKey: ["expenses", "pending-reimbursements", page],
    queryFn: () => listPendingReimbursements({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: tab === "pending"
  });
  const paid = useQuery({
    queryKey: ["expenses", "payments", page, period],
    queryFn: () => listPayments({ page, pageSize: PAGE_SIZE, ...period }),
    placeholderData: keepPreviousData,
    enabled: tab === "paid"
  });
  const active = tab === "pending" ? pending : paid;

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader title="Reembolsos" subtitle="Relatórios aprovados aguardando pagamento e pagamentos já registrados." />
      <Nav variant="tabs" activeKey={tab} onSelect={(k) => { setTab((k as "pending" | "paid") || "pending"); setPage(1); }}>
        <Nav.Item><Nav.Link eventKey="pending">Reembolsos pendentes</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="paid">Histórico de pagamentos</Nav.Link></Nav.Item>
      </Nav>
      {tab === "paid" && <PeriodFilter value={period} onChange={(p) => { setPeriod(p); setPage(1); }} />}
      <Card>
        {active.isLoading ? <Card.Body><Spinner animation="border" size="sm" /> Carregando…</Card.Body> : active.error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(active.error)}</Alert></Card.Body>
        ) : tab === "pending" ? (
          <>
            <ReportsTable
              reports={pending.data?.reports ?? []}
              columns={["number", "requester", "title", "approved", "approvedAt", "status"]}
              linkTo={(r) => `/expenses/admin/reports/${r.id}`}
              actionLabel="Pagar"
              empty="Nenhum reembolso pendente."
            />
            <Pager page={page} pageSize={PAGE_SIZE} total={pending.data?.total ?? 0} onPageChange={setPage} />
          </>
        ) : (
          <>
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr><th>Data</th><th>Relatório</th><th>Solicitante</th><th>Forma</th><th>Referência</th><th className="text-end">Valor</th><th>Registrado por</th></tr>
              </thead>
              <tbody>
                {(paid.data?.payments ?? []).length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum pagamento no período.</td></tr>}
                {(paid.data?.payments ?? []).map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.payment_date)}</td>
                    <td><Link to={`/expenses/admin/reports/${p.report_id}`}>{p.report_number}</Link></td>
                    <td>{p.requester_name || p.requester_username}</td>
                    <td>{p.payment_method}</td>
                    <td>{p.transaction_reference || "-"}</td>
                    <td className="text-end text-nowrap">{formatMoney(p.amount)}</td>
                    <td>{p.recorded_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager page={page} pageSize={PAGE_SIZE} total={paid.data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
