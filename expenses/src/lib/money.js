// Valores monetários em centavos inteiros (BigInt), sem ponto flutuante.
// O banco usa NUMERIC(14,2) e o pg devolve string ("123.45"), que é o formato
// trafegado na API.

const MAX_CENTS = 999999999999n; // 9.999.999.999,99 — cabe em NUMERIC(14,2)

// Aceita "1234.5", "1.234,56", "1234,56", 1234.56 (number). Rejeita negativos,
// mais de 2 casas e lixo. Retorna BigInt de centavos ou null.
function parseToCents(input) {
  if (input === null || input === undefined) return null;
  let text = typeof input === "number" ? (Number.isFinite(input) ? input.toFixed(2) : "") : String(input);
  text = text.trim().replace(/^R\$\s*/i, "");
  if (!text) return null;

  if (text.includes(",")) {
    // Formato brasileiro: ponto é milhar, vírgula é decimal.
    if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(text)) return null;
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return null;
  }

  const [intPart, decPart = ""] = text.split(".");
  const cents = BigInt(intPart) * 100n + BigInt((decPart + "00").slice(0, 2));
  if (cents > MAX_CENTS) return null;
  return cents;
}

// BigInt de centavos → "1234.56" (formato NUMERIC).
function centsToDecimal(cents) {
  const value = BigInt(cents);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const intPart = abs / 100n;
  const decPart = String(abs % 100n).padStart(2, "0");
  return `${sign}${intPart}.${decPart}`;
}

// "1234.5" (do banco) → BigInt de centavos.
function decimalToCents(value) {
  const cents = parseToCents(value === null || value === undefined ? "0" : String(value));
  if (cents === null) throw new Error(`Valor monetário inválido: ${value}`);
  return cents;
}

function sameAmount(a, b) {
  return decimalToCents(a) === decimalToCents(b);
}

// "1234.56" → "R$ 1.234,56" (PDF e e-mails).
function formatBRL(value) {
  const cents = decimalToCents(value);
  const [intPart, decPart] = centsToDecimal(cents).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${grouped},${decPart}`;
}

module.exports = { parseToCents, centsToDecimal, decimalToCents, sameAmount, formatBRL, MAX_CENTS };
