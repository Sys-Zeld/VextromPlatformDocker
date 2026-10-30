import { FormEvent, ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, InputGroup, Modal, Spinner, Table } from "react-bootstrap";
import {
  ExpenseUser,
  UserCreateInput,
  UserUpdateInput,
  createExpenseUser,
  deleteExpenseUser,
  listExpenseUsers,
  sendUserAccessLink,
  updateExpenseUser
} from "../../../api/expenses";
import { confirmDialog } from "../../../components/ConfirmDialog";
import IconAction from "../../../components/IconAction";
import { PageHeader, errorMessage, formatDateTime, useExpensesMeta } from "../shared";

// Contas do módulo (login próprio, independente do hub).
// Colaborador = toda conta ativa; Administrador, Aprovador e Financeiro são adicionais.

const EMPTY_CREATE: UserCreateInput = {
  username: "", fullName: "", email: "", isAdmin: false, isApprover: false, isFinance: false, temporaryPassword: false
};

const toUpdate = (u: ExpenseUser, patch: Partial<UserUpdateInput> = {}): UserUpdateInput => ({
  fullName: u.fullName,
  email: u.email,
  status: u.status === "disabled" ? "disabled" : "active",
  isAdmin: u.isAdmin,
  isApprover: u.isApprover,
  isFinance: u.isFinance,
  ...patch
});

function StatusBadges({ u }: { u: ExpenseUser }) {
  return (
    <div className="d-flex gap-1 flex-wrap">
      {u.status === "active" && <Badge bg="success">Ativo</Badge>}
      {u.status === "invited" && <Badge bg="warning" text="dark">Convite pendente</Badge>}
      {u.status === "disabled" && <Badge bg="secondary">Desativado</Badge>}
      {u.locked && <Badge bg="danger" title={`Até ${formatDateTime(u.lockedUntil)}`}>Bloqueado</Badge>}
      {u.mustChangePassword && <Badge bg="info" text="dark">Senha provisória</Badge>}
    </div>
  );
}

