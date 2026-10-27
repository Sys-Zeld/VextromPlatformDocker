import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Decision,
  ExpenseAttachment,
  ExpenseItem,
  ReportDetail,
  ReportInput,
  checkSubmission,
  decide,
  deleteItem,
  deleteReport,
  downloadReportPdf,
  downloadReportZip,
  fileToBase64,
  getBankDetails,
  getReport,
  attachmentUrl,
  paymentProofUrl,
  registerPayment,
  submitReport,
  updateReport
} from "../../api/expenses";
import { confirmDialog } from "../../components/ConfirmDialog";
import IconAction from "../../components/IconAction";
import { formatDate } from "../../utils/format";
import AttachmentViewer, { ViewableFile } from "./AttachmentViewer";
import ExpenseItemModal from "./ExpenseItemModal";
import ReportForm, { isReportFormValid } from "./ReportForm";
import {
  ACTION_LABEL,
  STATUS_LABEL,
  StatusBadge,
  errorMessage,
  formatDateTime,
  formatMoney,
  formatPeriod,
  useExpensesMeta
} from "./shared";

const DECISION_COPY: Record<Decision, { title: string; label: string; variant: string; reason: "required" | "optional" | "none"; hint: string }> = {
  "start-review": { title: "Iniciar análise", label: "Iniciar análise", variant: "primary", reason: "none", hint: "O relatório passará para EM ANÁLISE." },
  approve: { title: "Aprovar relatório", label: "Aprovar", variant: "success", reason: "optional", hint: "Aprovação integral: o valor aprovado será igual ao solicitado." },
  reject: { title: "Rejeitar relatório", label: "Rejeitar", variant: "danger", reason: "required", hint: "A rejeição encerra a solicitação. Informe o motivo." },
  return: { title: "Devolver para correção", label: "Devolver", variant: "warning", reason: "required", hint: "O solicitante poderá corrigir e reenviar. Informe o que precisa ser ajustado." }
};

const ACTION_TO_DECISION: Partial<Record<string, Decision>> = {
  START_REVIEW: "start-review",
  APPROVE: "approve",
  REJECT: "reject",
  RETURN: "return"
};

