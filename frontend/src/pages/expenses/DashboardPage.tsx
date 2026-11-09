import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import { getDashboard } from "../../api/expenses";
import { CategoryPie, MonthlyChart } from "./charts";
import { Kpi, PageHeader, Period, PeriodFilter, ReportsTable, errorMessage, formatMoney } from "./shared";

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>({ from: "", to: "" });
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", "dashboard", period],
    queryFn: () => getDashboard(period),
    placeholderData: keepPreviousData
  });

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Minhas despesas"
        subtitle="Acompanhe seus relatórios e reembolsos."
        actions={<Link to="/expenses/reports/new" className="btn btn-primary">Novo Relatório de Despesas</Link>}
      />
      <PeriodFilter value={period} onChange={setPeriod} />

      {isLoading ? <div><Spinner animation="border" size="sm" /> Carregando…</div> : error ? (
        <Alert variant="danger">{errorMessage(error)}</Alert>
      ) : data && (
        <>
          <Row className="g-3">
            <Col xs={6} md={3} xl><Kpi label="Relatórios" value={data.total} icon="receipt_long" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Rascunhos" value={data.counts.RASCUNHO} icon="draft" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Enviados" value={data.counts.ENVIADO} icon="send" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Em análise" value={data.counts.EM_ANALISE} icon="manage_search" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Devolvidos" value={data.counts.DEVOLVIDO} icon="undo" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Aprovados" value={data.counts.APROVADO} icon="task_alt" /></Col>
            <Col xs={6} md={3} xl><Kpi label="Pagos" value={data.counts.PAGO} icon="paid" /></Col>
          </Row>
          <Row className="g-3">
            <Col md={4}><Kpi label="Valor solicitado" value={formatMoney(data.requestedAmount)} icon="request_quote" /></Col>
            <Col md={4}><Kpi label="Aprovado e não pago" value={formatMoney(data.approvedUnpaidAmount)} icon="hourglass_top" /></Col>
            <Col md={4}><Kpi label="Valor reembolsado" value={formatMoney(data.reimbursedAmount)} icon="account_balance_wallet" /></Col>
          </Row>
          <Row className="g-4">
            <Col lg={7}><MonthlyChart data={data.charts.monthly} /></Col>
            <Col lg={5}><CategoryPie data={data.charts.byCategory} /></Col>
          </Row>
          <Card>
            <Card.Header className="d-flex justify-content-between">
              <span>Relatórios recentes</span>
              <Link to="/expenses/reports" className="small">Ver todos</Link>
            </Card.Header>
            <ReportsTable
              reports={data.recent ?? []}
              columns={["number", "title", "period", "total", "status"]}
              linkTo={(r) => `/expenses/reports/${r.id}`}
            />
          </Card>
        </>
      )}
    </div>
  );
}