// Credencial a entregar (senha provisória ou link), mostrada uma única vez.
function SecretBox({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="small text-muted mb-1">{label}</div>
      <InputGroup size="sm">
        <Form.Control readOnly value={value} onFocus={(e) => e.target.select()} />
        <Button variant="outline-secondary" onClick={async () => {
          try { await navigator.clipboard.writeText(value); setCopied(true); } catch { /* sem permissão */ }
        }}>{copied ? "Copiado" : "Copiar"}</Button>
      </InputGroup>
    </div>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const meta = useExpensesMeta();
  const myId = meta.data?.actor.userId;
  const { data, isLoading, error } = useQuery({ queryKey: ["expenses", "users"], queryFn: listExpenseUsers });
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ReactNode>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ExpenseUser | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["expenses", "users"] });
  const begin = (id: string) => { setBusyId(id); setActionError(null); setNotice(null); };
  const fail = (e: unknown) => { setActionError(errorMessage(e)); refresh(); };

  const mUpdate = useMutation({
    mutationFn: ({ u, input }: { u: ExpenseUser; input: UserUpdateInput }) => updateExpenseUser(u.id, input),
    onMutate: ({ u }) => begin(u.id),
    onSettled: () => setBusyId(null),
    onSuccess: refresh,
    onError: fail
  });
  const mDelete = useMutation({
    mutationFn: (u: ExpenseUser) => deleteExpenseUser(u.id),
    onMutate: (u) => begin(u.id),
    onSettled: () => setBusyId(null),
    onSuccess: (res) => { setNotice(`Conta ${res.username} excluída. Relatórios e histórico foram mantidos.`); refresh(); },
    onError: fail
  });
  const mLink = useMutation({
    mutationFn: (u: ExpenseUser) => sendUserAccessLink(u.id),
    onMutate: (u) => begin(u.id),
    onSettled: () => setBusyId(null),
    onSuccess: (res, u) => setNotice(
      <div className="d-flex flex-column gap-2">
        <span>
          {res.emailError
            ? <>Não foi possível enviar o e-mail para <strong>{u.username}</strong> ({res.emailError}). Entregue o link abaixo.</>
            : <>{res.kind === "invite" ? "Convite reenviado" : "Link de redefinição de senha enviado"} para <strong>{u.email}</strong>.</>}
        </span>
        <SecretBox label="Link (uso único)" value={res.link} />
      </div>
    ),
    onError: fail
  });

  const toggleRole = (u: ExpenseUser, role: "isAdmin" | "isApprover" | "isFinance", value: boolean) =>
    mUpdate.mutate({ u, input: toUpdate(u, { [role]: value }) });

  const toggleStatus = async (u: ExpenseUser) => {
    const disabling = u.status !== "disabled";
    if (disabling && !(await confirmDialog({
      title: "Desativar conta",
      message: `Desativar ${u.username}?\n\nA pessoa perde o acesso na hora (sessões abertas são encerradas). Pode ser reativada depois.`,
      confirmLabel: "Desativar",
      variant: "danger",
      icon: "person_off"
    }))) return;
    mUpdate.mutate({ u, input: toUpdate(u, { status: disabling ? "disabled" : "active" }) });
  };

  const remove = async (u: ExpenseUser) => {
    if (await confirmDialog({
      title: "Excluir conta",
      message: `Excluir a conta ${u.username}?\n\nO login deixa de existir. Relatórios, histórico e auditoria da pessoa são mantidos.`,
      confirmLabel: "Excluir conta",
      variant: "danger",
      icon: "person_remove"
    })) mDelete.mutate(u);
  };

  const term = search.trim().toLowerCase();
  const users = (data?.users ?? []).filter((u) =>
    !term || [u.username, u.fullName, u.email].some((x) => x.toLowerCase().includes(term)));

  return (
    <div className="d-flex flex-column gap-4">
      <PageHeader
        title="Usuários"
        subtitle="Contas de acesso do módulo (login próprio, separado do Service Hub). Colaborador lança despesas; Aprovador decide; Financeiro paga; Administrador gerencia usuários e configurações."
        actions={<Button size="sm" onClick={() => setShowCreate(true)}>Novo usuário</Button>}
      />
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)} className="mb-0">{actionError}</Alert>}
      {notice && <Alert variant="success" dismissible onClose={() => setNotice(null)} className="mb-0">{notice}</Alert>}

      <Card>
        <Card.Header>
          <Form.Control size="sm" style={{ maxWidth: 300 }} placeholder="Buscar por usuário, nome ou e-mail"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </Card.Header>
        {isLoading ? <Card.Body><Spinner animation="border" size="sm" /> Carregando…</Card.Body> : error ? (
          <Card.Body><Alert variant="danger" className="mb-0">{errorMessage(error)}</Alert></Card.Body>
        ) : (
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Situação</th>
                <th className="text-center">Administrador</th>
                <th className="text-center">Aprovador</th>
                <th className="text-center">Financeiro</th>
                <th>Último acesso</th>
                <th className="text-end">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum usuário.</td></tr>}
              {users.map((u) => {
                const self = u.id === myId;
                const busy = busyId === u.id;
                return (
                  <tr key={u.id} className={u.status === "disabled" ? "text-muted" : ""}>
                    <td>
                      <div className="fw-semibold">{u.username}{self && <Badge bg="light" text="dark" className="ms-2">você</Badge>} {busy && <Spinner animation="border" size="sm" />}</div>
                      <div className="small text-muted">{[u.fullName, u.email || "sem e-mail"].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td><StatusBadges u={u} /></td>
                    <td className="text-center">
                      <Form.Check aria-label={`${u.username} administrador`} checked={u.isAdmin} disabled={busy || self}
                        onChange={(e) => toggleRole(u, "isAdmin", e.target.checked)} />
                    </td>
                    <td className="text-center">
                      <Form.Check aria-label={`${u.username} aprovador`} checked={u.isApprover} disabled={busy}
                        onChange={(e) => toggleRole(u, "isApprover", e.target.checked)} />
                    </td>
                    <td className="text-center">
                      <Form.Check aria-label={`${u.username} financeiro`} checked={u.isFinance} disabled={busy}
                        onChange={(e) => toggleRole(u, "isFinance", e.target.checked)} />
                    </td>
                    <td className="small text-nowrap">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</td>
                    <td>
                      <div className="d-flex vx-actions">
                        <IconAction icon="edit" label="Editar" disabled={busy} onClick={() => setEditing(u)} />
                        {u.locked && (
                          <IconAction icon="lock_open" label="Desbloquear" disabled={busy}
                            onClick={() => mUpdate.mutate({ u, input: toUpdate(u, { unlock: true }) })} />
                        )}
                        {u.status !== "disabled" && u.email && (
                          <IconAction icon={u.status === "invited" ? "forward_to_inbox" : "key"}
                            label={u.status === "invited" ? "Reenviar convite" : "Enviar redefinição de senha"}
                            disabled={busy} onClick={() => mLink.mutate(u)} />
                        )}
                        {!self && (
                          <IconAction icon={u.status === "disabled" ? "person_check" : "person_off"}
                            label={u.status === "disabled" ? "Reativar" : "Desativar"} disabled={busy} onClick={() => toggleStatus(u)} />
                        )}
                        {!self && <IconAction icon="delete" label="Excluir conta" disabled={busy} onClick={() => remove(u)} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <CreateUserModal show={showCreate} onClose={() => setShowCreate(false)} onCreated={refresh} />
      <EditUserModal user={editing} onClose={() => setEditing(null)}
        onSave={(input) => { if (editing) mUpdate.mutate({ u: editing, input }); setEditing(null); }} />
    </div>
  );
}

function RoleChecks({ value, onChange }: {
  value: { isAdmin: boolean; isApprover: boolean; isFinance: boolean };
  onChange: (v: { isAdmin: boolean; isApprover: boolean; isFinance: boolean }) => void;
}) {
  return (
    <div>
      <Form.Label className="d-block">Papéis</Form.Label>
      <Form.Check inline disabled checked readOnly label="Colaborador" id="role-collab" />
      <Form.Check inline id="role-approver" label="Aprovador" checked={value.isApprover} onChange={(e) => onChange({ ...value, isApprover: e.target.checked })} />
      <Form.Check inline id="role-finance" label="Financeiro" checked={value.isFinance} onChange={(e) => onChange({ ...value, isFinance: e.target.checked })} />
      <Form.Check inline id="role-admin" label="Administrador" checked={value.isAdmin} onChange={(e) => onChange({ ...value, isAdmin: e.target.checked })} />
    </div>
  );
}

function CreateUserModal({ show, onClose, onCreated }: { show: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<UserCreateInput>(EMPTY_CREATE);
  const m = useMutation({ mutationFn: () => createExpenseUser(form), onSuccess: onCreated });
  const close = () => { setForm(EMPTY_CREATE); m.reset(); onClose(); };
  const emailOk = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const valid = /^[A-Za-z0-9._@-]{3,60}$/.test(form.username.trim()) && emailOk && (form.temporaryPassword || Boolean(form.email.trim()));
  const result = m.data;

  return (
    <Modal show={show} onHide={close}>
      <Form onSubmit={(e: FormEvent) => { e.preventDefault(); if (valid && !m.isPending) m.mutate(); }}>
        <Modal.Header closeButton><Modal.Title as="h6">Novo usuário</Modal.Title></Modal.Header>
        {result ? (
          <>
            <Modal.Body className="d-flex flex-column gap-3">
              <Alert variant="success" className="mb-0">Conta <strong>{result.user.username}</strong> criada.</Alert>
              {result.temporaryPassword && (
                <>
                  <SecretBox label="Senha provisória — entregue à pessoa; ela será obrigada a trocar no primeiro acesso" value={result.temporaryPassword} />
                  <Alert variant="warning" className="mb-0 small">Esta senha não será exibida novamente.</Alert>
                </>
              )}
              {result.inviteLink && (
                <>
                  {result.inviteError
                    ? <Alert variant="warning" className="mb-0 small">O convite não pôde ser enviado ({result.inviteError}). Verifique Configurações → e-mail e entregue o link abaixo.</Alert>
                    : <p className="small mb-0">Convite enviado para <strong>{result.user.email}</strong>. Se não chegar, entregue o link:</p>}
                  <SecretBox label="Link do convite (uso único, válido por 72 h)" value={result.inviteLink} />
                </>
              )}
              <p className="small text-muted mb-0">Endereço de acesso: <code>{window.location.origin}/app/expenses/login</code></p>
            </Modal.Body>
            <Modal.Footer><Button onClick={close}>Concluir</Button></Modal.Footer>
          </>
        ) : (
          <>
            <Modal.Body className="d-flex flex-column gap-3">
              {m.error && <Alert variant="danger" className="mb-0">{errorMessage(m.error)}</Alert>}
              <Form.Group>
                <Form.Label>Usuário (login) *</Form.Label>
                <Form.Control required autoFocus maxLength={60} value={form.username} placeholder="nome.sobrenome"
                  onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Nome completo</Form.Label>
                <Form.Control maxLength={200} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>E-mail {form.temporaryPassword ? "" : "*"}</Form.Label>
                <Form.Control type="email" maxLength={200} value={form.email} isInvalid={!emailOk}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Form.Text muted>Usado para o convite, a recuperação de senha e as notificações.</Form.Text>
              </Form.Group>
              <RoleChecks value={form} onChange={(r) => setForm({ ...form, ...r })} />
              <Form.Check type="switch" id="temp-pass" checked={form.temporaryPassword}
                label="Gerar senha provisória em vez de enviar convite (quando não há e-mail/SMTP)"
                onChange={(e) => setForm({ ...form, temporaryPassword: e.target.checked })} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={close}>Cancelar</Button>
              <Button type="submit" disabled={!valid || m.isPending}>
                {m.isPending ? <Spinner animation="border" size="sm" /> : form.temporaryPassword ? "Criar com senha provisória" : "Criar e enviar convite"}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Form>
    </Modal>
  );
}

function EditUserModal({ user, onClose, onSave }: { user: ExpenseUser | null; onClose: () => void; onSave: (input: UserUpdateInput) => void }) {
  const [form, setForm] = useState<UserUpdateInput | null>(null);
  const current = form && user ? form : user ? toUpdate(user) : null;
  const close = () => { setForm(null); onClose(); };
  if (!user || !current) return null;
  const emailOk = !current.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.email.trim());

  return (
    <Modal show onHide={close}>
      <Form onSubmit={(e: FormEvent) => { e.preventDefault(); if (emailOk) { onSave(current); setForm(null); } }}>
        <Modal.Header closeButton><Modal.Title as="h6">Editar {user.username}</Modal.Title></Modal.Header>
        <Modal.Body className="d-flex flex-column gap-3">
          <Form.Group>
            <Form.Label>Nome completo</Form.Label>
            <Form.Control maxLength={200} value={current.fullName} onChange={(e) => setForm({ ...current, fullName: e.target.value })} />
          </Form.Group>
          <Form.Group>
            <Form.Label>E-mail</Form.Label>
            <Form.Control type="email" maxLength={200} value={current.email} isInvalid={!emailOk}
              onChange={(e) => setForm({ ...current, email: e.target.value })} />
            <Form.Text muted>Trocar o e-mail encerra as sessões abertas da pessoa.</Form.Text>
          </Form.Group>
          <RoleChecks value={current} onChange={(r) => setForm({ ...current, ...r })} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={close}>Cancelar</Button>
          <Button type="submit" disabled={!emailOk}>Salvar</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
