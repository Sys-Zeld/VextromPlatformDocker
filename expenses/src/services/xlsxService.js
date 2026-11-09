const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

// Formulário de Reembolso em Excel, no layout do modelo da Vextrom:
// cabeçalho com dados do colaborador e logo, tabela de despesas, total,
// observações e campos de assinatura do solicitante e do aprovador.
//
// Colunas: A=#  B=Data  C=Despesa (categoria)  D:E=Descrição (mescladas; a
// divisão alinha o bloco do aprovador)  F=Nº nota fiscal  G=Valor

const LOGO_PATH = path.join(__dirname, "..", "..", "assets", "logo-vextrom.png");
const MIN_ITEM_ROWS = 6; // o modelo tem linhas em branco para completar à mão
const FONT = "Arial";

const COLORS = {
  green: "FF73A533",
  label: "FF595959",
  black: "FF000000",
  white: "FFFFFFFF",
  valueFill: "FFF2F2F2",
  totalFill: "FF595959",
  alertFill: "FFFF0000",
  line: "FFBFBFBF",
  dotted: "FF7F7F7F"
};

const font = (opts = {}) => ({ name: FONT, size: 9, color: { argb: COLORS.black }, ...opts });
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const thin = (argb = COLORS.line) => ({ style: "thin", color: { argb } });
const medium = { style: "medium", color: { argb: COLORS.line } };

// "2025-09-11" → Date em UTC (o Excel grava sem fuso; evita virar o dia anterior).
function toExcelDate(value) {
  if (!value) return null;
  const iso = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const [y, m, d] = iso.split("-").map(Number);
  return y && m && d ? new Date(Date.UTC(y, m - 1, d)) : null;
}

// Datas de evento (TIMESTAMPTZ) no dia de Brasília.
function toLocalDate(value) {
  if (!value) return null;
  return toExcelDate(new Date(value).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }));
}

function accountLabel(bank) {
  if (!bank || !bank.accountNumber) return "";
  return bank.accountDigit ? `${bank.accountNumber}-${bank.accountDigit}` : bank.accountNumber;
}

function bankLabel(bank) {
  if (!bank) return "";
  if (bank.bankName && bank.bankCode) return `${bank.bankCode} - ${bank.bankName}`;
  return bank.bankName || bank.bankCode || "";
}

/**
 * @param detail        { report, items } (como em getReportDetail)
 * @param profile       perfil do solicitante — completo ou mascarado, decidido por quem chama
 * @param approverName  nome de quem aprovou (o relatório guarda só o login)
 */
