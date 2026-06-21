"use strict";

const XLSX = require("xlsx");

const DEFAULT_EVENTLOG_COLUMNS = ["Source", "Event Name", "Status", "Start Date", "Start Time", "ID", "Type"];

function cell(value) {
  return String(value == null ? "" : value).trim();
}

function nonEmptyCount(row) {
  return row.reduce((acc, v) => acc + (cell(v) ? 1 : 0), 0);
}

/**
 * Parse a UPS "Event Log" workbook (binary BIFF .xls or .xlsx) into a structured
 * object ready to feed the editor / preview renderer.
 *
 * Expected layout (validated against real exports):
 *   - Leading key/value rows  -> header  ([{label, value}])
 *   - First row with 3+ filled columns -> table header (column names)
 *   - Subsequent multi-column rows -> data rows
 *   - A single-cell row (only first column) -> starts a new named section
 *
 * @param {Buffer} buffer raw file bytes
 * @param {string} [fileName] original file name (used as fallback title)
 * @returns {{title:string, header:Array<{label:string,value:string}>, sections:Array<{title:string,columns:string[],rows:string[][]}>}}
 */
function parseEventLogWorkbook(buffer, fileName = "") {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error("Arquivo de log de eventos vazio ou inválido.");
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
    const filled = nonEmptyCount(row);
    const c0 = cell(row[0]);
    const c1 = cell(row[1]);

    // Linha em branco -> ignorar
    if (filled === 0) continue;

    if (!inData) {
      // Fase de cabeçalho: pares label/valor (apenas 1 ou 2 colunas preenchidas)
      if (filled <= 2 && c0) {
        if (c1) {
          if (!modelName && /model name/i.test(c0)) modelName = c1;
          header.push({ label: c0, value: c1 });
        } else {
          header.push({ label: c0, value: "" });
        }
        continue;
      }
      // Primeira linha com 3+ colunas -> cabeçalho da tabela de eventos
      const columns = row.map((v) => cell(v));
      // remove colunas vazias à direita
      while (columns.length && !columns[columns.length - 1]) columns.pop();
      current = {
        title: "Event Log",
        columns: columns.length ? columns : DEFAULT_EVENTLOG_COLUMNS.slice(),
        rows: []
      };
      sections.push(current);
      inData = true;
      continue;
    }

    // Fase de dados
    // Título de nova seção: apenas a primeira célula preenchida
    if (filled === 1 && c0) {
      current = {
        title: c0,
        columns: (current && current.columns.length ? current.columns : DEFAULT_EVENTLOG_COLUMNS).slice(),
        rows: []
      };
      sections.push(current);
      continue;
    }

    // Linha de dados — mapeia ao número de colunas da seção
    if (!current) {
      current = { title: "Event Log", columns: DEFAULT_EVENTLOG_COLUMNS.slice(), rows: [] };
      sections.push(current);
    }
    const cells = [];
    for (let i = 0; i < current.columns.length; i += 1) cells.push(cell(row[i]));
    current.rows.push(cells);
  }

  const cleanSections = sections.filter((s) => s.rows.length);

  const fallbackTitle = String(fileName || "").replace(/\.[^.]+$/, "").trim();
  const title = modelName || fallbackTitle || "Event Log UPS";

  return { title, header, sections: cleanSections };
}

module.exports = { parseEventLogWorkbook, DEFAULT_EVENTLOG_COLUMNS };
