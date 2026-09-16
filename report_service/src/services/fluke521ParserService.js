"use strict";

// Fluke BT521 (leituras de bateria) CSV parser.
// Um único arquivo traz até duas medições distintas em blocos separados:
//   - Tabela "mΩ-Volt (Temperature)": resistência interna + tensão de flutuação por célula
//   - Tabela "DISCHARGE VOLTS": tensão por célula em cada checkpoint do teste de descarga
// Os blocos são identificados como "Table<N>,"<rótulo>"" seguido de uma linha de traços,
// a linha de cabeçalho das colunas e as linhas de dados — o índice N não é fixo (o
// instrumento numera slots de 1 a 6 e só exporta os que foram usados), então a
// identificação do bloco é feita pelo rótulo/conteúdo, nunca pelo índice N.
//
// As duas tabelas são INDEPENDENTES: o instrumento exporta só o que foi medido. Um arquivo
// pode conter as duas, apenas a de resistência/tensão ou apenas a de descarga. Daí os três
// modos de saída (`mode`): "full" | "resistance-only" | "discharge-only". A ausência de uma
// das tabelas é AVISO (`warnings`), não erro — só é erro fatal quando nenhuma das duas é
// encontrada. Assim um arquivo somente de descarga importa normalmente.
//
// Saída: `celulas` (resistência/tensão/temperatura por célula, para leituras_fluke521 +
// celulas_fluke521) e `discharge` (hourLabels + readings no MESMO formato que
// dischargeParserService produz, para reaproveitar a tabela discharge_tests — a tensão de
// flutuação de cada célula vem do VDC da tabela de resistência, casada pelo nº da célula;
// sem essa tabela `flutuacao` fica null e quem renderiza omite a coluna).
//
// Todas as funções são puras — sem I/O, sem efeitos colaterais.

const HEADER_FIELD_MAP = {
  "internal profileid": "internalProfileId",
  "location": "locationName",
  "device name": "deviceName",
  "device id": "deviceId",
  "battery series": "batterySeries",
  "battery type": "batteryType",
  "battery number": "batteryNumber",
  "battery start id": "batteryStartId",
  "capacity": "capacity",
  "time created": "timeCreated",
  "time modified": "timeModified"
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

// Tokenizer de linha CSV tolerante a aspas malformadas (o BT521 exporta pelo menos
// um cabeçalho de coluna com aspas fechando errado, ex.: "T8(...10")" em vez de
// "T8(...10)"). O estado de aspas absorve o caractere extra sem quebrar o parsing.
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

function applyHeaderField(header, rawKey, rawVal) {
  const key = HEADER_FIELD_MAP[String(rawKey || "").toLowerCase().trim().replace(/:+$/, "")];
  if (!key) return;
  if (key === "batteryNumber") header[key] = parseInt(rawVal, 10) || 0;
  else header[key] = String(rawVal || "").trim();
}

function isTableStartLine(fields) {
  const m = /^table(\d+)$/i.exec(String(fields[0] || "").trim());
  return m ? parseInt(m[1], 10) : null;
}

// Linha de traços que separa o rótulo do bloco do cabeçalho das colunas. O instrumento
// exporta esse separador COM aspas ("--------------------"), então o teste tem de rodar
// sobre o campo já destacado — comparar o texto cru deixaria as aspas na string, o regex
// falharia e a linha de traços seria consumida como se fosse o cabeçalho das colunas.
function isSeparatorLine(fields) {
  return fields.length > 0 && fields.every((f) => f === "" || /^<?-{3,}>?$/.test(f));
}

// O arquivo termina com um bloco de reimportação do Battery Manager: uma linha de aviso,
// um separador "<-------------------->" e dezenas de linhas base64. Nada ali é medição, e
// sem este corte tudo isso entra como linhas de dados da última tabela.
function isFooterLine(fields) {
  return fields.some((f) => /do not remove or modify/i.test(f));
}

// Percorre o arquivo inteiro e devolve { header, blocks }. blocks é a lista bruta de
// tabelas encontradas, cada uma com { tableIndex, label, headerRow, dataRows }.
function scanFile(lines) {
  const header = {};
  let i = 0;

  // Bloco de metadados: linhas "Chave","Valor" antes da primeira "Table<N>".
  for (; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    const fields = parseCsvLine(trimmed).map(unquote);
    if (isTableStartLine(fields) !== null) break;
    if (fields.length >= 2) applyHeaderField(header, fields[0], fields[1]);
  }

  const blocks = [];
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }
    const fields = parseCsvLine(trimmed).map(unquote);
    if (isFooterLine(fields)) break;
    const tableIndex = isTableStartLine(fields);
    if (tableIndex === null) { i++; continue; }
    const label = fields[1] || "";
    i++;
    while (i < lines.length && isSeparatorLine(parseCsvLine(lines[i].trim()).map(unquote))) i++;
    if (i >= lines.length) break;
    const headerRow = parseCsvLine(lines[i].trim()).map(unquote);
    i++;
    const dataRows = [];
    while (i < lines.length) {
      const rowTrimmed = lines[i].trim();
      if (!rowTrimmed) { i++; break; }
      const rowFields = parseCsvLine(rowTrimmed).map(unquote);
      if (isFooterLine(rowFields)) { i = lines.length; break; }
      if (isTableStartLine(rowFields) !== null) break;
      // Alguns blocos repetem o separador depois do cabeçalho — nunca é dado.
      if (isSeparatorLine(rowFields)) { i++; continue; }
      dataRows.push(rowFields);
      i++;
    }
    blocks.push({ tableIndex, label, headerRow, dataRows });
  }

  return { header, blocks };
}

