import { Col, Form, Row } from "react-bootstrap";
import { ReportInput } from "../../api/expenses";

export const EMPTY_REPORT: ReportInput = {
  title: "", description: "", projectName: "", costCenter: "", startDate: "", endDate: ""
};

// Campos do cabeçalho do relatório (criação e edição).
export default function ReportForm({ value, onChange }: { value: ReportInput; onChange: (v: ReportInput) => void }) {
  const set = (key: keyof ReportInput) => (e: { target: { value: string } }) => onChange({ ...value, [key]: e.target.value });
  const periodInvalid = Boolean(value.startDate && value.endDate && value.endDate < value.startDate);

  return (
    <Row className="g-3">
      <Col md={12}>
        <Form.Label>Título *</Form.Label>
        <Form.Control required maxLength={200} value={value.title} onChange={set("title")} placeholder="Ex.: Visita técnica — Cliente X" />
      </Col>
      <Col sm={6} md={3}>
        <Form.Label>Data inicial *</Form.Label>
        <Form.Control required type="date" value={value.startDate} onChange={set("startDate")} />
      </Col>
      <Col sm={6} md={3}>
        <Form.Label>Data final *</Form.Label>
        <Form.Control required type="date" value={value.endDate} min={value.startDate || undefined} isInvalid={periodInvalid} onChange={set("endDate")} />
        <Form.Control.Feedback type="invalid">Data final anterior à inicial.</Form.Control.Feedback>
      </Col>
      <Col sm={6} md={3}>
        <Form.Label>Projeto / cliente</Form.Label>
        <Form.Control maxLength={200} value={value.projectName} onChange={set("projectName")} />
      </Col>
      <Col sm={6} md={3}>
        <Form.Label>Centro de custo</Form.Label>
        <Form.Control maxLength={120} value={value.costCenter} onChange={set("costCenter")} />
      </Col>
      <Col md={12}>
        <Form.Label>Descrição geral</Form.Label>
        <Form.Control as="textarea" rows={3} maxLength={4000} value={value.description} onChange={set("description")} />
      </Col>
    </Row>
  );
}

export function isReportFormValid(v: ReportInput): boolean {
  return Boolean(v.title.trim() && v.startDate && v.endDate && v.endDate >= v.startDate);
}
