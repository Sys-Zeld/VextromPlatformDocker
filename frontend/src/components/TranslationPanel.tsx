import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Badge, Button, Card, Form, ProgressBar } from "react-bootstrap";
import {
  ReportLanguage,
  getTranslateJob,
  startTranslateReport
} from "../api/reportEditor";

export default function TranslationPanel(props: {
  orderId: number;
  languages: ReportLanguage[];
  currentLanguage: string;
  locked: boolean;
  onTranslated: () => void;
}) {
  const { orderId, languages, currentLanguage, locked, onTranslated } = props;
  const otherLangs = languages.filter((l) => l.key !== currentLanguage);
  const [target, setTarget] = useState(otherLangs[0]?.key ?? languages[0]?.key ?? "en");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const currentLabel = languages.find((l) => l.key === currentLanguage)?.label ?? currentLanguage;

  const mStart = useMutation({
    mutationFn: () => startTranslateReport(orderId, target),
    onSuccess: (job) => { setError(null); setDoneMsg(null); setJobId(job.jobId); },
    onError: (e: unknown) => setError((e as Error).message)
  });

  const { data: job } = useQuery({
    queryKey: ["translate-job", orderId, jobId],
    queryFn: () => getTranslateJob(orderId, jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1500;
    }
  });

  // Ao concluir/falhar, encerra o polling e atualiza o relatório.
  useEffect(() => {
    if (!job) return;
    if (job.status === "completed") {
      setJobId(null);
      setDoneMsg(job.message || "Tradução concluída.");
      onTranslated();
    } else if (job.status === "failed") {
      setJobId(null);
      setError(job.error || "Falha ao traduzir o relatório.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status]);

  const running = mStart.isPending || (!!job && (job.status === "queued" || job.status === "running"));
  const progress = job?.progress ?? (mStart.isPending ? 1 : 0);

  return (
    <Card>
      <Card.Header className="d-flex justify-content-between align-items-center">
        <span>Tradução automática do relatório (IA)</span>
        <Badge bg="secondary">Idioma atual: {currentLabel}</Badge>
      </Card.Header>
      <Card.Body>
        <p className="text-muted small mb-3">
          Traduz todo o conteúdo do relatório (título, capítulos, descrições diárias, componentes, medições e legendas)
          para o idioma escolhido. O processo roda em segundo plano e o conteúdo salvo é substituído pela tradução.
        </p>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {doneMsg && <Alert variant="success" dismissible onClose={() => setDoneMsg(null)}>{doneMsg}</Alert>}

        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <Form.Label>Traduzir para</Form.Label>
            <Form.Select value={target} disabled={locked || running} onChange={(e) => setTarget(e.target.value)}>
              {languages.map((l) => (
                <option key={l.key} value={l.key} disabled={l.key === currentLanguage}>
                  {l.label}{l.key === currentLanguage ? " (atual)" : ""}
                </option>
              ))}
            </Form.Select>
          </div>
          <div className="col-12 col-md-3">
            <Button variant="primary" disabled={locked || running || !target} onClick={() => mStart.mutate()}>
              {running ? "Traduzindo…" : "Traduzir"}
            </Button>
          </div>
        </div>

        {(running || (job && job.progress > 0 && job.progress < 100)) && (
          <div className="mt-3">
            <div className="d-flex justify-content-between small text-muted mb-1">
              <span>{job?.message || "Iniciando tradução com IA…"}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <ProgressBar now={progress} label={`${Math.round(progress)}%`} striped animated />
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