// Colunas "T<n>(...)" (checkpoints) só existem na tabela de descarga — é a assinatura
// mais confiável do bloco, já que o rótulo pode vir truncado/mal codificado.
function hasCheckpointColumns(block) {
  return block.headerRow.some((h) => /^t\d+\(/i.test(h.trim()));
}

function isDischargeBlock(block) {
  return /discharge/i.test(block.label) || hasCheckpointColumns(block);
}

function isResistanceBlock(block) {
  // O rótulo real é "mΩ-Volt (Temperature)", mas o Ω se perde quando o arquivo não vem em
  // UTF-8 ("m?-Volt", "m-Volt"), então "volt" sozinho também qualifica — seguro porque os
  // blocos de descarga ("DISCHARGE VOLTS") já foram descartados antes deste teste.
  if (/resist|m[ΩΩ]|mohm|volt/i.test(block.label)) return true;
  return block.headerRow.some((h) => /resistance|mohm|m[ΩΩ]/i.test(h) || h.toLowerCase().trim() === "vdc");
}

// Separa os blocos por medição. A descarga é identificada PRIMEIRO e excluída da busca
// pela tabela de resistência: "DISCHARGE VOLTS" contém "VOLTS" e casaria com o teste de
// rótulo da resistência, roubando o bloco errado em arquivos somente de descarga.
function classifyBlocks(blocks) {
  const dischargeBlocks = [];
  const others = [];
  blocks.forEach((b) => (isDischargeBlock(b) ? dischargeBlocks : others).push(b));
  return {
    resistanceBlock: others.find(isResistanceBlock) || null,
    dischargeBlock: dischargeBlocks[0] || null
  };
}

function toFloatOrNull(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Extrai { celulaNum, resistenciaMohm, tensaoVdc, temperaturaC, hora } de cada linha
// do bloco de resistência/tensão, resolvendo colunas pelo cabeçalho real do arquivo
// (não por posição fixa).
function buildCelulas(block) {
  if (!block) return [];
  const header = block.headerRow.map((h) => h.toLowerCase().trim());
  const idIdx = header.findIndex((h) => h === "id");
  const resIdx = header.findIndex((h) => h.includes("resistance"));
  const vdcIdx = header.findIndex((h) => h === "vdc");
  const tempIdx = header.findIndex((h) => h.includes("temperature"));
  const timeIdx = header.findIndex((h) => h === "time");

  return block.dataRows.map((r) => ({
    celulaNum: parseInt(idIdx >= 0 ? r[idIdx] : "", 10) || 0,
    resistenciaMohm: toFloatOrNull(resIdx >= 0 ? r[resIdx] : null) || 0,
    tensaoVdc: toFloatOrNull(vdcIdx >= 0 ? r[vdcIdx] : null) || 0,
    temperaturaC: tempIdx >= 0 ? toFloatOrNull(r[tempIdx]) : null,
    hora: timeIdx >= 0 ? String(r[timeIdx] || "").trim() : ""
  })).filter((c) => c.celulaNum > 0);
}

// "Valor real" = não vazio e diferente de zero. O instrumento usa "0.000"/"" como
// sentinela de "checkpoint não alcançado" (o mesmo padrão do parser Alber, que trata
// tensão=0 + resistência=0 como célula inativa).
function isRealValue(v) {
  const s = String(v || "").trim();
  if (!s) return false;
  const n = parseFloat(s);
  return Number.isFinite(n) && n !== 0;
}

// Monta { hourLabels, readings } no MESMO formato que dischargeParserService.parseDischargeCsv
// produz (readings: [{ celula, flutuacao, horas: [...] }]), para gravar direto em
// discharge_tests via repo.createDischargeTest — reaproveitando 100% do gráfico e da
// customização visual já existentes na tela "Teste de Descarga".
// `vdcByCelula` é o mapa célula→tensão de flutuação vindo da tabela de resistência/tensão
// (o BT521 não repete a tensão de flutuação na tabela de descarga).
function buildDischarge(block, vdcByCelula) {
  if (!block) return null;
  const header = block.headerRow;
  const idIdx = header.findIndex((h) => h.toLowerCase().trim() === "id");

  const tCols = [];
  header.forEach((h, idx) => {
    const m = /^t(\d+)\((.+)\)$/i.exec(h.trim());
    if (m) tCols.push({ idx, num: parseInt(m[1], 10), time: m[2].trim() });
  });

  const realTCols = tCols.filter((tc) => block.dataRows.some((r) => isRealValue(r[tc.idx])));
  if (!realTCols.length) return null;

  const hourLabels = realTCols.map((tc) => {
    const timePart = tc.time.includes(" ") ? tc.time.split(" ").slice(1).join(" ") : tc.time;
    return `T${tc.num} (${timePart})`;
  });

  const readings = block.dataRows.map((r) => {
    const celula = parseInt(idIdx >= 0 ? r[idIdx] : "", 10) || 0;
    return {
      celula,
      flutuacao: vdcByCelula.has(celula) ? vdcByCelula.get(celula) : null,
      horas: realTCols.map((tc) => toFloatOrNull(r[tc.idx]))
    };
  }).filter((row) => row.celula > 0);

  return { hourLabels, readings };
}

function buildMetadataSummary(header, fileName) {
  const parts = [];
  if (header.locationName) parts.push(`Local: ${header.locationName}`);
  if (header.deviceName) parts.push(`Equipamento: ${header.deviceName}`);
  if (header.batteryType) parts.push(`Tipo de bateria: ${header.batteryType}`);
  if (header.capacity) parts.push(`Capacidade: ${header.capacity}`);
  if (header.batteryNumber) parts.push(`Nº de células: ${header.batteryNumber}`);
  if (header.timeCreated) parts.push(`Início: ${header.timeCreated}`);
  if (header.timeModified) parts.push(`Fim: ${header.timeModified}`);
  parts.push("Instrumento: Fluke BT521");
  if (fileName) parts.push(`Arquivo: ${fileName}`);
  return parts.join(" | ");
}

function parseFluke521Csv(rawContent, fileName) {
  // `errors` = impedem a importação (nenhuma medição aproveitável no arquivo).
  // `warnings` = importa, mas o operador precisa saber o que ficou de fora.
  const errors = [];
  const warnings = [];
  const lines = splitLines(rawContent);
  const { header, blocks } = scanFile(lines);

  const { resistanceBlock, dischargeBlock } = classifyBlocks(blocks);

  const celulas = buildCelulas(resistanceBlock);
  const vdcByCelula = new Map(celulas.map((c) => [c.celulaNum, c.tensaoVdc]));
  const discharge = buildDischarge(dischargeBlock, vdcByCelula);

  const hasResistance = celulas.length > 0;
  const hasDischarge = Boolean(discharge);

  // Nenhuma das duas tabelas rendeu dados → só aqui a importação é abortada.
  if (!hasResistance && !hasDischarge) {
    errors.push('Nenhuma medição encontrada no arquivo: esperada a tabela de resistência/tensão (rótulo com "mΩ"/"Volt"/"Resistance") e/ou a tabela de descarga (rótulo "DISCHARGE" ou colunas "T<n>(...)").');
  } else {
    if (!hasResistance) {
      warnings.push(dischargeBlock && resistanceBlock
        ? 'A tabela de resistência/tensão ("mΩ"/"Volt"/"Resistance") está presente mas sem linhas de dados — importado apenas o teste de descarga.'
        : 'Arquivo sem tabela de resistência/tensão ("mΩ"/"Volt"/"Resistance") — importado apenas o teste de descarga. A coluna de tensão de flutuação fica vazia, pois ela vem do VDC dessa tabela.');
    }
    if (!hasDischarge) {
      warnings.push(dischargeBlock
        ? 'A tabela de descarga não tem nenhum checkpoint com valor medido — importadas apenas as leituras de resistência/tensão.'
        : 'Arquivo sem tabela de teste de descarga — importadas apenas as leituras de resistência/tensão.');
    }
  }

  if (header.batteryNumber) {
    if (hasResistance && celulas.length !== header.batteryNumber) {
      warnings.push(`Nº de células no cabeçalho (${header.batteryNumber}) difere das linhas da tabela de resistência/tensão (${celulas.length}).`);
    }
    if (hasDischarge && discharge.readings.length !== header.batteryNumber) {
      warnings.push(`Nº de células no cabeçalho (${header.batteryNumber}) difere das linhas da tabela de descarga (${discharge.readings.length}).`);
    }
  }

  const subject = header.deviceName || header.locationName || "";
  const notes = buildMetadataSummary(header, fileName);

  return {
    isValid: hasResistance || hasDischarge,
    errors,
    warnings,
    mode: hasResistance && hasDischarge ? "full"
      : hasResistance ? "resistance-only"
      : hasDischarge ? "discharge-only"
      : "none",
    hasResistance,
    hasDischarge,
    header: { ...header, nomeArquivo: String(fileName || "").trim() },
    subject,
    notes,
    celulas,
    discharge
  };
}

module.exports = { parseFluke521Csv };
