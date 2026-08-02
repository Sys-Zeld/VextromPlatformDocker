import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface PrintColumn {
  key: string;
  label: string;
  width?: string;
  align?: "start" | "center" | "end";
}

/** Bloco com título próprio — usado no consolidado por equipamento. */
export interface PrintSection {
  title: string;
  subtitle?: string;
  rows: Record<string, string>[];
}

export interface PrintSheetProps {
  title: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  columns: PrintColumn[];
  /** Lista simples. Ignorado quando `sections` é informado. */
  rows?: Record<string, string>[];
  /** Lista agrupada: cada seção vira um cabeçalho + tabela própria. */
  sections?: PrintSection[];
  /** Valor do @page (ex.: "A4", "A4 landscape"), injetado só durante a impressão. */
  paper?: string;
  /** Chamado quando o diálogo de impressão fecha — desmonta a folha. */
  onClose: () => void;
}

const PAGE_STYLE_ID = "vx-print-page-size";

// Folha de impressão em portal no body: fica oculta na tela e só aparece no
// @media print, com o resto do SPA (.vx-shell) escondido. Monte-a apenas no
// momento de imprimir — ela dispara window.print() sozinha e avisa via onClose.
export default function PrintSheet({ title, subtitle, meta = [], columns, rows, sections, paper = "A4", onClose }: PrintSheetProps) {
  useEffect(() => {
    document.getElementById(PAGE_STYLE_ID)?.remove();
    const style = document.createElement("style");
    style.id = PAGE_STYLE_ID;
    style.textContent = `@page { size: ${paper}; margin: 12mm 10mm; }`;
    document.head.appendChild(style);
    // Marca html e body: o tema escuro pinta os dois, e a folha é sempre branca.
    document.documentElement.classList.add("vx-printing");
    document.body.classList.add("vx-printing");

    const teardown = () => {
      document.documentElement.classList.remove("vx-printing");
      document.body.classList.remove("vx-printing");
      style.remove();
    };
    const afterPrint = () => { teardown(); onClose(); };
    window.addEventListener("afterprint", afterPrint, { once: true });

    // Dois frames para garantir que o portal já pintou antes do diálogo abrir.
    let frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => window.print()); });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", afterPrint);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
  // Sem `sections`, a folha é uma seção única e sem título.
  const blocks: PrintSection[] = sections ?? [{ title: "", rows: rows ?? [] }];
  const totalRows = blocks.reduce((sum, b) => sum + b.rows.length, 0);

  const renderTable = (block: PrintSection) => (
    <table className="vx-print-sheet__table">
      <thead>
        <tr>
          {columns.map((c) => <th key={c.key} style={{ width: c.width, textAlign: c.align }}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {block.rows.length === 0 && <tr><td colSpan={columns.length}>Nenhum item.</td></tr>}
        {block.rows.map((r, i) => (
          <tr key={i}>
            {columns.map((c) => <td key={c.key} style={{ textAlign: c.align }}>{r[c.key] ?? ""}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return createPortal(
    <section className="vx-print-sheet" aria-hidden="true">
      <header className="vx-print-sheet__header">
        <img className="vx-print-sheet__logo" src="/public/img/logo-vextrom.svg" alt="Vextrom" />
        <div className="vx-print-sheet__title">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <span className="vx-print-sheet__stamp">Emitido em {generatedAt}</span>
      </header>

      {meta.length > 0 && (
        <dl className="vx-print-sheet__meta">
          {meta.map((m) => (
            <div key={m.label}>
              <dt>{m.label}</dt>
              <dd>{m.value || "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      {sections
        ? blocks.map((block, i) => (
            <section key={i} className="vx-print-sheet__group">
              <h2 className="vx-print-sheet__group-title">
                {block.title}
                {block.subtitle && <small>{block.subtitle}</small>}
              </h2>
              {renderTable(block)}
            </section>
          ))
        : renderTable(blocks[0])}

      <footer className="vx-print-sheet__footer">
        <span>Vextrom Platform · Service Report</span>
        <span>{sections ? `${blocks.length} equipamento(s) · ` : ""}{totalRows} item(ns)</span>
      </footer>
    </section>,
    document.body
  );
}
