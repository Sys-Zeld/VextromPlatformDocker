const PDFDocument = require("pdfkit");
const archiver = require("archiver");
const { PassThrough } = require("stream");
const { STATUS_LABELS } = require("../constants");
const { formatBRL } = require("../lib/money");

// Exportação do relatório em PDF (pdfkit, sem depender do container Puppeteer)
// e pacote ZIP com PDF + comprovantes. Nunca inclui dados bancários completos.

const MARGIN = 42;
const COLORS = { brand: "#176b49", text: "#16211b", muted: "#5a6e64", line: "#dfe7e3", head: "#eef4f1" };

const ACTION_LABELS = {
  SUBMIT: "Envio",
  RESUBMIT: "Reenvio",
  START_REVIEW: "Início da análise",
  APPROVE: "Aprovação",
  REJECT: "Rejeição",
  RETURN: "Devolução",
  PAY: "Pagamento"
};

const fmtDate = (value) => {
  if (!value) return "-";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};
const fmtDateTime = (value) => (value
  ? new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
  : "-");

function buildReportPdf(detail, { companyName = "Vextrom" } = {}) {
  const { report, items, attachments, history, payments, requester } = detail;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN, info: { Title: `Relatório de Despesas ${report.report_number}` } });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const width = doc.page.width - MARGIN * 2;
    const ensureSpace = (h) => {
      if (doc.y + h > doc.page.height - MARGIN - 20) doc.addPage();
    };
    const section = (title) => {
      ensureSpace(40);
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.brand).text(title.toUpperCase(), MARGIN, doc.y);
      doc.moveTo(MARGIN, doc.y + 2).lineTo(MARGIN + width, doc.y + 2).strokeColor(COLORS.line).stroke();
      doc.moveDown(0.5);
      doc.fillColor(COLORS.text);
    };
    const field = (label, value) => {
      ensureSpace(16);
      const y = doc.y;
      doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted).text(label, MARGIN, y, { width: 140 });
      doc.font("Helvetica").fontSize(9.5).fillColor(COLORS.text).text(String(value || "-"), MARGIN + 145, y, { width: width - 145 });
      doc.moveDown(0.25);
    };
    const table = (headers, widths, rows, aligns = []) => {
      const drawRow = (cells, header) => {
        doc.font(header ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
        const h = Math.max(...cells.map((c, i) => doc.heightOfString(String(c), { width: widths[i] - 8 }))) + 8;
        ensureSpace(h);
        const y = doc.y;
        if (header) doc.rect(MARGIN, y, width, h).fill(COLORS.head);
        let x = MARGIN;
        cells.forEach((c, i) => {
          doc.fillColor(COLORS.text).text(String(c), x + 4, y + 4, { width: widths[i] - 8, align: aligns[i] || "left" });
          x += widths[i];
        });
        doc.moveTo(MARGIN, y + h).lineTo(MARGIN + width, y + h).strokeColor(COLORS.line).stroke();
        doc.y = y + h;
      };
      drawRow(headers, true);
      if (!rows.length) drawRow(["Nenhum registro."].concat(headers.slice(1).map(() => "")), false);
      rows.forEach((r) => drawRow(r, false));
      doc.x = MARGIN;
    };

    // Cabeçalho
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.muted).text(companyName, MARGIN, MARGIN);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(COLORS.brand).text("Relatório de Despesas");
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.text)
      .text(`Nº ${report.report_number}   ·   Emitido em ${fmtDateTime(new Date())}`);

    section("Identificação");
    field("Solicitante", report.requester_name || report.requester_username);
    field("CPF", requester && requester.profile ? requester.profile.cpf : "-");
    field("Título", report.title);
    field("Período", `${fmtDate(report.start_date)} a ${fmtDate(report.end_date)}`);
    field("Projeto", report.project_name);
    field("Centro de custo", report.cost_center);
    field("Descrição", report.description);

    section("Demonstrativo de despesas");
    const countByItem = new Map();
    for (const a of attachments) countByItem.set(String(a.item_id), (countByItem.get(String(a.item_id)) || 0) + 1);
    table(
      ["Data", "Categoria", "Descrição", "Comprov.", "Valor"],
      [62, 90, width - 62 - 90 - 50 - 85, 50, 85],
      items.map((i) => [fmtDate(i.expense_date), i.category_name, i.description, countByItem.get(String(i.id)) || 0, formatBRL(i.amount)]),
      ["left", "left", "left", "center", "right"]
    );

    section("Resumo");
    field("Quantidade de despesas", items.length);
    field("Valor total solicitado", formatBRL(report.total_amount));
    field("Situação", STATUS_LABELS[report.status] || report.status);
    field("Valor aprovado", report.approved_amount === null ? "-" : formatBRL(report.approved_amount));
    field("Situação do pagamento", payments.length ? `Pago (${formatBRL(report.paid_amount)})` : "Não pago");

    section("Aprovação");
    field("Administrador responsável", report.approved_by_name);
    field("Data da aprovação", fmtDateTime(report.approved_at));
    field("Observações administrativas", report.last_decision_reason);

    if (payments.length) {
      section("Pagamento");
      for (const p of payments) {
        field("Data", fmtDate(p.payment_date));
        field("Valor", formatBRL(p.amount));
        field("Forma", p.payment_method);
        field("Referência", p.transaction_reference);
        field("Registrado por", p.recorded_by_name);
      }
    }

    section("Histórico de aprovação");
    table(
      // "»" em vez de "→": a Helvetica padrão (WinAnsi) não tem o glifo da seta.
      ["Data", "Ação", "De » Para", "Responsável", "Justificativa"],
      [92, 80, 110, 90, width - 92 - 80 - 110 - 90],
      history.map((h) => [
        fmtDateTime(h.created_at),
        ACTION_LABELS[h.action] || h.action,
        `${STATUS_LABELS[h.previous_status] || h.previous_status || "-"} » ${STATUS_LABELS[h.new_status] || h.new_status}`,
        h.performed_by_name,
        h.reason || ""
      ])
    );

    section("Comprovantes");
    const itemIndex = new Map(items.map((i, idx) => [String(i.id), idx + 1]));
    table(
      ["Despesa", "Arquivo", "Tipo", "SHA-256"],
      [55, 170, 70, width - 55 - 170 - 70],
      attachments.map((a) => [`#${itemIndex.get(String(a.item_id)) || "-"}`, a.original_name, a.mime_type, a.file_hash])
    );
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.muted)
      .text("Os comprovantes estão disponíveis no sistema para usuários autorizados e na exportação consolidada (ZIP).", MARGIN);

    doc.end();
  });
}

