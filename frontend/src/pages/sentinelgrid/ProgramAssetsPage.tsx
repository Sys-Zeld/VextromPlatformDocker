import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, Spinner } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";
import { listChecklists } from "../../api/sentinelgrid/checklists";
import {
  listMaintenancePrograms,
  programDocumentUrl,
  updateProgramAssets,
  uploadProgramDocument
} from "../../api/sentinelgrid/programs";

export default function ProgramAssetsPage() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProgramId = Number(searchParams.get("program")) || null;
  const [programId, setProgramId] = useState<number | null>(requestedProgramId);
  const [selectedChecklists, setSelectedChecklists] = useState<Set<number>>(new Set());
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [nameplateFile, setNameplateFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const programsQuery = useQuery({
    queryKey: ["sentinelgrid", "programs", "assets"],
    queryFn: () => listMaintenancePrograms({ pageSize: 100 })
  });
  const checklistsQuery = useQuery({
    queryKey: ["sentinelgrid", "checklists", "assets"],
    queryFn: () => listChecklists({ pageSize: 100 })
  });

  const programs = programsQuery.data?.programs ?? [];
  const program = programs.find((item) => item.id === programId) ?? null;
  const availableChecklists = useMemo(
    () => (checklistsQuery.data?.checklists ?? []).filter((item) => !item.program_id || item.program_id === programId),
    [checklistsQuery.data, programId]
  );

  useEffect(() => {
    if (!programId && programs.length) {
      setProgramId(programs[0].id);
      setSearchParams({ program: String(programs[0].id) }, { replace: true });
    }
  }, [programId, programs, setSearchParams]);

  useEffect(() => {
    setSelectedChecklists(new Set((program?.checklist_ids ?? []).map(Number)));
    setManualFile(null);
    setNameplateFile(null);
    setMessage(null);
    setError(null);
  }, [program]);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["sentinelgrid", "programs"] });
  };
  const fail = (e: unknown) => { setMessage(null); setError((e as Error).message); };

  const saveChecklists = useMutation({
    mutationFn: () => updateProgramAssets(programId!, [...selectedChecklists]),
    onSuccess: async () => { setError(null); setMessage("Checklists vinculados com sucesso."); await refresh(); },
    onError: fail
  });
  const uploadManual = useMutation({
    mutationFn: () => uploadProgramDocument(programId!, "manual", manualFile!),
    onSuccess: async () => { setManualFile(null); setError(null); setMessage("Manual enviado com sucesso."); await refresh(); },
    onError: fail
  });
  const uploadNameplate = useMutation({
    mutationFn: () => uploadProgramDocument(programId!, "nameplate", nameplateFile!),
    onSuccess: async () => { setNameplateFile(null); setError(null); setMessage("Plaqueta enviada com sucesso."); await refresh(); },
    onError: fail
  });

  const toggleChecklist = (id: number) => setSelectedChecklists((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (programsQuery.isLoading || checklistsQuery.isLoading) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando assets...</div>;
  }

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
        <div>
          <h2 className="h5 mb-1">SentinelGrid - Assets do Programa</h2>
          <p className="text-muted small mb-0">Centralize checklists, manual do equipamento e imagem da plaqueta.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/sentinelgrid/checklists" className="btn btn-outline-primary btn-sm">Biblioteca de checklists</Link>
          <Link to="/sentinelgrid/programs" className="btn btn-outline-secondary btn-sm">Programas</Link>
        </div>
      </div>

      {(programsQuery.error || checklistsQuery.error) && <Alert variant="danger">Falha ao carregar os dados.</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      {message && <Alert variant="success" dismissible onClose={() => setMessage(null)}>{message}</Alert>}

      <Card>
        <Card.Body>
          <Form.Label>Programa</Form.Label>
          <Form.Select value={programId ?? ""} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; setProgramId(id); if (id) setSearchParams({ program: String(id) }); }}>
            {programs.length === 0 && <option value="">Nenhum programa cadastrado</option>}
            {programs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </Form.Select>
        </Card.Body>
      </Card>

      {program && (
        <div className="row g-4">
          <div className="col-lg-7">
            <Card className="h-100">
              <Card.Header className="d-flex justify-content-between align-items-center">
                <span>Checklists vinculados</span>
                <Badge bg="primary">{selectedChecklists.size}</Badge>
              </Card.Header>
              <Card.Body className="d-flex flex-column gap-3">
                {availableChecklists.length === 0 ? (
                  <Alert variant="secondary" className="mb-0">Nenhum checklist livre. Cadastre um novo checklist na biblioteca.</Alert>
                ) : (
                  <div className="d-flex flex-column gap-2" style={{ maxHeight: 360, overflowY: "auto" }}>
                    {availableChecklists.map((item) => (
                      <div key={item.id} className="border rounded p-2">
                        <Form.Check
                          id={`program-checklist-${item.id}`}
                          checked={selectedChecklists.has(item.id)}
                          onChange={() => toggleChecklist(item.id)}
                          label={<><span className="fw-medium">{item.name}</span><span className="d-block small text-muted">{item.description || item.maintenance_type}</span></>}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <Button size="sm" onClick={() => saveChecklists.mutate()} disabled={saveChecklists.isPending}>
                    {saveChecklists.isPending ? "Salvando..." : "Salvar checklists"}
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </div>

          <div className="col-lg-5 d-flex flex-column gap-4">
            <Card>
              <Card.Header>Manual do equipamento</Card.Header>
              <Card.Body className="d-flex flex-column gap-2">
                {program.manual_original_name ? <a href={programDocumentUrl(program.id, "manual")} target="_blank" rel="noreferrer">Abrir {program.manual_original_name}</a> : <span className="small text-muted">Nenhum manual enviado.</span>}
                <Form.Control type="file" accept="application/pdf,.pdf" onChange={(e) => setManualFile((e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
                <Button size="sm" className="align-self-start" onClick={() => uploadManual.mutate()} disabled={!manualFile || uploadManual.isPending}>{uploadManual.isPending ? "Enviando..." : program.manual_original_name ? "Substituir manual" : "Enviar manual"}</Button>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header>Plaqueta de informação</Card.Header>
              <Card.Body className="d-flex flex-column gap-2">
                {program.nameplate_original_name ? (
                  <a href={programDocumentUrl(program.id, "nameplate")} target="_blank" rel="noreferrer">
                    <img src={programDocumentUrl(program.id, "nameplate")} alt={`Plaqueta de ${program.name}`} className="img-fluid rounded border mb-1" style={{ maxHeight: 180, objectFit: "contain" }} />
                    <span className="d-block small">Abrir {program.nameplate_original_name}</span>
                  </a>
                ) : <span className="small text-muted">Nenhuma imagem enviada.</span>}
                <Form.Control type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(e) => setNameplateFile((e.currentTarget as HTMLInputElement).files?.[0] ?? null)} />
                <Button size="sm" className="align-self-start" onClick={() => uploadNameplate.mutate()} disabled={!nameplateFile || uploadNameplate.isPending}>{uploadNameplate.isPending ? "Enviando..." : program.nameplate_original_name ? "Substituir plaqueta" : "Enviar plaqueta"}</Button>
              </Card.Body>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
