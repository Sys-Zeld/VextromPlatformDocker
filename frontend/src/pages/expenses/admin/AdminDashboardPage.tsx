import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Col, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { getAdminDashboard } from "../../../api/expenses";
import { CategoryPie, MonthlyChart, PALETTE, RankingChart, StatusPie } from "../charts";
import { Kpi, PageHeader, Period, PeriodFilter, errorMessage, formatMoney } from "../shared";

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>({ from: "", to: "" });
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", "admin-dashboard", period],
    queryFn: () => getAdminDashboard(period),
    placeholderData: keepPreviousData
  });

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Gestão de despesas"
        subtitle="Indicadores consolidados das solicitações (rascunhos não entram)."
        actions={<>
          <Link to="/expenses/admin/reports?status=ENVIADO" className="btn btn-sm btn-primary">Pendentes de análise</Link>
          <Link to="/expenses/admin/payments" className="btn btn-sm btn-outline-primary">Reembolsos pendentes</Link>
        </>}
      />
      <PeriodFilter value={period} onChange={setPeriod} />

      {isLoading ? <div><Spinner animation="border" size="sm" /> Carregando…</div> : error ? (
        <Alert variant="danger">{errorMessage(error)}</Alert>
      ) : data && (
        <>
          <Row className="g-3">
            <Col xs={6} md={3} xl><Kpi label="Solicitações" value={data.total} icon="receipt_long" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Pendentes de análise" value={data.counts.ENVIADO} icon="pending_actions" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Em análise" value={data.counts.EM_ANALISE} icon="manage_search" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Aprovadas" value={data.counts.APROVADO} icon="task_alt" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Rejeitadas" value={data.counts.REJEITADO} icon="block" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Devolvidas" value={data.counts.DEVOLVIDO} icon="undo" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Pagas" value={data.counts.PAGO} icon="paid" /></Col>
          </Row>
          <Row className="g-3">
            <Col md={4}><Kpi label="Valor total solicitado" value={formatMoney(data.requestedAmount)} icon="request_quote" /></Col>
            <Col md={4}><Kpi label="Aprovado pendente" value={formatMoney(data.approvedUnpaidAmount)} icon="hourglass_top" /></Col>
            <Col md={4}><Kpi label="Valor reembolsado" value={formatMoney(data.reimbursedAmount)} icon="account_balance_wallet" /></Col>
          </Row>
          <Row className="g-4">
            <Col lg={7}><MonthlyChart data={data.charts.monthly} /></Col>
            <Col lg={5}><StatusPie data={data.charts.byStatus ?? []} /></Col>
          </Row>
          <Row className="g-4">
            <Col lg={4}><CategoryPie data={data.charts.byCategory} /></Col>
            <Col lg={4}><RankingChart title="Despesas por usuário" data={data.charts.byUser ?? []} /></Col>
            <Col lg={4}><RankingChart title="Despesas por projeto" data={data.charts.byProject ?? []} color={PALETTE[2]} /></Col>
          </Row>
        </>
      )}
    </div>
  );
}
