const XLSX = require("xlsx");

// Exportação dos relatórios gerenciais (documento unificado do reportsService)
// para XLSX, CSV e PDF. Um único conjunto de builders serve os três relatórios.

const SUMMARY_HEADER = ["Total", "Concluídas", "Pendentes", "Atrasadas", "Canceladas", "Dias", "% Conclusão"];

const summaryValues = (s) => [s.total, s.concluidas, s.pendentes, s.atrasadas, s.canceladas, s.dias,
  s.conclusaoRate === null ? "-" : `${s.conclusaoRate}%`];

const fmtDate = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");

// Tasks que caem dentro de uma coluna do período (sobreposição de intervalos).
const tasksInColumn = (tasks, column) =>
  tasks.filter((t) => t.startDate <= column.to && t.endDate >= column.from);

/* ------------------------------- XLSX / CSV ------------------------------- */

// Aba "Resumo": uma linha por equipamento/técnico/cliente + totais.
function summarySheet(doc) {
  const aoa = [
    [doc.title],
    [doc.subtitle],
    [],
    [doc.groupLabel, "Detalhe", ...SUMMARY_HEADER]
  ];
  for (const row of doc.rows) aoa.push([row.title, row.subtitle, ...summaryValues(row.summary)]);
  aoa.push([]);
  aoa.push(["TOTAL", `${doc.totals.linhas} linha(s)`, ...summaryValues(doc.totals)]);
  return XLSX.utils.aoa_to_sheet(aoa);
}

