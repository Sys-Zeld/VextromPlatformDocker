"use strict";

function stripBom(str) {
  return str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
}

function parseDischargeCsv(rawContent) {
  const errors = [];
  const text = stripBom(String(rawContent || ""))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (!lines.length) {
    return { isValid: false, errors: ["Arquivo vazio."], hourLabels: [], readings: [], totalCelulas: 0 };
  }

  const sep = lines[0].includes(";") ? ";" : ",";
  const rawHeaders = lines[0].split(sep).map((h) => h.trim());

  if (rawHeaders.length < 3) {
    errors.push("Formato inválido: esperado pelo menos 3 colunas (Célula, Flutuação e pelo menos 1º Hora).");
    return { isValid: false, errors, hourLabels: [], readings: [], totalCelulas: 0 };
  }

  const hourLabels = rawHeaders.slice(2);

  const readings = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((v) => v.trim());
    if (parts.length < 2) continue;

    const celula = parseInt(parts[0].replace(",", "."), 10);
    if (isNaN(celula) || celula <= 0) continue;

    const flutuacao = parseFloat(parts[1].replace(",", "."));
    const horas = parts.slice(2).map((v) => {
      const num = parseFloat(v.replace(",", "."));
      return isNaN(num) ? null : num;
    });

    readings.push({
      celula,
      flutuacao: isNaN(flutuacao) ? null : flutuacao,
      horas
    });
  }

  if (!readings.length) {
    errors.push("Nenhuma linha de dados encontrada.");
    return { isValid: false, errors, hourLabels, readings: [], totalCelulas: 0 };
  }

  return { isValid: true, errors, hourLabels, readings, totalCelulas: readings.length };
}

module.exports = { parseDischargeCsv };
