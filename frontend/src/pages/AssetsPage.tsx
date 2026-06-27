import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Modal, OverlayTrigger, Spinner, Table, Tooltip } from "react-bootstrap";
import {
  Instrument,
  InstrumentInput,
  Technician,
  TechnicianInput,
  createInstrument,
  createTechnician,
  deleteInstrument,
  deleteTechnician,
  listAssets,
  updateInstrument,
  updateTechnician
} from "../api/assets";

const EMPTY_TECH: TechnicianInput = { name: "", role: "", company: "", email: "", phone: "", isLead: false };
const EMPTY_INSTR: InstrumentInput = {
  name: "", model: "", serialNumber: "", certificateNumber: "", certificateLink: "",
  responsibleTechnicianId: "", lastCalibrationDate: "", calibrationDueDate: "", notes: ""
};

// Botão somente-ícone com legenda (tooltip) no hover. Aceita props de Button
// (inclusive as={Link} to=...) via rest.
type IconActionProps = { icon: string; label: string } & Record<string, unknown>;
function IconAction({ icon, label, ...rest }: IconActionProps) {
  return (
    <OverlayTrigger placement="top" overlay={<Tooltip>{label}</Tooltip>}>
      <Button size="sm" className="vx-icon-btn" aria-label={label} {...rest}>
        <span className="material-symbols-outlined">{icon}</span>
      </Button>
    </OverlayTrigger>
  );
}

function techToInput(t: Technician): TechnicianInput {
  return { name: t.name, role: t.role ?? "", company: t.company ?? "", email: t.email ?? "", phone: t.phone ?? "", isLead: Boolean(t.is_lead) };
}
function instrToInput(i: Instrument): InstrumentInput {
  return {
    name: i.name, model: i.model ?? "", serialNumber: i.serial_number ?? "",
    certificateNumber: i.certificate_number ?? "", certificateLink: i.certificate_link ?? "",
    responsibleTechnicianId: i.responsible_technician_id ?? "",
    lastCalibrationDate: i.last_calibration_date?.slice(0, 10) ?? "",
    calibrationDueDate: i.calibration_due_date?.slice(0, 10) ?? "",
    notes: i.notes ?? ""
  };
}