// Aba "Cronograma": matriz linha × período, cada célula com as OMs do intervalo.
function scheduleSheet(doc) {
  const aoa = [
    [doc.title, doc.subtitle],
    [],
    [doc.groupLabel, ...doc.columns.map((c) => c.label)]
  ];
  for (const row of doc.rows) {
    aoa.push([
      row.title,
      ...doc.columns.map((column) =>
        tasksInColumn(row.tasks, column)
          .map((t) => `${t.startDate.slice(8, 10)} ${t.orderNumber}`)
          .join("\n"))
    ]);
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

// Aba "Ordens": lista achatada — a mais útil para análise/tabela dinâmica no Excel.
function ordersSheet(doc) {
  const aoa = [[
    doc.groupLabel, "OM", "Status", "Tipo", "Prioridade", "Início", "Fim", "Dias",
    "Equipamento", "Cliente", "Site", "Técnico", "Plano", "Descrição"
  ]];
  for (const row of doc.rows) {
    for (const t of row.tasks) {
      aoa.push([
        row.title, t.orderNumber, t.statusLabel, t.maintenanceTypeLabel, t.priority,
        fmtDate(t.startDate), fmtDate(t.endDate), t.executionDays,
        t.equipmentTag || "", t.clientName || "", t.siteName || "",
        t.technicianName || "", t.planName || "", t.label || ""
      ]);
    }
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildWorkbook(doc) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, summarySheet(doc), "Resumo");
  XLSX.utils.book_append_sheet(wb, scheduleSheet(doc), "Cronograma");
  XLSX.utils.book_append_sheet(wb, ordersSheet(doc), "Ordens");
  return wb;
}

function buildXlsxBuffer(doc) {
  return XLSX.write(buildWorkbook(doc), { type: "buffer", bookType: "xlsx" });
}

// CSV exporta a lista achatada de OMs — a matriz do cronograma não sobrevive ao formato.
function buildCsv(doc) {
  return XLSX.utils.sheet_to_csv(ordersSheet(doc), { FS: ";" });
}

/* ---------------------------------- PDF ----------------------------------- */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ESC[ch]);

// Documento autocontido: o renderizador aborta todo request externo, então nada
// de CSS/imagem remota. __reportPaginationDone evita o timeout de 10s do servidor
// puppeteer, que espera esse flag antes de imprimir.
function buildPdfHtml(doc) {
  const wide = doc.columns.length > 13; // visão diária precisa de fonte menor
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<title>${esc(doc.title)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Tahoma, sans-serif; color: #1f2937; margin: 0; font-size: ${wide ? 7 : 9}px; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .sub { color: #6b7280; font-size: 10px; margin-bottom: 10px; }
  .meta { color: #9ca3af; font-size: 8px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #d1d5db; padding: 3px 4px; text-align: left; vertical-align: top; }
  thead { display: table-header-group; }
  th { background: #f3f4f6; font-weight: 600; }
  .ident { min-width: 120px; }
  .ident small { display: block; color: #6b7280; font-weight: 400; }
  .num { text-align: right; white-space: nowrap; }
  .total td { background: #f9fafb; font-weight: 700; }
  .task { display: block; border-left: 3px solid #94a3b8; padding-left: 3px; margin-bottom: 2px; }
  .task--concluida { border-color: #16a34a; }
  .task--atrasada { border-color: #dc2626; }
  .task b { font-weight: 600; }
  h2 { font-size: 12px; margin: 14px 0 4px; page-break-after: avoid; }
</style></head><body>
<h1>${esc(doc.title)}</h1>
<div class="sub">${esc(doc.subtitle)}</div>
<div class="meta">Gerado em ${new Date(doc.generatedAt).toLocaleString("pt-BR")} · SentinelGrid</div>

<h2>Resumo gerencial</h2>
<table>
  <thead><tr><th class="ident">${esc(doc.groupLabel)}</th>${SUMMARY_HEADER.map((h) => `<th class="num">${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>
    ${doc.rows.map((row) => `<tr>
      <td class="ident"><b>${esc(row.title)}</b><small>${esc(row.subtitle)}</small></td>
      ${summaryValues(row.summary).map((v) => `<td class="num">${esc(v)}</td>`).join("")}
    </tr>`).join("")}
    <tr class="total"><td class="ident">TOTAL (${esc(doc.totals.linhas)} linha(s))</td>
      ${summaryValues(doc.totals).map((v) => `<td class="num">${esc(v)}</td>`).join("")}</tr>
  </tbody>
</table>

<h2>Cronograma</h2>
<table>
  <thead><tr><th class="ident">${esc(doc.groupLabel)}</th>${doc.columns.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead>
  <tbody>
    ${doc.rows.map((row) => `<tr>
      <td class="ident"><b>${esc(row.title)}</b><small>${esc(row.subtitle)}</small></td>
      ${doc.columns.map((column) => `<td>${tasksInColumn(row.tasks, column).map((t) => {
        const kind = t.status === "concluida" || t.status === "concluida_com_pendencias" ? "concluida"
          : (t.endDate < new Date().toISOString().slice(0, 10) ? "atrasada" : "");
        return `<span class="task${kind ? ` task--${kind}` : ""}"><b>${esc(t.startDate.slice(8, 10))}</b> ${esc(t.orderNumber)}</span>`;
      }).join("")}</td>`).join("")}
    </tr>`).join("")}
  </tbody>
</table>
<script>window.__reportPaginationDone = true;</script>
</body></html>`;
}

// Renderiza via o container puppeteer dedicado quando configurado; senão cai no
// puppeteer local do processo. Mantido aqui (e não no report_service) porque o
// pipeline de lá injeta o CSS/paginação do laudo de serviço, que não se aplica.
async function buildPdfBuffer(doc) {
  const html = buildPdfHtml(doc);
  const serverUrl = String(process.env.PUPPETEER_SERVER_URL || "").replace(/\/+$/, "");

  if (serverUrl) {
    const res = await fetch(`${serverUrl}/render-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, imageCache: {} })
    });
    if (!res.ok) throw new Error(`puppeteer-server ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  }

  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch (_err) {
    const error = new Error("Puppeteer indisponível para gerar PDF. Use a exportação XLSX ou configure PUPPETEER_SERVER_URL.");
    error.code = "SG_REPORT_PDF_UNAVAILABLE";
    throw error;
  }
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    if (typeof page.emulateMediaType === "function") await page.emulateMediaType("print");
    const buffer = await page.pdf({ printBackground: true, preferCSSPageSize: true });
    return Buffer.from(buffer);
  } finally {
    await browser.close().catch(() => {});
  }
}

module.exports = { buildXlsxBuffer, buildCsv, buildPdfBuffer, buildPdfHtml };
