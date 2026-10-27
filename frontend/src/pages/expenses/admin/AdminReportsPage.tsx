import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Alert, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import Pager from "../../../components/sentinelgrid/Pager";
import { listAllReports } from "../../../api/expenses";
import { PageHeader, ReportsTable, STATUS_LABEL, errorMessage, useExpensesMeta } from "../shared";

const PAGE_SIZE = 20;

// "Todos os relatórios" e "Relatórios pendentes" (via ?status=ENVIADO).
export default function AdminReportsPage() {
  const [params, setParams] = useSearchParams();
  const meta = useExpensesMeta();
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState("submitted_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const status = params.get("status") || "";

  const filters = { search, project, categoryId, from, to, status, sort, dir, page, pageSize: PAGE_SIZE };
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", "admin-reports", filters],
    queryFn: () => listAllReports(filters),
    placeholderData: keepPreviousData
  });

  const reset = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
  const setStatus = (value: string) => {
    setPage(1);
    setParams(value ? { status: value } : {});
  };
  const pending = status === "ENVIADO";

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title={pending ? "Relatórios pendentes" : "Todos os relatórios"}
        subtitle={pending ? "Enviados e aguardando início da análise." : "Solicitações de todos os usuários (rascunhos não aparecem)."}
      />
      <Card>
        <Card.Body>
          <Row className="g-2">
            <Col md={3}>
              <Form.Label className="small mb-1">Número ou solicitante</Form.Label>
              <Form.Control size="sm" value={search} onChange={(e) => reset(setSearch)(e.target.value)} />
            </Col>
            <Col md={2}>
              <Form.Label className="small mb-1">Status</Form.Label>
              <Form.Select size="sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos (exceto rascunho)</option>
                {Object.entries(STATUS_LABEL).filter(([v]) => v !== "RASCUNHO").map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="small mb-1">Projeto</Form.Label>
              <Form.Control size="sm" value={project} onChange={(e) => reset(setProject)(e.target.value)} />
            </Col>
            <Col md={2}>
              <Form.Label className="small mb-1">Categoria</Form.Label>
              <Form.Select size="sm" value={categoryId} onChange={(e) => reset(setCategoryId)(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Todas</option>
                {(meta.data?.categories ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} md={1}>
              <Form.Label className="small mb-1">De</Form.Label>
              <Form.Control size="sm" type="date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
            </Col>
            <Col xs={6} md={1}>
              <Form.Label className="small mb-1">Até</Form.Label>
              <Form.Control size="sm" type="date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
            </Col>
            <Col md={1}>
              <Form.Label className="small mb-1">Ordenar</Form.Label>
              <Form.Select size="sm" value={`${sort}:${dir}`} onChange={(e) => {
                const [s, d] = e.target.value.split(":");
                setSort(s); setDir(d as "asc" | "desc"); setPage(1);
              }}>
                <option value="submitted_at:desc">Envio ↓</option>
                <option value="submitted_at:asc">Envio ↑</option>
                <option value="total_amount:desc">Valor ↓</option>
                <option value="total_amount:asc">Valor ↑</option>
                <option value="report_number:desc">Número ↓</option>
                <option value="status:asc">Status</option>
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      <Card>
        {isLoading ? <Card.Body><Spinner animation="border" size="sm" /> Carregando…</Card.Body> : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert></Card.Body>
        ) : (
          <>
            <ReportsTable
              reports={data?.reports ?? []}
              columns={["number", "requester", "title", "period", "items", "total", "submitted", "status"]}
              linkTo={(r) => `/expenses/admin/reports/${r.id}`}
              actionLabel="Analisar"
            />
            <Pager page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
