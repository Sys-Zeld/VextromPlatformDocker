const test = require("node:test");
const assert = require("node:assert/strict");

const { parseToCents, centsToDecimal, sameAmount, formatBRL } = require("../src/lib/money");
const { isValidCpf, maskCpf, maskPixKey } = require("../src/lib/cpf");
const { createCipher } = require("../src/lib/crypto");
const { detectMime, validateUpload, sanitizeFileName } = require("../src/lib/fileSignature");
const v = require("../src/validators/expenseValidators");
const { summarize } = require("../src/services/dashboardService");
const { reimbursementReadiness } = require("../src/services/profileService");

/* --------------------------------- Dinheiro -------------------------------- */

test("money: parse sem ponto flutuante, formatos BR e US", () => {
  assert.equal(parseToCents("0.1") + parseToCents("0.2"), 30n);
  assert.equal(parseToCents("1.234,56"), 123456n);
  assert.equal(parseToCents("1234,5"), 123450n);
  assert.equal(parseToCents("1234.56"), 123456n);
  assert.equal(parseToCents(19.9), 1990n);
  assert.equal(parseToCents("R$ 10,00"), 1000n);
});

test("money: rejeita negativos, 3 casas, lixo e estouro", () => {
  for (const bad of ["-1", "1.234", "abc", "1,2,3", "", "99999999999999"]) {
    assert.equal(parseToCents(bad), null, bad);
  }
});

test("money: soma e formatação exatas", () => {
  const total = ["10.10", "20.20", "0.70"].reduce((acc, x) => acc + parseToCents(x), 0n);
  assert.equal(centsToDecimal(total), "31.00");
  assert.ok(sameAmount("31", "31.00"));
  assert.equal(formatBRL("1234567.8"), "R$ 1.234.567,80");
});

/* ----------------------------------- CPF ----------------------------------- */

test("cpf: valida dígitos e rejeita sequências", () => {
  assert.ok(isValidCpf("529.982.247-25"));
  assert.ok(!isValidCpf("529.982.247-24"));
  assert.ok(!isValidCpf("111.111.111-11"));
  assert.ok(!isValidCpf("123"));
});

test("cpf/pix: máscaras não expõem o valor completo", () => {
  assert.equal(maskCpf("52998224725"), "***.982.247-**");
  assert.equal(maskPixKey("fulano@empresa.com", "EMAIL"), "fu***@empresa.com");
  assert.ok(!maskPixKey("123e4567-e89b-12d3-a456-426614174000", "ALEATORIA").includes("123e4567"));
});

/* ------------------------------- Criptografia ------------------------------ */

test("crypto: ida e volta, IV aleatório e detecção de adulteração", () => {
  const c = createCipher("segredo-de-teste");
  const a = c.encrypt("52998224725");
  const b = c.encrypt("52998224725");
  assert.notEqual(a, b);
  assert.equal(c.decrypt(a), "52998224725");
  assert.equal(c.encrypt(""), null);
  const parts = a.split(":");
  parts[3] = Buffer.from("adulterado").toString("base64");
  assert.throws(() => c.decrypt(parts.join(":")));
  assert.throws(() => createCipher("outra-chave").decrypt(a));
});

/* -------------------------------- Arquivos --------------------------------- */

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(20)]);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(30)]);

test("upload: detecta tipo real pela assinatura", () => {
  assert.equal(detectMime(PDF), "application/pdf");
  assert.equal(detectMime(PNG), "image/png");
  assert.equal(detectMime(JPG), "image/jpeg");
  assert.equal(detectMime(WEBP), "image/webp");
  assert.equal(detectMime(EXE), null);
});

test("upload: aceita formatos válidos; rejeita disfarce, extensão e tamanho", () => {
  assert.deepEqual(validateUpload(PDF, "nota.pdf", 1024), { mime: "application/pdf", ext: "pdf" });
  assert.deepEqual(validateUpload(JPG, "foto.JPEG", 1024), { mime: "image/jpeg", ext: "jpg" });
  assert.ok(validateUpload(EXE, "nota.pdf", 1024).error, "exe renomeado para .pdf");
  assert.ok(validateUpload(PNG, "foto.pdf", 1024).error, "png com extensão pdf");
  assert.ok(validateUpload(PDF, "nota.html", 1024).error, "extensão proibida");
  assert.equal(validateUpload(PDF, "nota.pdf", 10).status, 413);
  assert.ok(validateUpload(Buffer.alloc(0), "nota.pdf", 1024).error);
});

test("upload: nome original saneado (sem diretórios/controle)", () => {
  assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeFileName("C:\\temp\\nota\"fiscal.pdf"), "notafiscal.pdf");
  assert.equal(sanitizeFileName(""), "arquivo");
});

/* -------------------------------- Validadores ------------------------------ */