// ZIP com o PDF + comprovantes (+ comprovante de pagamento, se houver).
async function buildReportZip(detail, { storage, companyName, paymentProofs = [] }) {
  const pdf = await buildReportPdf(detail, { companyName });
  const archive = archiver("zip", { zlib: { level: 6 } });
  const out = new PassThrough();
  const chunks = [];
  out.on("data", (c) => chunks.push(c));
  const finished = new Promise((resolve, reject) => {
    out.on("end", resolve);
    archive.on("error", reject);
  });
  archive.pipe(out);

  archive.append(pdf, { name: `${detail.report.report_number}.pdf` });
  const itemIndex = new Map(detail.items.map((i, idx) => [String(i.id), idx + 1]));
  for (const a of detail.attachments) {
    const buffer = await storage.getObjectBuffer(a.storage_path);
    const n = String(itemIndex.get(String(a.item_id)) || 0).padStart(2, "0");
    archive.append(buffer, { name: `comprovantes/despesa-${n}-${a.id}-${a.original_name}` });
  }
  for (const p of paymentProofs) {
    const buffer = await storage.getObjectBuffer(p.proof_path);
    archive.append(buffer, { name: `pagamento/${p.id}-${p.proof_name || "comprovante"}` });
  }
  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}

module.exports = { buildReportPdf, buildReportZip };
