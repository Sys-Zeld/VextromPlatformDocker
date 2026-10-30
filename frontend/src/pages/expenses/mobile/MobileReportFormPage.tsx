import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { ReportInput, createReport, getReport, updateReport } from "../../../api/expenses";
import ReportForm, { EMPTY_REPORT, isReportFormValid } from "../ReportForm";
import { errorMessage } from "../shared";
import { useMobileTopbar } from "./MobileShell";

// Criação (sem :id) e edição do cabeçalho do relatório.
export default function MobileReportFormPage() {
  const { id } = useParams();
  const reportId = id ? Number(id) : null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<ReportInput>(EMPTY_REPORT);
  useMobileTopbar(reportId ? "Editar relatório" : "Novo relatório", reportId ? `/expenses/m/reports/${reportId}` : "/expenses/m");

  const detail = useQuery({
    queryKey: ["expenses", "report", reportId],
    queryFn: () => getReport(reportId!),
    enabled: reportId !== null
  });
  useEffect(() => {
    const r = detail.data?.report;
    if (!r) return;
    setForm({
      title: r.title,
      description: r.description || "",
      projectName: r.project_name || "",
      costCenter: r.cost_center || "",
      startDate: String(r.start_date).slice(0, 10),
      endDate: String(r.end_date).slice(0, 10)
    });
  }, [detail.data]);

  const m = useMutation({
    mutationFn: () => (reportId ? updateReport(reportId, form) : createReport(form)),
    onSuccess: ({ report }) => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      navigate(`/expenses/m/reports/${report.id}`, { replace: true });
    }
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isReportFormValid(form) && !m.isPending) m.mutate();
  };

  if (reportId && detail.isLoading) return <div className="text-muted"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (detail.error) return <Alert variant="danger" className="mb-0">{errorMessage(detail.error)}</Alert>;
  if (detail.data && !detail.data.permissions.canEdit) {
    return <Alert variant="warning" className="mb-0">Este relatório não pode mais ser editado.</Alert>;
  }

  return (
    <Form onSubmit={onSubmit} className="d-flex flex-column gap-3">
      {!reportId && <p className="text-muted small mb-0">O relatório é criado como rascunho. Depois, inclua as despesas e os recibos.</p>}
      {m.error && <Alert variant="danger" className="mb-0">{errorMessage(m.error)}</Alert>}
      <ReportForm value={form} onChange={setForm} />
      <div className="exm-actionbar">
        <Button type="submit" disabled={!isReportFormValid(form) || m.isPending}>
          {m.isPending ? <Spinner animation="border" size="sm" /> : reportId ? "Salvar" : "Criar relatório"}
        </Button>
      </div>
    </Form>
  );
}
