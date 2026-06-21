"use strict";

const XLSX = require("xlsx");

const DEFAULT_MEASURE_COLUMNS = ["ID", "Signal Name", "Signal Value", "Unit"];

function cell(value) {
  return String(value == null ? "" : value).trim();
}

function isMeasurementHeaderRow(row) {
  return cell(row[0]).toLowerCase() === "id" && /^signal name/i.test(cell(row[1]));
}

/**
 * Parse a UPS "Measures" workbook (binary BIFF .xls or .xlsx) into a structured
 * object ready to feed the editor / preview renderer.
 *
 * Expected layout (validated against real exports):
 *   - Leading key/value rows  -> header  ([{label, value}])
 *   - Row "ID | Signal Name | Signal Value | Unit" -> starts first data section
 *   - A single-cell row (only first column) -> starts a new named section
 *   - 4-column rows           -> section data rows
 *
 * @param {Buffer} buffer raw file bytes
 * @param {string} [fileName] original file name (used as fallback title)
 * @returns {{title:string, header:Array<{label:string,value:string}>, sections:Array<{title:string,columns:string[],rows:string[][]}>}}
 */
function parseUpsMeasuresWorkbook(buffer, fileName = "") {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("Arquivo de medições vazio ou inválido.");
  }

  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch (err) {
    throw new Error("Não foi possível ler o arquivo Excel: " + (err && err.message ? err.message : "formato inválido."));
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) throw new Error("Planilha não encontrada no arquivo.");

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

  const header = [];
  const sections = [];
  let current = null;
  let inData = false;
  let modelName = "";

  for (const rawRow of rows) {
    const row = Array.isArray(rawRow) ? rawRow : [];
    const c0 = cell(row[0]);
    const c1 = cell(row[1]);
    const c2 = cell(row[2]);
    const c3 = cell(row[3]);

    // Linha em branco -> ignorar
    if (!c0 && !c1 && !c2 && !c3) continue;

    // Início da primeira seção de dados (cabeçalho ID/Signal Name/...)
    if (isMeasurementHeaderRow(row)) {
      const columns = [c0, c1, c2, c3].map((v) => v || "").filter(Boolean);
      current = {
        title: "Measurements",
        columns: columns.length ? columns : DEFAULT_MEASURE_COLUMNS.slice(),
        rows: []
      };
      sections.push(current);
      inData = true;
      continue;
    }

    if (!inData) {
      // Fase de cabeçalho: pares label/valor (col2/col3 vazias)
      if (c0 && c1 && !c2 && !c3) {
        if (!modelName && /model name/i.test(c0)) modelName = c1;
        header.push({ label: c0, value: c1 });
      } else if (c0 && !c1 && !c2 && !c3) {
        // Linha de título solta antes dos dados -> guarda como label sem valor
        header.push({ label: c0, value: "" });
      }
      continue;
    }

    // Fase de dados
    // Título de nova seção: apenas a primeira célula preenchida
    if (c0 && !c1 && !c2 && !c3) {
      current = {
        title: c0,
        columns: (current && current.columns.length ? current.columns : DEFAULT_MEASURE_COLUMNS).slice(),
        rows: []
      };
      sections.push(current);
      continue;
    }

    // Linha de dados (até 4 colunas)
    if (!current) {
      current = { title: "Measurements", columns: DEFAULT_MEASURE_COLUMNS.slice(), rows: [] };
      sections.push(current);
    }
    current.rows.push([c0, c1, c2, c3]);
  }

  // Remove seções sem linhas
  const cleanSections = sections.filter((s) => s.rows.length);

  const fallbackTitle = String(fileName || "").replace(/\.[^.]+$/, "").trim();
  const title = modelName || fallbackTitle || "Medições UPS";

  return { title, header, sections: cleanSections };
}

module.exports = { parseUpsMeasuresWorkbook, DEFAULT_MEASURE_COLUMNS };
