import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Card, Form, Spinner } from "react-bootstrap";
import { getReportPreviewHtml, reportPreviewHtmlUrl, type ReportTemplateOption } from "../api/reportEditor";

const ADMIN_BASE = "/admin/report-service";

export default function ReportPreviewPanel(props: {
  orderId: number;
  templates: ReportTemplateOption[];
  defaultTemplateKey: string;
}) {
  const { orderId, templates, defaultTemplateKey } = props;
  const [templateKey, setTemplateKey] = useState(defaultTemplateKey || (templates[0]?.key ?? ""));

  const { data, isFetching, error } = useQuery({
    queryKey: ["report-preview", orderId, templateKey],
    queryFn: () => getReportPreviewHtml(orderId, templateKey),
    staleTime: 0
  });

  const pdfViewUrl = `${ADMIN_BASE}/orders/${orderId}/pdf-preview?template_key=${encodeURIComponent(templateKey)}`;
  const pdfDownloadUrl = `${pdfViewUrl}&download=1`;

  return (
    <Card>
      <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div className="d-flex align-items-center gap-2">
          <span>Preview do relatório</span>
          {templates.length > 0 && (
            <Form.Select size="sm" style={{ width: "auto" }} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
              {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
            </Form.Select>
          )}
          {isFetching && <Spinner animation="border" size="sm" />}
        </div>
        <div className="d-flex gap-2">
          <a className="btn btn-sm btn-outline-secondary" href={reportPreviewHtmlUrl(orderId, templateKey)} target="_blank" rel="noopener">Abrir em nova janela</a>
          <a className="btn btn-sm btn-outline-primary" href={pdfViewUrl} target="_blank" rel="noopener">Ver PDF</a>
          <a className="btn btn-sm btn-primary" href={pdfDownloadUrl}>Baixar PDF</a>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {error ? (
          <Alert variant="danger" className="m-3">Falha ao carregar o preview: {(error as Error).message}</Alert>
        ) : (
          <iframe
            title="Preview do relatório"
            srcDoc={data?.html ?? ""}
            sandbox="allow-scripts allow-modals"
            referrerPolicy="same-origin"
            style={{ width: "100%", height: "80vh", border: "none", background: "#fff" }}
          />
        )}
      </Card.Body>
    </Card>
  );
}
