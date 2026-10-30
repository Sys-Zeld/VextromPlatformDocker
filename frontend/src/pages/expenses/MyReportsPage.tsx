import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Form, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import Pager from "../../components/sentinelgrid/Pager";
import { listMyReports } from "../../api/expenses";
import { PageHeader, ReportsTable, STATUS_LABEL, errorMessage } from "./shared";

const PAGE_SIZE = 20;

export default function MyReportsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", "my-reports", search, status, page],
    queryFn: () => listMyReports({ search, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Meus Relatórios"
        actions={<Link to="/expenses/reports/new" className="btn btn-sm btn-primary">Novo Relatório de Despesas</Link>}
      />
      <Card>
        <Card.Header className="d-flex gap-2 flex-wrap align-items-center">
          <Form.Control
            size="sm"
            style={{ maxWidth: 280 }}
            placeholder="Buscar por número ou título"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <Form.Select size="sm" style={{ maxWidth: 200 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Form.Select>
        </Card.Header>
        {isLoading ? (
          <Card.Body><Spinner animation="border" size="sm" /> Carregando…</Card.Body>
        ) : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert></Card.Body>
        ) : (
          <>
            <ReportsTable
              reports={data?.reports ?? []}
              columns={["number", "title", "period", "total", "status", "created"]}
              linkTo={(r) => `/expenses/reports/${r.id}`}
              empty="Você ainda não tem relatórios. Crie o primeiro em “Novo Relatório de Despesas”."
            />
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