const PAYMENT_METHOD_LABEL: Record<string, string> = { PIX: "Pix", TED: "TED", DEPOSITO: "Depósito", DINHEIRO: "Dinheiro", OUTRO: "Outro" };

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ReportDetailPage({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const reportId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const meta = useExpensesMeta();
  const queryKey = ["expenses", "report", reportId];
  const { data, isLoading, error } = useQuery({ queryKey, queryFn: () => getReport(reportId), enabled: Number.isFinite(reportId) });

  const [actionError, setActionError] = useState<string | null>(null);
  const [submitIssues, setSubmitIssues] = useState<string[]>([]);
  const [viewer, setViewer] = useState<ViewableFile | null>(null);
  const [itemModal, setItemModal] = useState<{ open: boolean; item: ExpenseItem | null }>({ open: false, item: null });
  const [editOpen, setEditOpen] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses"] });
  const onError = (e: unknown) => setActionError(errorMessage(e));

  const mDeleteItem = useMutation({ mutationFn: (itemId: number) => deleteItem(reportId, itemId), onSuccess: refresh, onError });
  const mDeleteReport = useMutation({
    mutationFn: () => deleteReport(reportId),
    onSuccess: () => { refresh(); navigate("/expenses/reports"); },
    onError
  });
  const mSubmit = useMutation({
    mutationFn: () => submitReport(reportId),
    onSuccess: () => { setSubmitIssues([]); refresh(); },
    onError: async (e) => {
      onError(e);
      // Se o servidor bloqueou, busca a lista detalhada para exibir.
      const check = await checkSubmission(reportId).catch(() => null);
      if (check) setSubmitIssues(check.issues);
    }
  });

  if (isLoading) return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error) return <Alert variant="danger">{errorMessage(error)}</Alert>;
  if (!data) return null;

  const { report, items, attachments, history, payments, permissions, requester, duplicates } = data;
  const backTo = admin ? "/expenses/admin/reports" : "/expenses/reports";
  const attachmentsByItem = (itemId: number) => attachments.filter((a) => a.item_id === itemId);
  const canSubmit = permissions.actions.includes("SUBMIT") || permissions.actions.includes("RESUBMIT");
  const decisions = permissions.actions.map((a) => ACTION_TO_DECISION[a]).filter((d): d is Decision => Boolean(d));
  const canPay = permissions.actions.includes("PAY");
  const duplicateCount = Object.keys(duplicates).length;

  const view = (a: ExpenseAttachment) =>
    setViewer({ name: a.original_name, mime: a.mime_type, url: attachmentUrl(a.id), downloadUrl: attachmentUrl(a.id, true) });

  const onSubmitClick = async () => {
    setActionError(null);
    const check = await checkSubmission(reportId).catch((e) => { onError(e); return null; });
    if (!check) return;
    setSubmitIssues(check.issues);
    if (!check.canSubmit) return;
    const verb = report.status === "DEVOLVIDO" ? "Reenviar" : "Enviar";
    if (await confirmDialog({
      title: `${verb} para aprovação`,
      message: `${verb} o relatório ${report.report_number} (${formatMoney(report.total_amount)})?\n\nApós o envio ele fica bloqueado para edição.`,
      confirmLabel: verb,
      icon: "send"
    })) {
      mSubmit.mutate();
    }
  };

  const exportFile = async (kind: "pdf" | "zip") => {
    try {
      await (kind === "pdf" ? downloadReportPdf(report) : downloadReportZip(report));
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h2 className="h5 mb-0">{report.report_number}</h2>
            <StatusBadge status={report.status} />
          </div>
          <p className="text-muted mb-0">{report.title}</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to={backTo} className="btn btn-sm btn-outline-secondary">Voltar</Link>
          <Button size="sm" variant="outline-secondary" onClick={() => exportFile("pdf")}>Exportar PDF</Button>
          <Button size="sm" variant="outline-secondary" onClick={() => exportFile("zip")} title="PDF + comprovantes">Exportar ZIP</Button>
          {permissions.canEdit && <Button size="sm" variant="outline-primary" onClick={() => setEditOpen(true)}>Editar dados</Button>}
          {permissions.canDelete && (
            <Button size="sm" variant="outline-danger" disabled={mDeleteReport.isPending}
              onClick={async () => { if (await confirmDialog(`Excluir o rascunho ${report.report_number}?`)) mDeleteReport.mutate(); }}>
              Excluir
            </Button>
          )}
          {canSubmit && (
            <Button size="sm" onClick={onSubmitClick} disabled={mSubmit.isPending}>
              {mSubmit.isPending ? <Spinner animation="border" size="sm" /> : report.status === "DEVOLVIDO" ? "Reenviar para aprovação" : "Enviar para aprovação"}
            </Button>
          )}
          {decisions.map((d) => (
            <Button key={d} size="sm" variant={DECISION_COPY[d].variant} onClick={() => { setActionError(null); setDecision(d); }}>
              {DECISION_COPY[d].label}
            </Button>
          ))}
          {canPay && <Button size="sm" variant="success" onClick={() => { setActionError(null); setPayOpen(true); }}>Registrar pagamento</Button>}
        </div>
      </div>

      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)} className="mb-0">{actionError}</Alert>}
      {submitIssues.length > 0 && (
        <Alert variant="warning" dismissible onClose={() => setSubmitIssues([])} className="mb-0">
          <strong>Antes de enviar, resolva:</strong>
          <ul className="mb-0 mt-1">{submitIssues.map((i) => <li key={i}>{i}</li>)}</ul>
          {submitIssues.some((i) => i.startsWith("Cadastro de reembolso")) && (
            <Link to="/expenses/profile" className="alert-link">Completar meu perfil de reembolso</Link>
          )}
        </Alert>
      )}
      {(report.status === "DEVOLVIDO" || report.status === "REJEITADO") && report.last_decision_reason && (
        <Alert variant={report.status === "DEVOLVIDO" ? "warning" : "danger"} className="mb-0">
          <strong>{report.status === "DEVOLVIDO" ? "Devolvido para correção" : "Rejeitado"}:</strong> {report.last_decision_reason}
        </Alert>
      )}
      {admin && duplicateCount > 0 && (
        <Alert variant="warning" className="mb-0">
          {duplicateCount} comprovante(s) com arquivo idêntico em outro lançamento ou relatório — verifique antes de decidir.
        </Alert>
      )}

      <Row className="g-4">
        <Col lg={8}>
          <Card className="h-100">
            <Card.Header>Informações gerais</Card.Header>
            <Card.Body>
              <Row className="g-3 small">
                <Info label="Solicitante" value={report.requester_name || report.requester_username} />
                <Info label="Período" value={formatPeriod(report)} />
                <Info label="Projeto / cliente" value={report.project_name || "-"} />
                <Info label="Centro de custo" value={report.cost_center || "-"} />
                <Info label="Criado em" value={formatDateTime(report.created_at)} />
                <Info label="Enviado em" value={formatDateTime(report.submitted_at)} />
                {report.reviewer_name && <Info label="Analista" value={report.reviewer_name} />}
                {report.approved_at && <Info label="Aprovado por" value={`${report.approved_by_name} em ${formatDateTime(report.approved_at)}`} />}
                <Col xs={12}>
                  <div className="text-muted">Descrição</div>
                  <div style={{ whiteSpace: "pre-line" }}>{report.description || "-"}</div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="h-100">
            <Card.Header>Valores</Card.Header>
            <Card.Body className="d-flex flex-column gap-2">
              <Amount label="Total solicitado" value={formatMoney(report.total_amount)} strong />
              <Amount label="Valor aprovado" value={formatMoney(report.approved_amount)} />
              <Amount label="Valor pago" value={report.status === "PAGO" ? formatMoney(report.paid_amount) : "-"} />
              <Amount label="Despesas" value={String(items.length)} />
              {requester?.profile && (
                <div className="border-top pt-2 mt-1 small">
                  <div className="text-muted mb-1">Dados de reembolso {permissions.isOwner ? "(seu cadastro)" : "(mascarados)"}</div>
                  <div>CPF: {requester.profile.cpf || "-"}</div>
                  {requester.profile.pixKey && <div>Pix ({requester.profile.pixKeyType}): {requester.profile.pixKey}</div>}
                  {requester.profile.accountNumber && (
                    <div>Banco {requester.profile.bankCode} · Ag. {requester.profile.agency} · Conta {requester.profile.accountNumber}</div>
                  )}
                  {!requester.readiness.ready && <Badge bg="warning" text="dark" className="mt-1">Cadastro incompleto</Badge>}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Despesas</span>
          {permissions.canEdit && (
            <Button size="sm" onClick={() => setItemModal({ open: true, item: null })}>Adicionar despesa</Button>
          )}
        </Card.Header>
        <Table responsive hover className="mb-0 align-middle">
          <thead>
            <tr>
              <th>Data</th><th>Categoria</th><th>Descrição</th><th>Justificativa</th><th>Comprovantes</th>
              <th className="text-end">Valor</th>{permissions.canEdit && <th className="text-end">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={permissions.canEdit ? 7 : 6} className="text-muted">Nenhuma despesa lançada.</td></tr>
            )}
            {items.map((i) => {
              const files = attachmentsByItem(i.id);
              return (
                <tr key={i.id}>
                  <td className="text-nowrap">{formatDate(i.expense_date)}</td>
                  <td>{i.category_name}</td>
                  <td>{i.description}{i.merchant && <div className="small text-muted">{i.merchant}</div>}</td>
                  <td className="small">{i.justification}</td>
                  <td>
                    {files.length === 0 ? (
                      <Badge bg="danger">Sem comprovante</Badge>
                    ) : (
                      <div className="d-flex flex-wrap gap-1">
                        {files.map((a) => (
                          <Button key={a.id} size="sm" variant={duplicates[a.id] ? "outline-warning" : "outline-secondary"}
                            className="text-truncate" style={{ maxWidth: 160 }} title={a.original_name} onClick={() => view(a)}>
                            <span className="material-symbols-outlined align-middle" style={{ fontSize: 16 }}>
                              {a.mime_type === "application/pdf" ? "picture_as_pdf" : "image"}
                            </span>{" "}{a.original_name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="text-end text-nowrap">{formatMoney(i.amount)}</td>
                  {permissions.canEdit && (
                    <td>
                      <div className="d-flex vx-actions">
                        <IconAction icon="edit" label="Editar despesa" onClick={() => setItemModal({ open: true, item: i })} />
                        <IconAction icon="delete" label="Excluir despesa" disabled={mDeleteItem.isPending}
                          onClick={async () => { if (await confirmDialog(`Excluir a despesa "${i.description}"?`)) mDeleteItem.mutate(i.id); }} />
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="fw-semibold">
              <td colSpan={5} className="text-end">Total ({items.length} despesa{items.length === 1 ? "" : "s"})</td>
              <td className="text-end text-nowrap">{formatMoney(report.total_amount)}</td>
              {permissions.canEdit && <td />}
            </tr>
          </tfoot>
        </Table>
      </Card>

      {payments.length > 0 && (
        <Card>
          <Card.Header>Pagamento</Card.Header>
          <Card.Body>
            {payments.map((p) => (
              <Row key={p.id} className="g-3 small">
                <Info label="Data" value={formatDate(p.payment_date)} />
                <Info label="Valor" value={formatMoney(p.amount)} />
                <Info label="Forma" value={PAYMENT_METHOD_LABEL[p.payment_method] || p.payment_method} />
                <Info label="Referência" value={p.transaction_reference || "-"} />
                <Info label="Registrado por" value={`${p.recorded_by_name} em ${formatDateTime(p.created_at)}`} />
                {p.has_proof && (
                  <Col sm={6} md={4}>
                    <div className="text-muted">Comprovante</div>
                    <Button size="sm" variant="outline-secondary" onClick={() => setViewer({
                      name: p.proof_name || "comprovante", mime: (p.proof_name || "").toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/*",
                      url: paymentProofUrl(p.id), downloadUrl: paymentProofUrl(p.id, true)
                    })}>Ver comprovante</Button>
                  </Col>
                )}
                {p.notes && <Col xs={12}><div className="text-muted">Observações</div>{p.notes}</Col>}
              </Row>
            ))}
          </Card.Body>
        </Card>
      )}

      <Card>
        <Card.Header>Histórico</Card.Header>
        <Table responsive className="mb-0 align-middle small">
          <thead><tr><th>Data</th><th>Ação</th><th>Status</th><th>Responsável</th><th>Justificativa</th></tr></thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan={5} className="text-muted">Sem movimentações — o relatório ainda não foi enviado.</td></tr>}
            {history.map((h) => (
              <tr key={h.id}>
                <td className="text-nowrap">{formatDateTime(h.created_at)}</td>
                <td>{ACTION_LABEL[h.action] || h.action}</td>
                <td className="text-nowrap">{h.previous_status ? STATUS_LABEL[h.previous_status] : "-"} → {STATUS_LABEL[h.new_status]}</td>
                <td>{h.performed_by_name}</td>
                <td>{h.reason || "-"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <ExpenseItemModal
        show={itemModal.open}
        reportId={reportId}
        item={itemModal.item}
        attachments={attachments}
        duplicates={duplicates}
        categories={meta.data?.categories ?? []}
        allowedExtensions={meta.data?.allowedExtensions ?? ["pdf", "png", "jpg", "jpeg", "webp"]}
        maxFileMb={meta.data?.maxFileMb ?? 10}
        onView={setViewer}
        onClose={() => setItemModal({ open: false, item: null })}
        onChanged={refresh}
      />
      <EditReportModal show={editOpen} data={data} onClose={() => setEditOpen(false)} onSaved={refresh} />
      <DecisionModal decision={decision} data={data} onClose={() => setDecision(null)} onDone={refresh} />
      <PaymentModal show={payOpen} data={data} methods={meta.data?.paymentMethods ?? []} maxFileMb={meta.data?.maxFileMb ?? 10}
        onClose={() => setPayOpen(false)} onDone={refresh} />
      <AttachmentViewer file={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Col sm={6} md={4}>
      <div className="text-muted">{label}</div>
      <div>{value}</div>
    </Col>
  );
}

function Amount({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="d-flex justify-content-between">
      <span className="text-muted">{label}</span>
      <span className={strong ? "fw-bold fs-5" : "fw-semibold"}>{value}</span>
    </div>
  );
}

function EditReportModal({ show, data, onClose, onSaved }: { show: boolean; data: ReportDetail; onClose: () => void; onSaved: () => void }) {
  const r = data.report;
  const initial: ReportInput = {
    title: r.title, description: r.description || "", projectName: r.project_name || "", costCenter: r.cost_center || "",
    startDate: String(r.start_date).slice(0, 10), endDate: String(r.end_date).slice(0, 10)
  };
  const [form, setForm] = useState<ReportInput>(initial);
  useEffect(() => { if (show) setForm(initial); }, [show]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = useMutation({ mutationFn: () => updateReport(r.id, form), onSuccess: () => { onSaved(); onClose(); } });

  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Form onSubmit={(e: FormEvent) => { e.preventDefault(); if (isReportFormValid(form)) m.mutate(); }}>
        <Modal.Header closeButton><Modal.Title as="h6">Editar dados do relatório</Modal.Title></Modal.Header>
        <Modal.Body>
          {m.error && <Alert variant="danger">{errorMessage(m.error)}</Alert>}
          <ReportForm value={form} onChange={setForm} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={!isReportFormValid(form) || m.isPending}>Salvar</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function DecisionModal({ decision, data, onClose, onDone }: { decision: Decision | null; data: ReportDetail; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  useEffect(() => { setReason(""); }, [decision]);
  const m = useMutation({
    mutationFn: () => decide(data.report.id, decision!, reason),
    onSuccess: () => { onDone(); onClose(); }
  });
  if (!decision) return null;
  const copy = DECISION_COPY[decision];
  const reasonMissing = copy.reason === "required" && !reason.trim();

  return (
    <Modal show onHide={onClose} centered>
      <Form onSubmit={(e: FormEvent) => { e.preventDefault(); if (!reasonMissing && !m.isPending) m.mutate(); }}>
        <Modal.Header closeButton><Modal.Title as="h6">{copy.title}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          {m.error && <Alert variant="danger" className="mb-0">{errorMessage(m.error)}</Alert>}
          <div>
            <strong>{data.report.report_number}</strong> — {data.report.title}<br />
            Solicitante: {data.report.requester_name || data.report.requester_username} · Total: {formatMoney(data.report.total_amount)}
          </div>
          <p className="text-muted small mb-0">{copy.hint}</p>
          {copy.reason !== "none" && (
            <Form.Group>
              <Form.Label>{copy.reason === "required" ? "Justificativa *" : "Observações administrativas"}</Form.Label>
              <Form.Control as="textarea" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant={copy.variant} disabled={reasonMissing || m.isPending}>
            {m.isPending ? <Spinner animation="border" size="sm" /> : `Confirmar ${copy.label.toLowerCase()}`}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function PaymentModal({ show, data, methods, maxFileMb, onClose, onDone }: {
  show: boolean; data: ReportDetail; methods: string[]; maxFileMb: number; onClose: () => void; onDone: () => void;
}) {
  const r = data.report;
  const [form, setForm] = useState({ paymentDate: todayIso(), paymentMethod: "PIX", transactionReference: "", notes: "" });
  const [proof, setProof] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    setForm({ paymentDate: todayIso(), paymentMethod: "PIX", transactionReference: "", notes: "" });
    setProof(null);
    setFileError(null);
  }, [show]);

  // Dados completos só ao abrir o registro de pagamento (acesso auditado no servidor).
  const bank = useQuery({ queryKey: ["expenses", "bank", r.id], queryFn: () => getBankDetails(r.id), enabled: show, gcTime: 0, staleTime: 0 });

  const m = useMutation({
    mutationFn: async () => registerPayment(r.id, {
      ...form,
      amount: r.approved_amount || "0",
      proof: proof ? { name: proof.name, dataBase64: await fileToBase64(proof) } : null
    }),
    onSuccess: () => { onDone(); onClose(); }
  });

  const onFile = (file: File | undefined) => {
    setFileError(null);
    if (!file) { setProof(null); return; }
    if (file.size > maxFileMb * 1024 * 1024) { setFileError(`Arquivo excede ${maxFileMb} MB.`); return; }
    setProof(file);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (m.isPending) return;
    if (await confirmDialog({
      title: "Confirmar pagamento",
      message: `Registrar o pagamento de ${formatMoney(r.approved_amount)} para ${r.requester_name || r.requester_username}?\n\nO relatório será marcado como PAGO e a operação não pode ser desfeita.`,
      confirmLabel: "Registrar pagamento",
      icon: "payments"
    })) m.mutate();
  };

  const b = bank.data?.bankDetails;
  return (
    <Modal show={show} onHide={onClose} size="lg">
      <Form onSubmit={onSubmit}>
        <Modal.Header closeButton><Modal.Title as="h6">Registrar pagamento · {r.report_number}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          {m.error && <Alert variant="danger" className="mb-0">{errorMessage(m.error)}</Alert>}
          <Card className="bg-body-tertiary">
            <Card.Body className="small">
              <div className="fw-semibold mb-1">Dados para o reembolso</div>
              {bank.isLoading && <Spinner animation="border" size="sm" />}
              {bank.error && <span className="text-danger">{errorMessage(bank.error)}</span>}
              {bank.data && !b && <span className="text-danger">Solicitante sem cadastro de reembolso.</span>}
              {b && (
                <Row className="g-2">
                  <Col sm={6}><span className="text-muted">Favorecido:</span> {b.fullName}</Col>
                  <Col sm={6}><span className="text-muted">CPF:</span> {b.cpf}</Col>
                  {b.pixKey && <Col sm={12}><span className="text-muted">Pix ({b.pixKeyType}):</span> <span className="user-select-all">{b.pixKey}</span></Col>}
                  {b.accountNumber && (
                    <Col sm={12}>
                      <span className="text-muted">Conta:</span> {b.bankCode} {b.bankName} · Ag. {b.agency} · {b.accountNumber}{b.accountDigit ? `-${b.accountDigit}` : ""} ({b.accountType})
                    </Col>
                  )}
                </Row>
              )}
              <div className="text-muted mt-2" style={{ fontSize: "0.75rem" }}>Acesso a estes dados é registrado na auditoria.</div>
            </Card.Body>
          </Card>
          <Row className="g-3">
            <Col sm={6} md={4}>
              <Form.Label>Data do pagamento *</Form.Label>
              <Form.Control type="date" required value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
            </Col>
            <Col sm={6} md={4}>
              <Form.Label>Valor (integral)</Form.Label>
              <Form.Control readOnly value={formatMoney(r.approved_amount)} />
            </Col>
            <Col md={4}>
              <Form.Label>Forma de pagamento *</Form.Label>
              <Form.Select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                {methods.map((x) => <option key={x} value={x}>{PAYMENT_METHOD_LABEL[x] || x}</option>)}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label>Referência da transação</Form.Label>
              <Form.Control maxLength={200} value={form.transactionReference} onChange={(e) => setForm({ ...form, transactionReference: e.target.value })} placeholder="ID Pix / nº do documento" />
            </Col>
            <Col md={6}>
              <Form.Label>Comprovante bancário</Form.Label>
              <Form.Control type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" isInvalid={!!fileError}
                onChange={(e) => onFile((e.target as HTMLInputElement).files?.[0])} />
              <Form.Control.Feedback type="invalid">{fileError}</Form.Control.Feedback>
            </Col>
            <Col xs={12}>
              <Form.Label>Observações</Form.Label>
              <Form.Control as="textarea" rows={2} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="success" disabled={m.isPending || !form.paymentDate || !!fileError}>
            {m.isPending ? <Spinner animation="border" size="sm" /> : "Registrar pagamento"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
