"use strict";

// Alber/BCT battery analyzer CSV parser.
// All functions are pure — no I/O, no side effects.

const HEADER_KEYS = {
  "location name": "locationName",
  "battery name": "batteryName",
  "model number": "modelNumber",
  "install date:": "installDate",
  "install date": "installDate",
  "total strings:": "totalStrings",
  "total strings": "totalStrings"
};

function stripNulls(raw) {
  return String(raw || "").replace(/\x00/g, "");
}

function splitLines(content) {
  return stripNulls(content).split(/\r?\n/);
}

function unquote(value) {
  const s = String(value || "").trim();
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).trim();
  return s;
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

function parseHeader(lines) {
  const header = {
    locationName: "",
    batteryName: "",
    modelNumber: "",
    installDate: "",
    totalStrings: 0
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Stop at first measurement line
    if (trimmed.startsWith('"S"') || trimmed.startsWith("S,")) break;
    const fields = parseCsvLine(trimmed);
    if (fields.length < 2) continue;
    const key = unquote(fields[0]).toLowerCase().replace(/:+$/, "").trim();
    const val = unquote(fields[1]);
    const mapped = HEADER_KEYS[key] || HEADER_KEYS[key + ":"];
    if (!mapped) continue;
    if (mapped === "totalStrings") {
      header.totalStrings = parseInt(val, 10) || 0;
    } else {
      header[mapped] = val;
    }
  }
  return header;
}

function parseMeasurementLine(fields) {
  // Format: "S",01,"C",001,"V",13.535,"iR",05711,...
  // We accept flexible positioning: find S, C, V, iR by label tokens
  const tokens = fields.map(unquote);
  let stringNum = null;
  let celulaNum = null;
  let voltagem = null;
  let resistencia = null;

  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i].toUpperCase();
    const next = tokens[i + 1];
    if (t === "S" && stringNum === null) { stringNum = parseInt(next, 10); i++; continue; }
    if (t === "C" && celulaNum === null) { celulaNum = parseInt(next, 10); i++; continue; }
    if (t === "V" && voltagem === null) { voltagem = parseFloat(next); i++; continue; }
    if (t === "IR" && resistencia === null) { resistencia = parseInt(next, 10); i++; continue; }
  }

  if (stringNum === null || celulaNum === null || voltagem === null || resistencia === null) return null;

  const ativa = !(voltagem === 0 && resistencia === 0);
  return { stringNum, celulaNum, voltagem, resistencia, ativa };
}

function calcStatistics(celulas) {
  const stringGroups = {};
  for (const c of celulas) {
    if (!c.ativa) continue;
    if (!stringGroups[c.stringNum]) stringGroups[c.stringNum] = [];
    stringGroups[c.stringNum].push(c);
  }

  function stats(cells) {
    if (!cells.length) return { vMin: null, vMed: null, vMax: null, irMin: null, irMed: null, irMax: null, ativas: 0 };
    const volts = cells.map((c) => c.voltagem);
    const irs = cells.map((c) => c.resistencia);
    const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
    return {
      vMin: Math.min(...volts),
      vMed: avg(volts),
      vMax: Math.max(...volts),
      irMin: Math.min(...irs),
      irMed: avg(irs),
      irMax: Math.max(...irs),
      ativas: cells.length
    };
  }

  const byString = {};
  for (const [sNum, cells] of Object.entries(stringGroups)) {
    byString[sNum] = stats(cells);
  }

  const allAtivas = celulas.filter((c) => c.ativa);
  return { byString, overall: stats(allAtivas) };
}

function parseAlberCsv(rawContent, fileName) {
  const errors = [];
  const lines = splitLines(rawContent);

  const header = parseHeader(lines);

  const celulas = [];
  let hasMeasurementLines = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith('"S"') && !trimmed.startsWith("S,")) continue;
    hasMeasurementLines = true;
    const fields = parseCsvLine(trimmed);
    const cell = parseMeasurementLine(fields);
    if (!cell) { errors.push(`Linha ignorada (parse incompleto): ${trimmed.slice(0, 60)}`); continue; }
    celulas.push(cell);
  }

  const isValid = hasMeasurementLines && (header.batteryName || header.locationName);
  if (!hasMeasurementLines) errors.push("Nenhuma linha de medição encontrada (esperado prefixo \"S\").");
  if (!header.batteryName && !header.locationName) errors.push("Cabeçalho sem Location Name ou Battery Name.");

  // Auto-detect totalStrings from data if not in header
  if (!header.totalStrings && celulas.length) {
    header.totalStrings = Math.max(...celulas.map((c) => c.stringNum));
  }

  const statistics = calcStatistics(celulas);
  const totalAtivas = celulas.filter((c) => c.ativa).length;
  const totalCelulas = celulas.length;

  return {
    isValid,
    errors,
    header: { ...header, nomeArquivo: String(fileName || "").trim() },
    celulas,
    statistics,
    totalAtivas,
    totalCelulas
  };
}

module.exports = { parseAlberCsv, calcStatistics };
