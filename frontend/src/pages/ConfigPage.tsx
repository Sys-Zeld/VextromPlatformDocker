import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Card, Form, Spinner } from "react-bootstrap";
import { ReportConfig, getConfig, saveConfig } from "../api/config";

const TEMPLATES = ["modern", "classic"];

export default function ConfigPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["report-config"], queryFn: getConfig });
  const [form, setForm] = useState<ReportConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { if (data) setForm(data); }, [data]);

  const mSave = useMutation({
    mutationFn: (input: ReportConfig) => saveConfig(input),
    onSuccess: (fresh) => {
      setForm(fresh);
      setSaved(true);
      qc.setQueryData(["report-config"], fresh);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e) => setActionError((e as Error).message)
  });

  if (isLoading || !form) {
    return <div className="d-flex align-items-center gap-2"><Spinner animation="border" size="sm" /> Carregando…</div>;
  }
  if (error) {
    return <Alert variant="danger">Falha ao carregar configuração: {(error as Error).message}</Alert>;
  }

  const set = (patch: Partial<ReportConfig>) => setForm({ ...form, ...patch });

  return (
    <Card>
      <Card.Header>Configuração do relatório</Card.Header>
      <Card.Body>
        {saved && <Alert variant="success">Configuração salva.</Alert>}
        {actionError && <Alert variant="danger" dismissible onClose={() => setActionError(null)}>{actionError}</Alert>}
        <Form onSubmit={(e) => { e.preventDefault(); mSave.mutate(form); }} className="d-flex flex-column gap-3">
          <div className="row g-3">
            <div className="col-md-4">
              <Form.Label>Template padrão</Form.Label>
              <Form.Select value={form.templateKey} onChange={(e) => set({ templateKey: e.target.value })}>
                {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Form.Select>
            </div>
            <div className="col-md-8">
              <Form.Label>Logo Vextrom (URL/caminho)</Form.Label>
              <Form.Control value={form.logoVextrom} onChange={(e) => set({ logoVextrom: e.target.value })} />
            </div>
            <div className="col-md-6">
              <Form.Label>Logo Chloride</Form.Label>
              <Form.Control value={form.logoChloride} onChange={(e) => set({ logoChloride: e.target.value })} />
            </div>
            <div className="col-md-6">
              <Form.Label>Logo da capa</Form.Label>
              <Form.Control value={form.logoCover} onChange={(e) => set({ logoCover: e.target.value })} />
            </div>
          </div>

          <Form.Group>
            <Form.Label>Rodapé (HTML)</Form.Label>
            <Form.Control as="textarea" rows={3} value={form.footerHtml} onChange={(e) => set({ footerHtml: e.target.value })} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Escopo padrão (HTML)</Form.Label>
            <Form.Control as="textarea" rows={4} value={form.defaultScopeHtml} onChange={(e) => set({ defaultScopeHtml: e.target.value })} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Recomendações padrão (HTML)</Form.Label>
            <Form.Control as="textarea" rows={4} value={form.defaultRecommendationsHtml} onChange={(e) => set({ defaultRecommendationsHtml: e.target.value })} />
          </Form.Group>

          <div>
            <Button type="submit" disabled={mSave.isPending}>{mSave.isPending ? "Salvando…" : "Salvar configuração"}</Button>
          </div>
        </Form>
      </Card.Body>
      <Card.Footer className="text-muted small">
        Upload binário de logos continua no sistema legado; aqui é possível apontar URLs/caminhos.
      </Card.Footer>
    </Card>
  );
}