async function buildReimbursementXlsx(detail, { profile = null, approverName = "" } = {}) {
  const { report, items } = detail;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Vextrom Platform";
  wb.created = new Date();
  const ws = wb.addWorksheet("Reembolso", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 }
    },
    headerFooter: { oddFooter: `&L${report.report_number}&RPágina &P de &N` }
  });
  ws.columns = [
    { width: 4 }, { width: 14 }, { width: 30 }, { width: 12 }, { width: 34 }, { width: 16 }, { width: 14 }
  ];

  const name = (profile && profile.fullName) || report.requester_name || report.requester_username;

  /* ------------------------------ Cabeçalho ------------------------------ */
  const header = [
    ["NOME:", name],
    ["ÁREA:", (profile && profile.area) || ""],
    ["BANCO:", bankLabel(profile)],
    ["AGÊNCIA:", (profile && profile.agency) || ""],
    ["CONTA:", accountLabel(profile)]
  ];
  const dotted = { style: "dotted", color: { argb: COLORS.dotted } };
  header.forEach(([label, value], i) => {
    const row = ws.getRow(i + 1);
    row.height = 18;
    const l = row.getCell(2);
    const v = row.getCell(3);
    l.value = label;
    v.value = value;
    l.font = font({ bold: true, color: { argb: COLORS.label } });
    v.font = font();
    // A conta é texto: preserva zeros à esquerda ("0046541-2").
    v.numFmt = "@";
    for (const c of [l, v]) {
      c.alignment = { vertical: "middle", indent: 1 };
      c.border = { top: dotted, bottom: dotted, left: dotted, right: dotted };
    }
  });

  // Sem o arquivo do logo, a planilha sai sem a imagem em vez de falhar.
  if (fs.existsSync(LOGO_PATH)) {
    ws.addImage(wb.addImage({ filename: LOGO_PATH, extension: "png" }), {
      tl: { col: 4.15, row: 0.2 },
      ext: { width: 250, height: 70 }
    });
  }
  // Slogan logo abaixo do logo, alinhado à direita dele (como no modelo).
  ws.mergeCells("E4:F4");
  const tagline = ws.getCell("E4");
  tagline.value = "atmosferas sob controle";
  tagline.font = font({ italic: true, color: { argb: COLORS.green } });
  tagline.alignment = { horizontal: "right", vertical: "top", indent: 1 };

  ws.mergeCells("D5:G5");
  const title = ws.getCell("D5");
  title.value = "FORMULÁRIO DE REEMBOLSO";
  title.font = font({ bold: true, size: 16, color: { argb: COLORS.green } });
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(5).height = 26;
  ws.getRow(6).height = 8;

  /* ------------------------------ Despesas ------------------------------- */
  const headRow = 7;
  const head = ws.getRow(headRow);
  head.height = 20;
  ws.mergeCells(`D${headRow}:E${headRow}`);
  [[1, "#"], [2, "DATA"], [3, "DESPESA"], [4, "DESCRIÇÃO DA DESPESA"], [6, "Nº NOTA FISCAL"], [7, "VALOR (R$)"]].forEach(([col, label]) => {
    const c = head.getCell(col);
    c.value = label;
    c.font = font({ bold: col === 1, color: { argb: col === 1 ? COLORS.label : COLORS.green } });
    c.alignment = { vertical: "middle", horizontal: col === 1 ? "center" : col === 7 ? "right" : "left" };
  });
  for (let col = 1; col <= 7; col += 1) head.getCell(col).border = { top: medium, bottom: thin() };

  const first = headRow + 1;
  const start = toExcelDate(report.start_date);
  const end = toExcelDate(report.end_date);
  const rows = Math.max(items.length, MIN_ITEM_ROWS);
  for (let i = 0; i < rows; i += 1) {
    const item = items[i];
    const r = first + i;
    const row = ws.getRow(r);
    row.height = 24;
    ws.mergeCells(`D${r}:E${r}`);
    const date = item ? toExcelDate(item.expense_date) : null;
    // Destaque: despesa com data fora do período do relatório.
    const outOfPeriod = Boolean(date && ((start && date < start) || (end && date > end)));
    const cells = {
      1: item ? i + 1 : null,
      2: date,
      3: item ? item.category_name : null,
      4: item ? item.description : null,
      6: item ? item.invoice_number || "" : null,
      7: item ? Number(item.amount) : null
    };
    for (let col = 1; col <= 7; col += 1) {
      const c = row.getCell(col);
      if (col in cells) c.value = cells[col];
      c.font = font({ bold: col > 1, color: { argb: col === 1 ? COLORS.label : COLORS.black } });
      c.alignment = { vertical: "middle", horizontal: col === 1 ? "center" : col === 7 ? "right" : "left", indent: col > 1 && col < 7 ? 1 : 0 };
      if (col > 1) c.border = { bottom: thin(), left: col === 5 ? undefined : thin(), right: col === 4 ? undefined : thin() };
    }
    row.getCell(2).numFmt = "dd/mm/yyyy";
    row.getCell(7).numFmt = "#,##0.00";
    row.getCell(7).fill = fill(COLORS.valueFill);
    if (outOfPeriod) {
      row.getCell(2).fill = fill(COLORS.alertFill);
      row.getCell(2).font = font({ bold: true, color: { argb: COLORS.white } });
      row.getCell(2).note = "Data fora do período do relatório";
    }
  }
  const last = first + rows - 1;

  const totalRow = ws.getRow(last + 1);
  totalRow.height = 22;
  for (let col = 2; col <= 7; col += 1) totalRow.getCell(col).border = { top: medium };
  const total = totalRow.getCell(7);
  total.value = { formula: `SUM(G${first}:G${last})`, result: Number(report.total_amount) };
  total.numFmt = "#,##0.00";
  total.font = font({ bold: true, size: 10, color: { argb: COLORS.white } });
  total.fill = fill(COLORS.totalFill);
  total.alignment = { horizontal: "right", vertical: "middle" };

  /* ----------------------------- Observações ----------------------------- */
  const obsLabel = last + 3;
  ws.getCell(`B${obsLabel}`).value = "OBSERVAÇÕES:";
  ws.getCell(`B${obsLabel}`).font = font({ bold: true, size: 10 });
  ws.mergeCells(`B${obsLabel + 1}:G${obsLabel + 2}`);
  const obs = ws.getCell(`B${obsLabel + 1}`);
  obs.value = report.description || "";
  obs.font = font();
  obs.alignment = { vertical: "top", wrapText: true, indent: 1 };
  obs.border = { top: thin(), bottom: thin() };
  ws.getRow(obsLabel + 1).height = 24;
  ws.getRow(obsLabel + 2).height = 24;

  /* ----------------------------- Assinaturas ----------------------------- */
  const sign = obsLabel + 4;
  const approved = Boolean(report.approved_at);
  const signBlock = (labelCol, valueCol, heading, signer, date) => {
    const t = ws.getCell(`${labelCol}${sign}`);
    t.value = signer ? `${heading}: ${signer}` : `${heading}:`;
    t.font = font({ bold: true, size: 10, color: { argb: COLORS.green } });
    [["Ass:", signer || null], ["Data:", date]].forEach(([label, value], i) => {
      const r = sign + 1 + i;
      ws.getRow(r).height = 20;
      ws.getCell(`${labelCol}${r}`).value = label;
      ws.getCell(`${labelCol}${r}`).font = font();
      const v = ws.getCell(`${valueCol}${r}`);
      v.value = value || null;
      v.font = font();
      v.numFmt = "dd/mm/yyyy";
      v.alignment = { horizontal: "left" };
    });
  };
  signBlock("B", "C", "SOLICITANTE", name, toLocalDate(report.submitted_at));
  signBlock("D", "E", "APROVADOR", approved ? approverName || report.approved_by_name : "", approved ? toLocalDate(report.approved_at) : null);

  ws.pageSetup.printArea = `A1:G${sign + 2}`;
  // Muitas despesas: o cabeçalho da tabela se repete em cada página impressa.
  ws.pageSetup.printTitlesRow = `${headRow}:${headRow}`;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildReimbursementXlsx, toExcelDate };
