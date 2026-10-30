import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { ReportInput, createReport } from "../../api/expenses";
import ReportForm, { EMPTY_REPORT, isReportFormValid } from "./ReportForm";
import { PageHeader, errorMessage } from "./shared";

export default function NewReportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<ReportInput>(EMPTY_REPORT);

  const mCreate = useMutation({
    mutationFn: () => createReport(form),
    onSuccess: ({ report }) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      navigate(`/expenses/reports/${report.id}`);
    }
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isReportFormValid(form) && !mCreate.isPending) mCreate.mutate();
  };

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Novo Relatório de Despesas"
        subtitle="O relatório é criado como rascunho. Depois, inclua as despesas e os comprovantes."
        actions={<Link to="/expenses/reports" className="btn btn-sm btn-outline-secondary">Voltar</Link>}
      />
      {mCreate.error && <Alert variant="danger" className="mb-0">{errorMessage(mCreate.error)}</Alert>}
      <Card>
        <Card.Body>
          <Form onSubmit={onSubmit} className="d-flex flex-column gap-3">
            <ReportForm value={form} onChange={setForm} />
            <div className="d-flex justify-content-end">
              <Button type="submit" disabled={!isReportFormValid(form) || mCreate.isPending}>
                {mCreate.isPending ? <Spinner animation="border" size="sm" /> : "Criar relatório"}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
