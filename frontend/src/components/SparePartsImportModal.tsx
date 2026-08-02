import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import type { Customer } from "../api/customers";
import type { Equipment } from "../api/equipments";
import {
  ExtractedSparePart,
  aiExtractSpareParts,
  bulkImportSpareParts,
  getSparePartsAiConfig
} from "../api/spareParts";

interface Props {
  show: boolean;
  onHide: () => void;
  /** Se informado, importa direto para este equipamento (esconde o seletor). */
  equipmentId?: number;
  onImported: () => void;
  /** Para o seletor de associação quando não há equipamento fixo (import do catálogo). */
  customers?: Customer[];
  equipments?: Equipment[];
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function equipmentLabel(eq: Equipment): string {
  const parts = [eq.tag_number, eq.serial_number, eq.type].filter(Boolean);
  return parts.length ? parts.join(" - ") : `ID ${eq.id}`;
}

function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

interface JsonInfo { valid: boolean; count: number; withDesc: number; totalQty: number; duplicates: number; error: string | null }

const EMPTY_INFO = { valid: false, count: 0, withDesc: 0, totalQty: 0, duplicates: 0 };

/** Chave de consolidação: PN quando houver, senão a descrição (igual ao servidor). */
function itemKey(item: ExtractedSparePart): string {
  const pn = String(item.part_number || "").trim().toLowerCase();
  return pn ? `pn:${pn}` : `desc:${String(item.description || "").trim().toLowerCase()}`;
}

function itemQty(item: ExtractedSparePart): number {
  const n = Number(item.quantity);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** Junta itens repetidos somando a quantidade — o mesmo critério do backend. */
function consolidate(items: ExtractedSparePart[]): ExtractedSparePart[] {
  const byKey = new Map<string, ExtractedSparePart>();
  for (const item of items) {
    const key = itemKey(item);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, { ...item, quantity: itemQty(item) });
      continue;
    }
    current.quantity = itemQty(current) + itemQty(item);
    // Ocorrências seguintes preenchem o que veio vazio na primeira.
    for (const field of ["manufacturer", "equipment_model", "equipment_family", "lead_time", "replaced_by_part_number"] as const) {
      if (!current[field] && item[field]) current[field] = item[field];
    }
    current.is_obsolete = Boolean(current.is_obsolete) || Boolean(item.is_obsolete);
  }
  return [...byKey.values()];
}

function inspectJson(raw: string): JsonInfo {
  const text = raw.trim();
  if (!text) return { ...EMPTY_INFO, error: null };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch (e) { return { ...EMPTY_INFO, error: (e as Error).message }; }
  if (!Array.isArray(parsed)) return { ...EMPTY_INFO, error: "O JSON deve ser um array [ ]." };
  const items = parsed as ExtractedSparePart[];
  const withDesc = items.filter((it) => String(it.description || "").trim()).length;
  const totalQty = items.reduce((sum, it) => sum + itemQty(it), 0);
  const duplicates = items.length - new Set(items.map(itemKey)).size;
  return { valid: true, count: items.length, withDesc, totalQty, duplicates, error: null };
}

