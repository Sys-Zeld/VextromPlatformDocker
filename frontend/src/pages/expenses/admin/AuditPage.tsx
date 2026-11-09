import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Form, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import Pager from "../../../components/sentinelgrid/Pager";
import { listAudit } from "../../../api/expenses";
import { PageHeader, errorMessage, formatDateTime } from "../shared";

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  REPORT_CREATED: "Relatório criado",
  REPORT_UPDATED: "Relatório alterado",
  REPORT_DELETED: "Rascunho excluído",
  REPORT_SUBMIT: "Enviado",
  REPORT_RESUBMIT: "Reenviado",
  REPORT_START_REVIEW: "Análise iniciada",
  REPORT_APPROVE: "Aprovado",
  REPORT_REJECT: "Rejeitado",
  REPORT_RETURN: "Devolvido",
  REPORT_EXPORTED: "Exportado",
  ITEM_CREATED: "Despesa incluída",
  ITEM_UPDATED: "Despesa alterada",
  ITEM_DELETED: "Despesa excluída",
  ATTACHMENT_UPLOADED: "Comprovante enviado",
  ATTACHMENT_DELETED: "Comprovante removido",
  PAYMENT_RECORDED: "Pagamento registrado",
  BANK_DETAILS_VIEWED: "Dados bancários consultados",
  PROFILE_CREATED: "Perfil criado",
  PROFILE_UPDATED: "Perfil alterado"
};

// Trilha de auditoria (somente leitura; o banco impede alteração/exclusão).
export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", "audit", search, page],
    queryFn: () => listAudit({ search, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData
  });

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader title="Auditoria" subtitle="Todas as operações relevantes do módulo, em ordem cronológica inversa." />
      <Card>
        <Card.Header>
          <Form.Control size="sm" style={{ maxWidth: 320 }} placeholder="Número do relatório, usuário ou ação"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </Card.Header>
        {isLoading ? <Card.Body><Spinner animation="border" size="sm" /></Card.Body> : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert></Card.Body>
        ) : (
          <>
            <Table responsive hover className="mb-0 align-middle small">
              <thead><tr><th>Data</th><th>Relatório</th><th>Usuário</th><th>Operação</th><th>Status</th><th>Justificativa</th><th>Detalhes</th></tr></thead>
              <tbody>
                {(data?.entries ?? []).length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum evento.</td></tr>}
                {(data?.entries ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="text-nowrap">{formatDateTime(e.created_at)}</td>
                    <td>{e.report_id ? <Link to={`/expenses/admin/reports/${e.report_id}`}>{e.report_number}</Link> : "-"}</td>
                    <td>{e.actor_name}</td>
                    <td>{ACTION_LABELS[e.action] || e.action}</td>
                    <td className="text-nowrap">{e.previous_status || e.new_status ? `${e.previous_status || "-"} → ${e.new_status || "-"}` : "-"}</td>
                    <td>{e.reason || "-"}</td>
                    <td><code className="small text-wrap" style={{ wordBreak: "break-all" }}>{Object.keys(e.metadata || {}).length ? JSON.stringify(e.metadata) : ""}</code></td>
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