export default function AssetsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["assets"], queryFn: listAssets });
  const [actionError, setActionError] = useState<string | null>(null);
  const [techModal, setTechModal] = useState<{ id: number | null; form: TechnicianInput } | null>(null);
  const [instrModal, setInstrModal] = useState<{ id: number | null; form: InstrumentInput } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["assets"] });
  const onError = (e: unknown) => setActionError((e as Error).message);

  const mTechCreate = useMutation({ mutationFn: createTechnician, onSuccess: () => { setTechModal(null); invalidate(); }, onError });
  const mTechUpdate = useMutation({ mutationFn: (p: { id: number; input: TechnicianInput }) => updateTechnician(p.id, p.input), onSuccess: () => { setTechModal(null); invalidate(); }, onError });
  const mTechDelete = useMutation({ mutationFn: deleteTechnician, onSuccess: invalidate, onError });
  const mInstrCreate = useMutation({ mutationFn: createInstrument, onSuccess: () => { setInstrModal(null); invalidate(); }, onError });
  const mInstrUpdate = useMutation({ mutationFn: (p: { id: number; input: InstrumentInput }) => updateInstrument(p.id, p.input), onSuccess: () => { setInstrModal(null); invalidate(); }, onError });
  const mInstrDelete = useMutation({ mutationFn: deleteInstrument, onSuccess: invalidate, onError });

  if (isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar equipe/instrumentos: {(error as Error).message}</Alert>;
  }

  const technicians = data?.technicians ?? [];
  const instruments = data?.instruments ?? [];
  const techName = (id: number | null) => technicians.find((t) => t.id === id)?.name ?? "—";

  const submitTech = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!techModal) return;
    if (techModal.id) mTechUpdate.mutate({ id: techModal.id, input: techModal.form });
    else mTechCreate.mutate(techModal.form);
  };
  const submitInstr = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!instrModal) return;
    if (instrModal.id) mInstrUpdate.mutate({ id: instrModal.id, input: instrModal.form });
    else mInstrCreate.mutate(instrModal.form);
  };

  return (
    <div className="d-flex flex-column gap-4">
      {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}

      {/* Técnicos */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Equipe técnica</span>
          <Button size="sm" onClick={() => setTechModal({ id: null, form: EMPTY_TECH })}>Novo técnico</Button>
        </Card.Header>
        <Table striped responsive hover className="mb-0 align-middle">
          <thead><tr><th>Nome</th><th>Função</th><th>Empresa</th><th>E-mail</th><th>Lead</th><th className="text-end">Ações</th></tr></thead>
          <tbody>
            {technicians.length === 0 && <tr><td colSpan={6} className="text-muted">Nenhum técnico.</td></tr>}
            {technicians.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td><td>{t.role}</td><td>{t.company}</td><td>{t.email}</td>
                <td>{t.is_lead ? <Badge bg="primary">Lead</Badge> : ""}</td>
                <td className="text-end">
                  <div className="vx-actions justify-content-end">
                    <IconAction icon="edit" label="Editar" variant="outline-secondary" onClick={() => setTechModal({ id: t.id, form: techToInput(t) })} />
                    <IconAction icon="handyman" label="Ferramentas" variant="outline-primary" as={Link} to={`/assets/technicians/${t.id}/tools`} />
                    <IconAction icon="delete" label="Excluir" variant="outline-danger" disabled={mTechDelete.isPending} onClick={() => { if (confirm(`Excluir o técnico "${t.name}"?`)) mTechDelete.mutate(t.id); }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Instrumentos */}
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <span>Instrumentos</span>
          <Button size="sm" onClick={() => setInstrModal({ id: null, form: EMPTY_INSTR })}>Novo instrumento</Button>
        </Card.Header>
        <Table striped responsive hover className="mb-0 align-middle">
          <thead><tr><th>Nome</th><th>Modelo</th><th>Nº de série</th><th>Certificado</th><th>Responsável</th><th>Próx. calibração</th><th className="text-end">Ações</th></tr></thead>
          <tbody>
            {instruments.length === 0 && <tr><td colSpan={7} className="text-muted">Nenhum instrumento.</td></tr>}
            {instruments.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{i.model}</td><td>{i.serial_number}</td><td>{i.certificate_number}</td>
                <td>{techName(i.responsible_technician_id)}</td><td>{i.calibration_due_date?.slice(0, 10) ?? "—"}</td>
                <td className="text-end">
                  <Button size="sm" variant="outline-secondary" className="me-2" onClick={() => setInstrModal({ id: i.id, form: instrToInput(i) })}>Editar</Button>
                  <Button size="sm" variant="outline-danger" disabled={mInstrDelete.isPending} onClick={() => { if (confirm(`Excluir o instrumento "${i.name}"?`)) mInstrDelete.mutate(i.id); }}>Excluir</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {/* Modal técnico */}
      <Modal show={!!techModal} onHide={() => setTechModal(null)}>
        <Modal.Header closeButton><Modal.Title>{techModal?.id ? "Editar técnico" : "Novo técnico"}</Modal.Title></Modal.Header>
        {techModal && (
          <Form onSubmit={submitTech}>
            <Modal.Body className="d-flex flex-column gap-3">
              <Form.Group>
                <Form.Label>Nome</Form.Label>
                <Form.Control required value={techModal.form.name} onChange={(e) => setTechModal({ ...techModal, form: { ...techModal.form, name: e.target.value } })} />
              </Form.Group>
              <div className="row g-3">
                <div className="col-md-6">
                  <Form.Label>Função</Form.Label>
                  <Form.Control value={techModal.form.role} onChange={(e) => setTechModal({ ...techModal, form: { ...techModal.form, role: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Empresa</Form.Label>
                  <Form.Control value={techModal.form.company} onChange={(e) => setTechModal({ ...techModal, form: { ...techModal.form, company: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>E-mail</Form.Label>
                  <Form.Control type="email" value={techModal.form.email} onChange={(e) => setTechModal({ ...techModal, form: { ...techModal.form, email: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Telefone</Form.Label>
                  <Form.Control value={techModal.form.phone} onChange={(e) => setTechModal({ ...techModal, form: { ...techModal.form, phone: e.target.value } })} />
                </div>
              </div>
              <Form.Check type="switch" label="Técnico líder (lead)" checked={techModal.form.isLead} onChange={(e) => setTechModal({ ...techModal, form: { ...techModal.form, isLead: e.target.checked } })} />
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setTechModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={mTechCreate.isPending || mTechUpdate.isPending}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>

      {/* Modal instrumento */}
      <Modal show={!!instrModal} onHide={() => setInstrModal(null)} size="lg">
        <Modal.Header closeButton><Modal.Title>{instrModal?.id ? "Editar instrumento" : "Novo instrumento"}</Modal.Title></Modal.Header>
        {instrModal && (
          <Form onSubmit={submitInstr}>
            <Modal.Body>
              <div className="row g-3">
                <div className="col-md-6">
                  <Form.Label>Nome</Form.Label>
                  <Form.Control required value={instrModal.form.name} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, name: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Modelo</Form.Label>
                  <Form.Control value={instrModal.form.model} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, model: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Nº de série</Form.Label>
                  <Form.Control value={instrModal.form.serialNumber} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, serialNumber: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Responsável</Form.Label>
                  <Form.Select
                    value={instrModal.form.responsibleTechnicianId === "" ? "" : instrModal.form.responsibleTechnicianId}
                    onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, responsibleTechnicianId: e.target.value ? Number(e.target.value) : "" } })}
                  >
                    <option value="">—</option>
                    {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Form.Select>
                </div>
                <div className="col-md-6">
                  <Form.Label>Nº do certificado</Form.Label>
                  <Form.Control value={instrModal.form.certificateNumber} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, certificateNumber: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Link do certificado</Form.Label>
                  <Form.Control value={instrModal.form.certificateLink} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, certificateLink: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Última calibração</Form.Label>
                  <Form.Control type="date" value={instrModal.form.lastCalibrationDate} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, lastCalibrationDate: e.target.value } })} />
                </div>
                <div className="col-md-6">
                  <Form.Label>Próxima calibração</Form.Label>
                  <Form.Control type="date" value={instrModal.form.calibrationDueDate} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, calibrationDueDate: e.target.value } })} />
                </div>
                <div className="col-12">
                  <Form.Label>Observações</Form.Label>
                  <Form.Control as="textarea" rows={2} value={instrModal.form.notes} onChange={(e) => setInstrModal({ ...instrModal, form: { ...instrModal.form, notes: e.target.value } })} />
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setInstrModal(null)}>Cancelar</Button>
              <Button type="submit" disabled={mInstrCreate.isPending || mInstrUpdate.isPending}>Salvar</Button>
            </Modal.Footer>
          </Form>
        )}
      </Modal>
    </div>
  );
}
