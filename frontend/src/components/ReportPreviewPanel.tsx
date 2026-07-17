import { useEffect, useState } from "react";
import { Card, Form, Spinner } from "react-bootstrap";
import { reportPreviewHtmlUrl, type ReportTemplateOption } from "../api/reportEditor";

const ADMIN_BASE = "/admin/report-service";

export default function ReportPreviewPanel(props: {
  orderId: number;
  templates: ReportTemplateOption[];
  defaultTemplateKey: string;
}) {
  const { orderId, templates, defaultTemplateKey } = props;
  const [templateKey, setTemplateKey] = useState(defaultTemplateKey || (templates[0]?.key ?? ""));
  const [isLoading, setIsLoading] = useState(true);

  const previewUrl = reportPreviewHtmlUrl(orderId, templateKey);
  const pdfViewUrl = `${ADMIN_BASE}/orders/${orderId}/pdf-preview?template_key=${encodeURIComponent(templateKey)}`;
  const pdfDownloadUrl = `${pdfViewUrl}&download=1`;

  useEffect(() => {
    setIsLoading(true);
  }, [previewUrl]);

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
          {isLoading && <Spinner animation="border" size="sm" />}
        </div>
        <div className="d-flex gap-2">
          <a className="btn btn-sm btn-outline-secondary" href={previewUrl} target="_blank" rel="noopener">Abrir em nova janela</a>
          <a className="btn btn-sm btn-outline-primary" href={pdfViewUrl} target="_blank" rel="noopener">Ver PDF</a>
          <a className="btn btn-sm btn-primary" href={pdfDownloadUrl}>Baixar PDF</a>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        <iframe
          key={previewUrl}
          title="Preview do relatório"
          src={previewUrl}
          sandbox="allow-scripts allow-modals allow-same-origin"
          referrerPolicy="same-origin"
          onLoad={() => setIsLoading(false)}
          style={{ width: "100%", height: "80vh", border: "none", background: "#fff" }}
        />
      </Card.Body>
    </Card>
  );
}