export default function SparePartsImportModal({ show, onHide, equipmentId, onImported, customers = [], equipments = [] }: Props) {
  const [prompt, setPrompt] = useState("");
  const [schema, setSchema] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [customerId, setCustomerId] = useState("");
  const [selEquip, setSelEquip] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  // Carrega prompt + schema ao abrir (uma vez).
  useEffect(() => {
    if (!show || prompt) return;
    getSparePartsAiConfig()
      .then((cfg) => { setPrompt(cfg.defaultPrompt || ""); setSchema(cfg.jsonSchema || ""); })
      .catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const startTimer = () => {
    const startedAt = Date.now();
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
  };
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const extract = async () => {
    if (!file) return;
    setError(null); setDone(null); setJsonText(""); setExtracting(true);
    setStatus("Processando…"); startTimer();
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await aiExtractSpareParts({
        fileBase64, fileName: file.name, mimeType: file.type || "application/pdf", promptTemplate: prompt.trim()
      });
      // Já entrega consolidado: repetidos viram um item com a quantidade somada.
      const items = consolidate(res.spareParts);
      const mergedCount = res.spareParts.length - items.length;
      setJsonText(JSON.stringify(items, null, 2));
      setStatus(items.length
        ? `Concluído${mergedCount ? ` — ${mergedCount} duplicado(s) consolidado(s) na quantidade` : ""}`
        : "Nenhuma peça identificada.");
    } catch (e) {
      setStatus("Falha");
      setError((e as Error).message);
    } finally {
      stopTimer();
      setExtracting(false);
    }
  };

  const loadJsonFile = async (f: File | null) => {
    if (!f) return;
    try { setJsonText((await f.text()).trim()); } catch (e) { setError((e as Error).message); }
    if (jsonFileRef.current) jsonFileRef.current.value = "";
  };

  // Aplica a consolidação no JSON em revisão (para JSON colado ou editado à mão).
  const consolidateJson = () => {
    try {
      const items = JSON.parse(jsonText) as ExtractedSparePart[];
      if (!Array.isArray(items)) return;
      setJsonText(JSON.stringify(consolidate(items), null, 2));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const importItems = async () => {
    const info = inspectJson(jsonText);
    if (!info.valid || info.withDesc === 0) { setError("Revise o JSON: precisa ser um array com ao menos 1 item com descrição."); return; }
    const items = JSON.parse(jsonText) as ExtractedSparePart[];
    const effectiveEquipmentId = equipmentId ?? (selEquip ? Number(selEquip) : undefined);
    setError(null); setImporting(true); setDone(null);
    try {
      const res = await bulkImportSpareParts(items, effectiveEquipmentId);
      const parts = [`${res.inserted} inserida(s)`];
      if (res.merged) parts.push(`${res.merged} duplicada(s) somada(s) na quantidade`);
      if (res.updated) parts.push(`${res.updated} atualizada(s)`);
      if (res.linked) parts.push(`${res.linked} vinculada(s)`);
      if (res.skipped) parts.push(`${res.skipped} ignorada(s)`);
      setDone(`Importação concluída: ${parts.join(", ")}.`);
      setJsonText("");
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const close = () => {
    stopTimer();
    setFile(null); setJsonText(""); setError(null); setDone(null); setStatus(""); setElapsed(0);
    setCustomerId(""); setSelEquip("");
    onHide();
  };

  const jsonInfo = inspectJson(jsonText);
  const filteredEquipments = customerId ? equipments.filter((e) => Number(e.customer_id) === Number(customerId)) : [];

  return (
    <Modal show={show} onHide={close} size="xl" scrollable>
      <Modal.Header closeButton>
        <Modal.Title>🤖 Importar Spare Parts com IA {equipmentId ? "(para o equipamento)" : ""}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {done && <Alert variant="success" dismissible onClose={() => setDone(null)}>{done}</Alert>}

        {/* 1) Schema */}
        <div className="mb-4">
          <div className="d-flex align-items-center gap-2 mb-2"><Badge bg="secondary" pill>1</Badge><strong className="small">Modelo JSON (schema da tabela spare_parts)</strong></div>
          <p className="text-muted small mb-2">Estrutura que a IA vai preencher para cada peça encontrada no documento.</p>
          {/* Cores vêm do tema — fundo fixo claro deixava o texto ilegível no DarkVextrom. */}
          <pre className="border rounded p-2 small vx-code-block" style={{ maxHeight: 160, overflow: "auto", fontSize: "0.76rem" }}>{schema || "—"}</pre>
        </div>

        {/* 2) Prompt editável */}
        <div className="mb-4">
          <div className="d-flex align-items-center gap-2 mb-2"><Badge bg="secondary" pill>2</Badge><strong className="small">Prompt para a IA <span className="text-muted fw-normal">(editável)</span></strong></div>
          <p className="text-muted small mb-2">O prompt é enviado junto com o documento. Edite conforme necessário.</p>
          <Form.Control as="textarea" rows={8} className="font-monospace" style={{ fontSize: "0.76rem" }} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        </div>

        {/* 3) Documento */}
        <div className="mb-4">
          <div className="d-flex align-items-center gap-2 mb-2"><Badge bg="secondary" pill>3</Badge><strong className="small">Enviar documento para a IA</strong></div>
          <p className="text-muted small mb-2">Selecione um documento com a lista de spare parts (PDF, TXT ou XLSX). A IA lê e extrai os dados.</p>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <Form.Control
              type="file"
              size="sm"
              style={{ maxWidth: 420 }}
              accept="application/pdf,.pdf,text/plain,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls"
              onChange={(e) => { setFile((e.target as HTMLInputElement).files?.[0] ?? null); setDone(null); }}
            />
            <Button variant="outline-primary" size="sm" disabled={!file || extracting} onClick={extract}>
              {extracting ? <><Spinner animation="border" size="sm" className="me-1" /> Extraindo…</> : "Extrair com IA"}
            </Button>
          </div>
          {(status || extracting) && <div className={`mt-2 small ${status === "Falha" ? "text-danger" : status.startsWith("Concluído") ? "text-success" : "text-warning"}`}>Status: {status} | Tempo: {formatElapsed(elapsed)}</div>}
        </div>

        {/* 4) Revisar JSON */}
        <div className="mb-2">
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            <Badge bg="success" pill>4</Badge><strong className="small">Revisar JSON</strong>
            {jsonInfo.valid && <Badge bg="success">{jsonInfo.count} itens</Badge>}
            {jsonInfo.valid && <Badge bg="info">qt. total {jsonInfo.totalQty}</Badge>}
            {jsonInfo.duplicates > 0 && (
              <Button size="sm" variant="outline-warning" onClick={consolidateJson}>
                Consolidar {jsonInfo.duplicates} duplicado(s)
              </Button>
            )}
            {!jsonInfo.valid && jsonText.trim() && <Badge bg="danger">inválido</Badge>}
            <span className="text-muted small ms-auto">ou carregue um .json:</span>
            <Form.Control ref={jsonFileRef} type="file" size="sm" accept="application/json,.json" style={{ maxWidth: 200 }} onChange={(e) => loadJsonFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
          </div>
          <p className="text-muted small mb-2">
            Revise/edite os dados antes de importar. Você pode editar o JSON manualmente, colar ou carregar um arquivo.
            O campo <code>quantity</code> é a quantidade da peça — itens repetidos são somados nele em vez de duplicar a linha.
          </p>
          <Form.Control as="textarea" rows={12} className="font-monospace" style={{ fontSize: "0.76rem" }} spellCheck={false} value={jsonText} onChange={(e) => setJsonText(e.target.value)} placeholder="JSON gerado pela IA ou colado/carregado diretamente…" />
          <div className="mt-2 small">
            {jsonInfo.error && <span className="text-danger">❌ JSON inválido: {jsonInfo.error}</span>}
            {jsonInfo.valid && (
              <span className="text-success">
                ✅ JSON válido — <strong>{jsonInfo.count}</strong> item(s), <strong>{jsonInfo.withDesc}</strong> com descrição,
                quantidade total <strong>{jsonInfo.totalQty}</strong>.
                {jsonInfo.duplicates > 0 && <span className="text-warning"> Há {jsonInfo.duplicates} repetido(s) — serão somados na quantidade ao importar.</span>}
              </span>
            )}
          </div>
        </div>

        {/* 5) Associação a equipamento (só no import de catálogo) */}
        {!equipmentId && (
          <div className="mb-2 mt-3 pt-3 border-top">
            <div className="d-flex align-items-center gap-2 mb-2"><Badge bg="secondary" pill>5</Badge><strong className="small">Associar ao equipamento <span className="text-muted fw-normal">(opcional)</span></strong></div>
            <p className="text-muted small mb-2">Se selecionar um equipamento, os PNs novos são cadastrados e vinculados; PNs já existentes são apenas vinculados (sem duplicar).</p>
            <div className="row g-2">
              <div className="col-12 col-md-6">
                <Form.Select size="sm" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setSelEquip(""); }}>
                  <option value="">— Nenhum cliente (não associar) —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Form.Select>
              </div>
              <div className="col-12 col-md-6">
                <Form.Select size="sm" value={selEquip} disabled={!customerId || filteredEquipments.length === 0} onChange={(e) => setSelEquip(e.target.value)}>
                  <option value="">{!customerId ? "— Selecione um cliente primeiro —" : filteredEquipments.length ? "— Nenhum equipamento (não associar) —" : "— Nenhum equipamento para este cliente —"}</option>
                  {filteredEquipments.map((eq) => <option key={eq.id} value={eq.id}>{equipmentLabel(eq)}</option>)}
                </Form.Select>
              </div>
            </div>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>Fechar</Button>
        <Button variant="success" disabled={!jsonInfo.valid || jsonInfo.withDesc === 0 || importing} onClick={importItems}>
          {importing ? <><Spinner animation="border" size="sm" className="me-1" /> Importando…</> : "Importar Spare Parts"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
