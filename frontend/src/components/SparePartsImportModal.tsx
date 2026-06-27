import { useState } from "react";
import { Alert, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import {
  ExtractedSparePart,
  aiExtractSpareParts,
  bulkImportSpareParts
} from "../api/spareParts";

interface Props {
  show: boolean;
  onHide: () => void;
  /** Se informado, importa para o equipamento; senão, para o catálogo global. */
  equipmentId?: number;
  onImported: () => void;
}

type Row = ExtractedSparePart & { _selected: boolean };

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

export default function SparePartsImportModal({ show, onHide, equipmentId, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const reset = () => { setFile(null); setRows([]); setError(null); setDone(null); };
  const close = () => { reset(); onHide(); };

  const extract = async () => {
    if (!file) return;
    setError(null); setDone(null); setExtracting(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const res = await aiExtractSpareParts({ fileBase64, fileName: file.name, mimeType: file.type || "application/pdf" });
      setRows(res.spareParts.map((s) => ({ ...s, _selected: true })));
      if (!res.spareParts.length) setError("Nenhuma peça identificada no documento.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  };

  const importSelected = async () => {
    const selected = rows.filter((r) => r._selected).map(({ _selected, ...rest }) => rest);
    if (!selected.length) { setError("Selecione ao menos uma peça."); return; }
    setError(null); setImporting(true);
    try {
      const res = await bulkImportSpareParts(selected, equipmentId);
      const parts = [`${res.inserted} inserida(s)`];
      if (res.updated) parts.push(`${res.updated} atualizada(s)`);
      if (res.linked) parts.push(`${res.linked} vinculada(s)`);
      if (res.skipped) parts.push(`${res.skipped} ignorada(s)`);
      setDone(`Importação concluída: ${parts.join(", ")}.`);
      setRows([]);
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const toggle = (idx: number) => setRows(rows.map((r, i) => (i === idx ? { ...r, _selected: !r._selected } : r)));
  const selectedCount = rows.filter((r) => r._selected).length;

  return (
    <Modal show={show} onHide={close} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>
          Importar peças por IA/PDF {equipmentId ? "(para o equipamento)" : "(catálogo)"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
        {done && <Alert variant="success">{done}</Alert>}

        <div className="d-flex align-items-end gap-2 mb-3">
          <div className="flex-grow-1">
            <Form.Label>Documento (PDF)</Form.Label>
            <Form.Control type="file" accept="application/pdf,.pdf" onChange={(e) => {
              const f = (e.target as HTMLInputElement).files?.[0] || null;
              setFile(f); setRows([]); setDone(null);
            }} />
          </div>
          <Button onClick={extract} disabled={!file || extracting}>
            {extracting ? <><Spinner animation="border" size="sm" /> Extraindo…</> : "Extrair com IA"}
          </Button>
        </div>

        {rows.length > 0 && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <strong>{rows.length} peça(s) identificada(s)</strong>
              <span className="text-muted small">{selectedCount} selecionada(s)</span>
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              <Table striped size="sm" hover className="align-middle">
                <thead><tr><th></th><th>Descrição</th><th>Part Number</th><th>Fabricante</th><th>Família</th><th>Qtd.</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td><Form.Check checked={r._selected} onChange={() => toggle(i)} /></td>
                      <td>{r.description}</td>
                      <td>{r.part_number}</td>
                      <td>{r.manufacturer}</td>
                      <td>{r.equipment_family}</td>
                      <td>{r.quantity ?? 1}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>Fechar</Button>
        <Button onClick={importSelected} disabled={!selectedCount || importing}>
          {importing ? "Importando…" : `Importar ${selectedCount || ""} selecionada(s)`}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