test("validação: lançamento exige campos e valor > 0; normaliza valor", () => {
  const ok = v.parseItem({
    expenseDate: "2026-10-01", categoryId: "1", description: "Almoço", justification: "Visita técnica", amount: "45,90"
  });
  assert.equal(ok.amount, "45.90");
  assert.equal(ok.categoryId, 1);
  for (const amount of ["0", "-5", "abc"]) {
    assert.throws(() => v.parseItem({ ...ok, amount }), (e) => e.status === 400);
  }
  assert.throws(() => v.parseItem({ ...ok, justification: "  " }), (e) => e.status === 400);
});

test("validação: período do relatório coerente", () => {
  assert.throws(() => v.parseReport({ title: "X", startDate: "2026-10-10", endDate: "2026-10-01" }));
  assert.equal(v.parseReport({ title: " Viagem ", startDate: "2026-10-01", endDate: "2026-10-03" }).title, "Viagem");
});

test("validação: total não é aceito do cliente (campo ignorado)", () => {
  const parsed = v.parseReport({ title: "X", startDate: "2026-10-01", endDate: "2026-10-02", totalAmount: "999" });
  assert.equal(parsed.totalAmount, undefined);
});

test("validação: perfil com CPF e chave Pix", () => {
  const p = v.parseProfile({ fullName: "Fulano", cpf: "529.982.247-25", pixKey: "fulano@x.com", pixKeyType: "EMAIL" });
  assert.equal(p.cpf, "52998224725");
  assert.throws(() => v.parseProfile({ fullName: "F", cpf: "123.456.789-00" }));
  assert.throws(() => v.parseProfile({ fullName: "F", pixKey: "abc" }), "chave sem tipo");
});

test("validação: pagamento exige forma válida", () => {
  assert.throws(() => v.parsePayment({ paymentDate: "2026-10-01", amount: "10", paymentMethod: "BOLETO" }));
});

/* --------------------------------- Regras ---------------------------------- */

test("reembolso: exige identificação e Pix ou conta completa", () => {
  const base = { fullName: "Fulano", cpf: "52998224725" };
  assert.equal(reimbursementReadiness(null).ready, false);
  assert.equal(reimbursementReadiness(base).ready, false);
  assert.equal(reimbursementReadiness({ ...base, pixKey: "x@y.com", pixKeyType: "EMAIL" }).ready, true);
  assert.equal(reimbursementReadiness({ ...base, bankCode: "001", agency: "1234", accountNumber: "9", accountType: "CORRENTE" }).ready, true);
  assert.equal(reimbursementReadiness({ ...base, cpf: "11111111111", pixKey: "x", pixKeyType: "EMAIL" }).ready, false);
});

test("dashboard: indicadores somados em centavos", () => {
  const s = summarize([
    { status: "RASCUNHO", count: 2, total_amount: "100.00", approved_amount: "0", paid_amount: "0" },
    { status: "ENVIADO", count: 1, total_amount: "10.10", approved_amount: "0", paid_amount: "0" },
    { status: "APROVADO", count: 1, total_amount: "20.20", approved_amount: "20.20", paid_amount: "0" },
    { status: "PAGO", count: 1, total_amount: "0.70", approved_amount: "0.70", paid_amount: "0.70" }
  ]);
  assert.equal(s.total, 5);
  assert.equal(s.requestedAmount, "31.00");
  assert.equal(s.approvedUnpaidAmount, "20.20");
  assert.equal(s.reimbursedAmount, "0.70");
  assert.equal(s.counts.EM_ANALISE, 0);
});

/* ---------------------------- Configuração de e-mail ----------------------- */

test("e-mail: SMTP próprio valida servidor, porta e remetente", () => {
  const ok = v.parseEmailSettings({
    mode: "custom",
    notificationsEnabled: true,
    smtp: { host: "sandbox.smtp.mailtrap.io", port: "2525", secure: false, user: "u", pass: "p", from: "Despesas <despesas@vextrom.com.br>" }
  });
  assert.equal(ok.smtp.port, 2525);
  assert.equal(ok.clearPassword, false);
  assert.throws(() => v.parseEmailSettings({ ...ok, smtp: { ...ok.smtp, port: 70000 } }));
  assert.throws(() => v.parseEmailSettings({ ...ok, smtp: { ...ok.smtp, host: "smtp exemplo.com" } }));
  assert.throws(() => v.parseEmailSettings({ ...ok, smtp: { ...ok.smtp, from: "sem-arroba" } }));
  assert.throws(() => v.parseEmailSettings({ ...ok, mode: "outro" }));
  assert.throws(() => v.parseEmailTest({ to: "invalido" }));
  assert.equal(v.parseEmailTest({ to: " a@b.com " }).to, "a@b.com");
});
