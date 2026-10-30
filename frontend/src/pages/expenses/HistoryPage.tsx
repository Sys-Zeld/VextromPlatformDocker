import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import Pager from "../../components/sentinelgrid/Pager";
import { listAllHistory, listMyHistory } from "../../api/expenses";
import { ACTION_LABEL, PageHeader, STATUS_LABEL, errorMessage, formatDateTime } from "./shared";

const PAGE_SIZE = 30;

// Usuário: acompanhamento dos próprios relatórios. Gestão: histórico de aprovações.
export default function HistoryPage({ admin = false }: { admin?: boolean }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", admin ? "admin-history" : "my-history", page],
    queryFn: () => (admin ? listAllHistory : listMyHistory)({ page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });
  const base = admin ? "/expenses/admin/reports" : "/expenses/reports";

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title={admin ? "Histórico de aprovações" : "Histórico e acompanhamento"}
        subtitle={admin ? "Todas as decisões e movimentações de status." : "Movimentações dos seus relatórios."}
      />
      <Card>
        {isLoading ? <Card.Body><Spinner animation="border" size="sm" /></Card.Body> : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert></Card.Body>
        ) : (
          <>
            <Table responsive hover className="mb-0 align-middle">
              <thead>
                <tr><th>Data</th><th>Relatório</th>{admin && <th>Solicitante</th>}<th>Ação</th><th>Status</th><th>Responsável</th><th>Justificativa</th></tr>
              </thead>
              <tbody>
                {(data?.history ?? []).length === 0 && <tr><td colSpan={admin ? 7 : 6} className="text-muted">Nenhuma movimentação.</td></tr>}
                {(data?.history ?? []).map((h) => (
                  <tr key={h.id}>
                    <td className="text-nowrap">{formatDateTime(h.created_at)}</td>
                    <td><Link to={`${base}/${h.report_id}`}>{h.report_number}</Link><div className="small text-muted">{h.title}</div></td>
                    {admin && <td>{h.requester_name || h.requester_username}</td>}
                    <td>{ACTION_LABEL[h.action] || h.action}</td>
                    <td className="text-nowrap">{h.previous_status ? STATUS_LABEL[h.previous_status] : "-"} → {STATUS_LABEL[h.new_status]}</td>
                    <td>{h.performed_by_name}</td>
                    <td className="small">{h.reason || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
