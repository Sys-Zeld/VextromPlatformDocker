const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { buildReimbursementXlsx } = require("../src/services/xlsxService");

const detail = (items, extra = {}) => ({
  report: {
    report_number: "RD-2025-000001",
    requester_name: "Vitor Suares",
    start_date: "2025-09-12",
    end_date: "2025-09-20",
    total_amount: "323.90",
    description: "Atendimento AMT",
    submitted_at: "2025-09-22T13:00:00Z",
    approved_at: null,
    ...extra
  },
  items
});
const item = (date, amount, extra = {}) => ({
  expense_date: date, category_name: "Alimentação", description: "Almoço", invoice_number: "NT-01", amount, ...extra
});
const profile = {
  fullName: "Vitor de Jesus Suares", area: "Serviços", bankCode: "341", bankName: "Itaú",
  agency: "5006", accountNumber: "0046541", accountDigit: "2"
};

async function read(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb.getWorksheet("Reembolso");
}

test("xlsx: cabeçalho com dados do colaborador e conta com zeros à esquerda", async () => {
  const ws = await read(await buildReimbursementXlsx(detail([item("2025-09-15", "69.90")]), { profile }));
  assert.equal(ws.getCell("C1").value, "Vitor de Jesus Suares");
  assert.equal(ws.getCell("C2").value, "Serviços");
  assert.equal(ws.getCell("C3").value, "341 - Itaú");
  assert.equal(ws.getCell("C4").value, "5006");
  assert.equal(ws.getCell("C5").value, "0046541-2");
  assert.equal(ws.getCell("D5").value, "FORMULÁRIO DE REEMBOLSO");
});

test("xlsx: despesas, nota fiscal e total em fórmula", async () => {
  const items = [item("2025-09-15", "69.90"), item("2025-09-16", "254.00", { category_name: "Estacionamento", invoice_number: "NT-02" })];
  const ws = await read(await buildReimbursementXlsx(detail(items), { profile }));
  assert.equal(ws.getCell("A8").value, 1);
  assert.equal(ws.getCell("C9").value, "Estacionamento");
  assert.equal(ws.getCell("F9").value, "NT-02");
  assert.equal(ws.getCell("G9").value, 254);
  // Mínimo de 6 linhas (as vazias completam o modelo); total logo abaixo.
  assert.deepEqual(ws.getCell("G14").value.formula, "SUM(G8:G13)");
});

test("xlsx: só datas fora do período ficam em vermelho", async () => {
  const items = [item("2025-09-11", "10.00"), item("2025-09-15", "10.00"), item("2025-09-21", "10.00")];
  const ws = await read(await buildReimbursementXlsx(detail(items), { profile }));
  const red = (addr) => Boolean(ws.getCell(addr).fill?.fgColor?.argb === "FFFF0000");
  assert.equal(red("B8"), true, "antes do início");
  assert.equal(red("B9"), false, "dentro do período");
  assert.equal(red("B10"), true, "depois do fim");
});

test("xlsx: muitas despesas estendem a tabela; aprovador vazio antes da aprovação", async () => {
  const items = Array.from({ length: 12 }, (_, i) => item("2025-09-15", "1.00", { description: `D${i}` }));
  const ws = await read(await buildReimbursementXlsx(detail(items), { profile }));
  assert.equal(ws.getCell("D19").value, "D11");
  assert.equal(ws.getCell("G20").value.formula, "SUM(G8:G19)");
  const signRow = 20 + 6; // total + observações + espaço
  assert.equal(ws.getCell(`B${signRow}`).value, "SOLICITANTE: Vitor de Jesus Suares");
  assert.equal(ws.getCell(`D${signRow}`).value, "APROVADOR:");
});

test("xlsx: perfil mascarado sai mascarado (quem chama decide a revelação)", async () => {
  const masked = { ...profile, accountNumber: "*****41", accountDigit: "*" };
  const ws = await read(await buildReimbursementXlsx(detail([item("2025-09-15", "1.00")]), { profile: masked }));
  assert.equal(ws.getCell("C5").value, "*****41-*");
});
