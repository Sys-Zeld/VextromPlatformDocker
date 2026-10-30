import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { ProfileData, getProfile, saveProfile } from "../../api/expenses";
import { PageHeader, errorMessage, useExpensesMeta } from "./shared";

const EMPTY: ProfileData = {
  fullName: "", cpf: "", email: "", phone: "", bankCode: "", bankName: "", agency: "",
  accountNumber: "", accountDigit: "", accountType: "", pixKey: "", pixKeyType: ""
};

const ACCOUNT_TYPE_LABEL: Record<string, string> = { CORRENTE: "Corrente", POUPANCA: "Poupança", PAGAMENTO: "Pagamento" };
const PIX_TYPE_LABEL: Record<string, string> = { CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", TELEFONE: "Telefone", ALEATORIA: "Aleatória" };

// Máscara de CPF enquanto digita: 000.000.000-00.
function maskCpfInput(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

function isValidCpf(value: string): boolean {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const meta = useExpensesMeta();
  const { data, isLoading, error } = useQuery({ queryKey: ["expenses", "profile"], queryFn: getProfile });
  const [form, setForm] = useState<ProfileData>(EMPTY);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.profile) setForm({ ...EMPTY, ...data.profile });
  }, [data]);

  const mSave = useMutation({
    mutationFn: () => saveProfile(form),
    onSuccess: (res) => {
      qc.setQueryData(["expenses", "profile"], res);
      setSaved(true);
    }
  });

  const set = (key: keyof ProfileData) => (e: { target: { value: string } }) => {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  if (isLoading) return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  if (error) return <Alert variant="danger">{errorMessage(error)}</Alert>;

  const cpfInvalid = Boolean(form.cpf) && !isValidCpf(form.cpf);
  const readiness = data?.readiness;
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (!cpfInvalid) mSave.mutate(); };

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Meu Perfil de Reembolso"
        subtitle="Dados usados para identificar você e efetuar os reembolsos. Somente você e a gestão financeira (de forma restrita) têm acesso."
      />

      {readiness && !readiness.ready && (
        <Alert variant="warning" className="mb-0">
          <strong>Cadastro incompleto para envio de relatórios.</strong> Falta: {readiness.missing.join("; ")}.
          Você pode criar rascunhos normalmente.
        </Alert>
      )}
      {readiness?.ready && <Alert variant="success" className="mb-0">Cadastro completo — você já pode enviar relatórios para aprovação.</Alert>}
      {mSave.error && <Alert variant="danger" className="mb-0">{errorMessage(mSave.error)}</Alert>}
      {saved && <Alert variant="success" dismissible onClose={() => setSaved(false)} className="mb-0">Dados salvos.</Alert>}

      <Form onSubmit={onSubmit} className="d-flex flex-column gap-4">
        <Card>
          <Card.Header>Dados pessoais</Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={6}>
                <Form.Label>Nome completo *</Form.Label>
                <Form.Control required maxLength={200} value={form.fullName} onChange={set("fullName")} />
              </Col>
              <Col md={6}>
                <Form.Label>CPF *</Form.Label>
                <Form.Control
                  inputMode="numeric"
                  value={form.cpf}
                  isInvalid={cpfInvalid}
                  onChange={(e) => { setSaved(false); setForm((f) => ({ ...f, cpf: maskCpfInput(e.target.value) })); }}
                  placeholder="000.000.000-00"
                />
                <Form.Control.Feedback type="invalid">CPF inválido.</Form.Control.Feedback>
              </Col>
              <Col md={6}>
                <Form.Label>E-mail (para notificações)</Form.Label>
                <Form.Control type="email" maxLength={200} value={form.email} onChange={set("email")} />
              </Col>
              <Col md={6}>
                <Form.Label>Telefone</Form.Label>
                <Form.Control maxLength={30} value={form.phone} onChange={set("phone")} placeholder="(00) 00000-0000" />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>Dados bancários</Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col sm={4} md={2}>
                <Form.Label>Código do banco</Form.Label>
                <Form.Control inputMode="numeric" maxLength={3} value={form.bankCode} onChange={set("bankCode")} placeholder="001" />
              </Col>
              <Col sm={8} md={4}>
                <Form.Label>Instituição bancária</Form.Label>
                <Form.Control maxLength={120} value={form.bankName} onChange={set("bankName")} />
              </Col>
              <Col sm={4} md={2}>
                <Form.Label>Agência</Form.Label>
                <Form.Control maxLength={10} value={form.agency} onChange={set("agency")} />
              </Col>
              <Col sm={5} md={2}>
                <Form.Label>Conta</Form.Label>
                <Form.Control inputMode="numeric" maxLength={15} value={form.accountNumber} onChange={set("accountNumber")} />
              </Col>
              <Col sm={3} md={2}>
                <Form.Label>Dígito</Form.Label>
                <Form.Control maxLength={2} value={form.accountDigit} onChange={set("accountDigit")} />
              </Col>
              <Col md={4}>
                <Form.Label>Tipo de conta</Form.Label>
                <Form.Select value={form.accountType} onChange={set("accountType")}>
                  <option value="">—</option>
                  {(meta.data?.accountTypes ?? []).map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t] || t}</option>)}
                </Form.Select>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header>Chave Pix</Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label>Tipo de chave</Form.Label>
                <Form.Select value={form.pixKeyType} onChange={set("pixKeyType")}>
                  <option value="">—</option>
                  {(meta.data?.pixKeyTypes ?? []).map((t) => <option key={t} value={t}>{PIX_TYPE_LABEL[t] || t}</option>)}
                </Form.Select>
              </Col>
              <Col md={8}>
                <Form.Label>Chave Pix</Form.Label>
                <Form.Control maxLength={140} value={form.pixKey} onChange={set("pixKey")} />
              </Col>
            </Row>
            <Form.Text muted>Informe a chave Pix ou os dados bancários completos — um dos dois é exigido para enviar relatórios.</Form.Text>
          </Card.Body>
        </Card>

        <div className="d-flex justify-content-end">
          <Button type="submit" disabled={mSave.isPending || cpfInvalid}>
            {mSave.isPending ? <Spinner animation="border" size="sm" /> : "Salvar dados"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
