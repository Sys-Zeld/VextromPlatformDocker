const { renderMeasurementsInlineTable, renderUpsMeasuresTable, renderEventLogTable, generateDefaultCss, renderAlberLeituraTable, generateDefaultAlberCss, renderFluke521LeituraTable, generateDefaultFluke521Css, renderDischargeTestTable, generateDefaultDischargeCss, generateDischargeSvgChart, generateDefaultDischargeChartCss, renderTimesheetInlineTable, generateDefaultTimesheetCss, renderTechTeamInlineTable, generateDefaultTechteamCss, renderEquipmentsInlineTable, generateDefaultEquipmentCss, renderComponentsInlineTable, generateDefaultComponentsCss } = require("./reportPreviewService");
const repo = require("../repositories/serviceReportRepository");

const MEASUREMENT_DEFAULT_STYLE_SETTING_KEY = "report.preview.measurements.style.default";
const ALBER_DEFAULT_STYLE_SETTING_KEY = "report.preview.alber.style.default";
const FLUKE521_DEFAULT_STYLE_SETTING_KEY = "report.preview.fluke521.style.default";

function buildStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) {
    cfg.customCss = src.customCss;
  }
  if (Array.isArray(src.extraColumns) && src.extraColumns.length > 0) {
    cfg.extraColumns = src.extraColumns.filter((ec) => ec && typeof ec === "object");
  }
  return cfg;
}

function scopeMeasurementStyleConfig(styleConfig, tableId) {
  const cfg = buildStyleConfig(styleConfig);
  if (!cfg.customCss && !cfg.extraColumns) return null;
  if (cfg.customCss) {
    cfg.customCss = cfg.customCss.replace(
      /\[data-table-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
      `[data-table-id="${Number(tableId)}"]`
    );
  }
  return cfg;
}

async function getDefaultMeasurementStyleConfig() {
  const raw = await repo.getAppSetting(MEASUREMENT_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildStyleConfig(parsed);
    return (cfg.customCss || cfg.extraColumns) ? cfg : null;
  } catch (_err) {
    return null;
  }
}

async function saveDefaultMeasurementStyleConfig(styleConfig) {
  const cfg = buildStyleConfig(styleConfig);
  if (!cfg.customCss && !cfg.extraColumns) return null;
  await repo.upsertAppSetting(MEASUREMENT_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function applyDefaultMeasurementStyle(measurementTables, defaultStyleConfig) {
  if (!defaultStyleConfig || (!defaultStyleConfig.customCss && !defaultStyleConfig.extraColumns) || !Array.isArray(measurementTables)) {
    return Array.isArray(measurementTables) ? measurementTables : [];
  }
  return measurementTables.map((item) => {
    if (!item || (item.style_config && typeof item.style_config === "object")) return item;
    const scopedStyleConfig = scopeMeasurementStyleConfig(defaultStyleConfig, item.id);
    return scopedStyleConfig ? { ...item, style_config: scopedStyleConfig, _uses_default_measurement_style: true } : item;
  });
}

function buildPreviewHtml(measurementTable, styleConfig) {
  const fakeList = [measurementTable];
  return renderMeasurementsInlineTable(fakeList, measurementTable.id, styleConfig || null);
}

async function applyStyleViaAi(currentCss, tableId, columnNames, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-table-id="${tableId}"]`;
  const colClassLines = columnNames.map((name, i) => `  ${scope} .meas-col-${i} → coluna "${name}"`).join("\n");

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS com escopo "${scope}":
- .meas-title → célula do título (th com colspan)
- .meas-th → células do cabeçalho de colunas
- .meas-td → células de dados (linhas pares)
- .meas-td-alt → células de dados (linhas ímpares, cor alternada)
- .meas-notes → bloco de observações abaixo da tabela
- Classes por coluna (para estilo individual de coluna específica):
${colClassLines || "  (nenhuma coluna definida)"}

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
5. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;

  const result = await reviseTextWithAi({
    text: prompt,
    systemInstruction,
    preserveFormatting: true
  });

  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw
    .replace(/^```css?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function buildAlberPreviewHtml(leitura, styleConfig) {
  const fakeList = [leitura];
  return renderAlberLeituraTable(fakeList, leitura.id, styleConfig || null);
}

function buildAlberStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) {
    cfg.customCss = src.customCss;
  }
  return cfg;
}

function scopeAlberStyleConfig(styleConfig, leituraId) {
  const cfg = buildAlberStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  const scopedCss = cfg.customCss.replace(
    /\[data-alber-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
    `[data-alber-id="${Number(leituraId)}"]`
  );
  return { ...cfg, customCss: scopedCss };
}

async function getDefaultAlberStyleConfig() {
  const raw = await repo.getAppSetting(ALBER_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildAlberStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) {
    return null;
  }
}

async function saveDefaultAlberStyleConfig(styleConfig) {
  const cfg = buildAlberStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(ALBER_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function applyDefaultAlberStyle(alberLeituras, defaultStyleConfig) {
  if (!defaultStyleConfig || !defaultStyleConfig.customCss || !Array.isArray(alberLeituras)) {
    return Array.isArray(alberLeituras) ? alberLeituras : [];
  }
  return alberLeituras.map((item) => {
    if (!item || (item.style_config && typeof item.style_config === "object")) return item;
    const scopedStyleConfig = scopeAlberStyleConfig(defaultStyleConfig, item.id);
    return scopedStyleConfig ? { ...item, style_config: scopedStyleConfig, _uses_default_alber_style: true } : item;
  });
}

async function applyAlberStyleViaAi(currentCss, leituraId, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-alber-id="${leituraId}"]`;

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS com escopo "${scope}":
- .alber-info-cell → célula da barra de informações do cabeçalho (Local, Banco, Modelo, etc.)
- .alber-info-label → rótulo da informação no cabeçalho
- .alber-info-value → valor da informação no cabeçalho
- .alber-stat-cell → célula dos cards de estatísticas (Tensão média, Resist. média, etc.)
- .alber-stat-label → rótulo do card de estatística
- .alber-stat-value → valor numérico do card de estatística
- .alber-stat-unit → unidade do card de estatística
- .alber-title-th → th do título do string (ex: "Banco 1")
- .alber-th → th das colunas de dados (Célula, Tensão, Resist. Interna)
- .alber-td → célula de dados (linhas pares)
- .alber-td-alt → célula de dados (linhas ímpares, cor alternada)
- .alber-overall-th → th da tabela de estatísticas gerais
- .alber-overall-td → célula da tabela de estatísticas gerais

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
5. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;

  const result = await reviseTextWithAi({
    text: prompt,
    systemInstruction,
    preserveFormatting: true
  });

  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw
    .replace(/^```css?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function buildFluke521PreviewHtml(leitura, styleConfig) {
  const fakeList = [leitura];
  return renderFluke521LeituraTable(fakeList, leitura.id, styleConfig || null);
}

function buildFluke521StyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) {
    cfg.customCss = src.customCss;
  }
  return cfg;
}

function scopeFluke521StyleConfig(styleConfig, leituraId) {
  const cfg = buildFluke521StyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  const scopedCss = cfg.customCss.replace(
    /\[data-fluke521-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
    `[data-fluke521-id="${Number(leituraId)}"]`
  );
  return { ...cfg, customCss: scopedCss };
}

async function getDefaultFluke521StyleConfig() {
  const raw = await repo.getAppSetting(FLUKE521_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildFluke521StyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) {
    return null;
  }
}

async function saveDefaultFluke521StyleConfig(styleConfig) {
  const cfg = buildFluke521StyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(FLUKE521_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function applyDefaultFluke521Style(leituras, defaultStyleConfig) {
  if (!defaultStyleConfig || !defaultStyleConfig.customCss || !Array.isArray(leituras)) {
    return Array.isArray(leituras) ? leituras : [];
  }
  return leituras.map((item) => {
    if (!item || (item.style_config && typeof item.style_config === "object")) return item;
    const scopedStyleConfig = scopeFluke521StyleConfig(defaultStyleConfig, item.id);
    return scopedStyleConfig ? { ...item, style_config: scopedStyleConfig, _uses_default_fluke521_style: true } : item;
  });
}

async function applyFluke521StyleViaAi(currentCss, leituraId, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-fluke521-id="${leituraId}"]`;

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS com escopo "${scope}":
- .fluke521-info-cell → célula da barra de informações do cabeçalho (Local, Equipamento, Tipo de bateria, Capacidade)
- .fluke521-info-label → rótulo da informação no cabeçalho
- .fluke521-info-value → valor da informação no cabeçalho
- .fluke521-stat-cell → célula dos cards de estatísticas (Resistência média, Tensão média, etc.)
- .fluke521-stat-label → rótulo do card de estatística
- .fluke521-stat-value → valor numérico do card de estatística
- .fluke521-stat-unit → unidade do card de estatística
- .fluke521-title-th → th do título da tabela (nome do equipamento)
- .fluke521-th → th das colunas de dados (Célula, Resistência, Tensão, Temperatura, Hora)
- .fluke521-td → célula de dados (linhas pares)
- .fluke521-td-alt → célula de dados (linhas ímpares, cor alternada)

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
5. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;

  const result = await reviseTextWithAi({
    text: prompt,
    systemInstruction,
    preserveFormatting: true
  });

  const raw = String(result && result.revisedText ? result.revisedText : "");
  const cleaned = raw
    .replace(/^```css?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  // A IA às vezes devolve só as regras que ela mencionou, descartando o resto do bloco
  // (ex.: some o zebrado porque a regra .fluke521-td-alt não veio na resposta). Reinserimos
  // as regras do CSS atual que não aparecem na resposta, mantendo o que a IA alterou.
  return mergeCssPreservingMissingRules(currentCss, cleaned);
}

// Quebra um bloco CSS em pares seletor -> declarações.
function parseCssRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(String(css || ""))) !== null) {
    const selector = match[1].trim().replace(/\s+/g, " ");
    if (!selector) continue;
    rules.push({ selector, declarations: match[2].trim() });
  }
  return rules;
}

// Chave de comparação sem o escopo [data-*-id="N"], para casar as regras mesmo que o
// id do escopo mude entre o CSS atual e o devolvido pela IA.
function cssRuleKey(selector) {
  return String(selector || "")
    .replace(/\[data-[a-z0-9-]+=(?:"[^"]*"|'[^']*'|[^\]]+)\]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Devolve o CSS da IA acrescido das regras do CSS original que a IA omitiu.
// Se a resposta da IA não tiver nenhuma regra válida, mantém o CSS original.
function mergeCssPreservingMissingRules(currentCss, newCss) {
  const nextRules = parseCssRules(newCss);
  if (!nextRules.length) return String(currentCss || "").trim();

  const nextKeys = new Set(nextRules.map((rule) => cssRuleKey(rule.selector)));
  const missing = parseCssRules(currentCss)
    .filter((rule) => !nextKeys.has(cssRuleKey(rule.selector)))
    .map((rule) => `${rule.selector}{${rule.declarations}}`);

  if (!missing.length) return String(newCss || "").trim();
  return `${String(newCss || "").trim()}\n${missing.join("\n")}`;
}

const DISCHARGE_DEFAULT_STYLE_SETTING_KEY = "report.preview.discharge.style.default";

function buildDischargeStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) {
    cfg.customCss = src.customCss;
  }
  return cfg;
}

function scopeDischargeStyleConfig(styleConfig, testId) {
  const cfg = buildDischargeStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  const scopedCss = cfg.customCss.replace(
    /\[data-discharge-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
    `[data-discharge-id="${Number(testId)}"]`
  );
  return { ...cfg, customCss: scopedCss };
}

async function getDefaultDischargeStyleConfig() {
  const raw = await repo.getAppSetting(DISCHARGE_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildDischargeStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) {
    return null;
  }
}

async function saveDefaultDischargeStyleConfig(styleConfig) {
  const cfg = buildDischargeStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(DISCHARGE_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function applyDefaultDischargeStyle(dischargeTests, defaultStyleConfig) {
  if (!defaultStyleConfig || !defaultStyleConfig.customCss || !Array.isArray(dischargeTests)) {
    return Array.isArray(dischargeTests) ? dischargeTests : [];
  }
  return dischargeTests.map((item) => {
    if (!item || (item.style_config && typeof item.style_config === "object")) return item;
    const scopedStyleConfig = scopeDischargeStyleConfig(defaultStyleConfig, item.id);
    return scopedStyleConfig ? { ...item, style_config: scopedStyleConfig, _uses_default_discharge_style: true } : item;
  });
}

function buildDischargePreviewHtml(test, styleConfig) {
  return renderDischargeTestTable([test], test.id, styleConfig || null);
}

async function applyDischargeStyleViaAi(currentCss, testId, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-discharge-id="${testId}"]`;

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS com escopo "${scope}":
- .discharge-th → células do cabeçalho (todas as colunas exceto Célula)
- .discharge-th-celula → cabeçalho da coluna Célula (primeira coluna)
- .discharge-td → células de dados (linhas pares)
- .discharge-td-alt → células de dados (linhas ímpares, cor alternada)
- .discharge-td-celula → coluna Célula nas linhas de dados

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
5. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;

  const result = await reviseTextWithAi({
    text: prompt,
    systemInstruction,
    preserveFormatting: true
  });

  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw
    .replace(/^```css?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

// ---- TIMESHEET ----
const TIMESHEET_DEFAULT_STYLE_SETTING_KEY = "report.preview.timesheet.style.default";

const DUMMY_TIMESHEET_ITEMS = [
  { activity_date: "2024-06-10", check_in_base: "06:00", check_in_client: "08:00", check_out_client: "17:00", check_out_base: "19:00" },
  { activity_date: "2024-06-11", check_in_base: "06:30", check_in_client: "08:15", check_out_client: "17:30", check_out_base: "19:30" },
  { activity_date: "2024-06-12", check_in_base: "07:00", check_in_client: "09:00", check_out_client: "18:00", check_out_base: "20:00" }
];

function buildTimesheetStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) cfg.customCss = src.customCss;
  return cfg;
}

async function getDefaultTimesheetStyleConfig() {
  const raw = await repo.getAppSetting(TIMESHEET_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildTimesheetStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) { return null; }
}

async function saveDefaultTimesheetStyleConfig(styleConfig) {
  const cfg = buildTimesheetStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(TIMESHEET_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function buildTimesheetPreviewHtml(styleConfig) {
  return renderTimesheetInlineTable(DUMMY_TIMESHEET_ITEMS, styleConfig || null);
}

async function applyTimesheetStyleViaAi(currentCss, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS:
- .report-inline-timesheet-title-row → caption do título da tabela
- .report-inline-timesheet-table thead th → células do cabeçalho
- .report-inline-timesheet-table tbody td → células de dados
- .report-inline-timesheet-table tbody tr:nth-child(even) td → células de linhas pares (cor alternada)

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
3. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
4. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;
  const result = await reviseTextWithAi({ text: prompt, systemInstruction, preserveFormatting: true });
  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw.replace(/^```css?\s*/i, "").replace(/```\s*$/, "").trim();
}

// ---- TECHTEAM ----
const TECHTEAM_DEFAULT_STYLE_SETTING_KEY = "report.preview.techteam.style.default";

const DUMMY_TECHTEAM_ITEMS = [
  { name: "João Silva", role: "Técnico Sênior", company: "Vextrom" },
  { name: "Ana Santos", role: "Engenheira de Campo", company: "Vextrom" },
  { name: "Carlos Lima", role: "Técnico", company: "Parceiro ABC" }
];

function buildTechteamStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) cfg.customCss = src.customCss;
  return cfg;
}

async function getDefaultTechteamStyleConfig() {
  const raw = await repo.getAppSetting(TECHTEAM_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildTechteamStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) { return null; }
}

async function saveDefaultTechteamStyleConfig(styleConfig) {
  const cfg = buildTechteamStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(TECHTEAM_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function buildTechteamPreviewHtml(styleConfig) {
  return renderTechTeamInlineTable(DUMMY_TECHTEAM_ITEMS, styleConfig || null);
}

async function applyTechteamStyleViaAi(currentCss, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS:
- .report-inline-techteam-title-row → caption do título da tabela
- .report-inline-techteam-table thead th → células do cabeçalho
- .report-inline-techteam-table tbody td → células de dados
- .report-inline-techteam-table tbody tr:nth-child(even) td → células de linhas pares (cor alternada)

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
3. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
4. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;
  const result = await reviseTextWithAi({ text: prompt, systemInstruction, preserveFormatting: true });
  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw.replace(/^```css?\s*/i, "").replace(/```\s*$/, "").trim();
}

// ---- EQUIPMENT ----
const EQUIPMENT_DEFAULT_STYLE_SETTING_KEY = "report.preview.equipment.style.default";

const DUMMY_EQUIPMENT_ITEMS = [
  {
    id: 1, ref_id: 1, tag_number: "UPS-01", type: "No-Break", manufacturer: "APC",
    model_family: "Smart-UPS 3000", serial_number: "AS12345678", dt_number: "DT-001",
    year_of_manufacture: "2020", rated_ac_input_voltage: "220V", input_frequency: "60Hz",
    rated_dc_voltage: "96V", rated_ac_output_voltage: "220V", output_frequency: "60Hz",
    degree_of_protection: "IP20", main_label: "Painel Principal"
  }
];

function buildEquipmentStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) cfg.customCss = src.customCss;
  return cfg;
}

async function getDefaultEquipmentStyleConfig() {
  const raw = await repo.getAppSetting(EQUIPMENT_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildEquipmentStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) { return null; }
}

async function saveDefaultEquipmentStyleConfig(styleConfig) {
  const cfg = buildEquipmentStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(EQUIPMENT_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function buildEquipmentPreviewHtml(styleConfig) {
  return renderEquipmentsInlineTable(DUMMY_EQUIPMENT_ITEMS, styleConfig || null);
}

async function applyEquipmentStyleViaAi(currentCss, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS:
- .report-inline-equipments-title-row → caption do título de cada equipamento
- .report-inline-equipments-table .report-inline-equipments-label → células de rótulo (th)
- .report-inline-equipments-table .report-inline-equipments-value → células de valor (td)

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
3. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
4. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;
  const result = await reviseTextWithAi({ text: prompt, systemInstruction, preserveFormatting: true });
  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw.replace(/^```css?\s*/i, "").replace(/```\s*$/, "").trim();
}

// ---- DISCHARGE CHART ----
const DISCHARGE_CHART_DEFAULT_STYLE_SETTING_KEY = "report.preview.discharge.chart.style.default";

function buildDischargeChartStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) {
    cfg.customCss = src.customCss;
  }
  return cfg;
}

function scopeDischargeChartStyleConfig(styleConfig, testId) {
  const cfg = buildDischargeChartStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  const scopedCss = cfg.customCss.replace(
    /\[data-discharge-chart-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
    `[data-discharge-chart-id="${Number(testId)}"]`
  );
  return { ...cfg, customCss: scopedCss };
}

async function getDefaultDischargeChartStyleConfig() {
  const raw = await repo.getAppSetting(DISCHARGE_CHART_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildDischargeChartStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) {
    return null;
  }
}

async function saveDefaultDischargeChartStyleConfig(styleConfig) {
  const cfg = buildDischargeChartStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(DISCHARGE_CHART_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function buildDischargeChartPreviewHtml(test, styleConfig) {
  return generateDischargeSvgChart([test], test.id, -1, styleConfig || null);
}

async function applyDischargeChartStyleViaAi(currentCss, testId, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-discharge-chart-id="${testId}"]`;

  const systemInstruction = `Você é um especialista em CSS para gráficos HTML/SVG impressos em PDF via Puppeteer.

O gráfico usa as seguintes classes CSS com escopo "${scope}":
- .dch-chart-header → barra de cabeçalho superior (use !important para sobrescrever estilos inline)
- .dch-chart-line → linha do gráfico SVG (propriedades: stroke, stroke-width)
- .dch-chart-fill → área preenchida sob a linha SVG (propriedade: fill)
- .dch-chart-point → círculos de dados no SVG (propriedade: fill)
- .dch-chart-point-label → valores exibidos acima dos pontos (propriedade: fill)

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Para .dch-chart-header use !important nas propriedades de cor e fundo.
5. Para .dch-chart-line, .dch-chart-point, .dch-chart-fill, .dch-chart-point-label: !important NÃO é necessário.
6. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
7. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;

  const result = await reviseTextWithAi({ text: prompt, systemInstruction, preserveFormatting: true });
  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw.replace(/^```css?\s*/i, "").replace(/```\s*$/, "").trim();
}

// ---- COMPONENTS ----
const COMPONENTS_DEFAULT_STYLE_SETTING_KEY = "report.preview.components.style.default";

const DUMMY_COMPONENTS_ITEMS = [
  { id: 1, category: "replaced", equipment_id: null, tag_number: null, description: "Módulo de bateria 12V 100Ah", part_number: "BAT-12-100", quantity: 4, notes: "" },
  { id: 2, category: "replaced", equipment_id: null, tag_number: null, description: "Fusível 30A", part_number: "FUS-030A", quantity: 2, notes: "" },
  { id: 3, category: "required", equipment_id: null, tag_number: null, description: "Capacitor eletrolítico 470µF", part_number: "CAP-470UF", quantity: 6, notes: "" }
];

function buildComponentsStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) cfg.customCss = src.customCss;
  return cfg;
}

async function getDefaultComponentsStyleConfig() {
  const raw = await repo.getAppSetting(COMPONENTS_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildComponentsStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) { return null; }
}

async function saveDefaultComponentsStyleConfig(styleConfig) {
  const cfg = buildComponentsStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(COMPONENTS_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function scopeComponentsStyleConfig(styleConfig, reportId) {
  const cfg = buildComponentsStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  const scopedCss = cfg.customCss.replace(
    /\[data-components-report-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
    `[data-components-report-id="${Number(reportId)}"]`
  );
  return { ...cfg, customCss: scopedCss };
}

function applyDefaultComponentsStyle(report, defaultStyleConfig) {
  if (!report || !defaultStyleConfig || !defaultStyleConfig.customCss) return report;
  if (report.components_style_config && typeof report.components_style_config === "object") return report;
  const scoped = scopeComponentsStyleConfig(defaultStyleConfig, report.id);
  return scoped ? { ...report, components_style_config: scoped } : report;
}

function buildComponentsPreviewHtml(reportId, styleConfig) {
  return renderComponentsInlineTable(DUMMY_COMPONENTS_ITEMS, reportId, styleConfig || null);
}

async function applyComponentsStyleViaAi(currentCss, reportId, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-components-report-id="${reportId}"]`;

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

A tabela usa as seguintes classes CSS com escopo "${scope}":
- .report-inline-components-table → tabela principal (width, border-collapse, font-size)
- .report-inline-components-table th → células de cabeçalho
- .report-inline-components-table td → células de dados
- .report-inline-components-table thead th → th do cabeçalho de colunas
- .report-inline-components-meta th → th da linha de metadados (equipamento/categoria)
- .report-inline-components-qty → coluna de quantidade
- .report-inline-components-desc → coluna de descrição
- .report-inline-components-part → coluna de part number

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
5. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;
  const result = await reviseTextWithAi({ text: prompt, systemInstruction, preserveFormatting: true });
  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw.replace(/^```css?\s*/i, "").replace(/```\s*$/, "").trim();
}

// ---- UPS MEASURES (@mesuaresUPS) ----
const UPS_DEFAULT_STYLE_SETTING_KEY = "report.preview.upsmeasures.style.default";

function upsScopeId(id) {
  return `ups-${Number(id)}`;
}

function buildUpsStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) {
    cfg.customCss = src.customCss;
  }
  return cfg;
}

function scopeUpsStyleConfig(styleConfig, id) {
  const cfg = buildUpsStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  const scopedCss = cfg.customCss.replace(
    /\[data-table-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
    `[data-table-id="${upsScopeId(id)}"]`
  );
  return { ...cfg, customCss: scopedCss };
}

async function getDefaultUpsStyleConfig() {
  const raw = await repo.getAppSetting(UPS_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildUpsStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) {
    return null;
  }
}

async function saveDefaultUpsStyleConfig(styleConfig) {
  const cfg = buildUpsStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(UPS_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function applyDefaultUpsStyle(upsMeasures, defaultStyleConfig) {
  if (!defaultStyleConfig || !defaultStyleConfig.customCss || !Array.isArray(upsMeasures)) {
    return Array.isArray(upsMeasures) ? upsMeasures : [];
  }
  return upsMeasures.map((item) => {
    if (!item || (item.style_config && typeof item.style_config === "object")) return item;
    const scopedStyleConfig = scopeUpsStyleConfig(defaultStyleConfig, item.id);
    return scopedStyleConfig ? { ...item, style_config: scopedStyleConfig, _uses_default_ups_style: true } : item;
  });
}

function buildUpsPreviewHtml(upsItem, styleConfig) {
  return renderUpsMeasuresTable([upsItem], upsItem.id, styleConfig || null);
}

async function applyUpsStyleViaAi(currentCss, id, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-table-id="${upsScopeId(id)}"]`;

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

O bloco de medições UPS usa as seguintes classes CSS com escopo "${scope}":
- .meas-title → caption do título (cabeçalho e título de cada seção de medições)
- .meas-th → células do cabeçalho de colunas das seções
- .meas-td → células de dados (linhas pares) — também usadas no bloco de cabeçalho (série/firmware)
- .meas-td-alt → células de dados (linhas ímpares, cor alternada)
- .meas-notes → bloco de observações abaixo das tabelas

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
5. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;

  const result = await reviseTextWithAi({ text: prompt, systemInstruction, preserveFormatting: true });
  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw.replace(/^```css?\s*/i, "").replace(/```\s*$/, "").trim();
}

// ---- EVENT LOG (@eventlogUPS) ----
const EVENTLOG_DEFAULT_STYLE_SETTING_KEY = "report.preview.eventlog.style.default";

function evlogScopeId(id) {
  return `evlog-${Number(id)}`;
}

function buildEventLogStyleConfig(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const cfg = {};
  if (src.customCss && typeof src.customCss === "string" && src.customCss.trim()) {
    cfg.customCss = src.customCss;
  }
  return cfg;
}

function scopeEventLogStyleConfig(styleConfig, id) {
  const cfg = buildEventLogStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  const scopedCss = cfg.customCss.replace(
    /\[data-table-id=(?:"[^"]*"|'[^']*'|[^\]]+)\]/g,
    `[data-table-id="${evlogScopeId(id)}"]`
  );
  return { ...cfg, customCss: scopedCss };
}

async function getDefaultEventLogStyleConfig() {
  const raw = await repo.getAppSetting(EVENTLOG_DEFAULT_STYLE_SETTING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const cfg = buildEventLogStyleConfig(parsed);
    return cfg.customCss ? cfg : null;
  } catch (_err) {
    return null;
  }
}

async function saveDefaultEventLogStyleConfig(styleConfig) {
  const cfg = buildEventLogStyleConfig(styleConfig);
  if (!cfg.customCss) return null;
  await repo.upsertAppSetting(EVENTLOG_DEFAULT_STYLE_SETTING_KEY, JSON.stringify(cfg));
  return cfg;
}

function applyDefaultEventLogStyle(eventLogs, defaultStyleConfig) {
  if (!defaultStyleConfig || !defaultStyleConfig.customCss || !Array.isArray(eventLogs)) {
    return Array.isArray(eventLogs) ? eventLogs : [];
  }
  return eventLogs.map((item) => {
    if (!item || (item.style_config && typeof item.style_config === "object")) return item;
    const scopedStyleConfig = scopeEventLogStyleConfig(defaultStyleConfig, item.id);
    return scopedStyleConfig ? { ...item, style_config: scopedStyleConfig, _uses_default_eventlog_style: true } : item;
  });
}

function buildEventLogPreviewHtml(eventLogItem, styleConfig) {
  // Preview com no máx. 12 linhas para não pesar o modal
  const previewItem = (() => {
    if (!eventLogItem || !Array.isArray(eventLogItem.sections_json)) return eventLogItem;
    return {
      ...eventLogItem,
      sections_json: eventLogItem.sections_json.map((s) => ({
        ...s,
        rows: Array.isArray(s.rows) ? s.rows.slice(0, 12) : []
      }))
    };
  })();
  return renderEventLogTable([previewItem], previewItem.id, styleConfig || null);
}

async function applyEventLogStyleViaAi(currentCss, id, userInstruction, reviseTextWithAi) {
  if (typeof reviseTextWithAi !== "function") {
    const err = new Error("Serviço de IA indisponível.");
    err.statusCode = 500;
    throw err;
  }

  const scope = `[data-table-id="${evlogScopeId(id)}"]`;

  const systemInstruction = `Você é um especialista em CSS para tabelas HTML impressas em PDF via Puppeteer.

O bloco de log de eventos UPS usa as seguintes classes CSS com escopo "${scope}":
- .meas-title → caption do título (cabeçalho e título da tabela de eventos)
- .meas-th → células do cabeçalho de colunas (Source, Event Name, Status, etc.)
- .meas-td → células de dados (linhas pares) — também usadas no bloco de cabeçalho (série/firmware)
- .meas-td-alt → células de dados (linhas ímpares, cor alternada)
- .meas-notes → bloco de observações abaixo da tabela

REGRAS OBRIGATÓRIAS:
1. Retorne APENAS o bloco CSS completo modificado — sem explicações, sem markdown, sem blocos de código \`\`\`.
2. Mantenha EXATAMENTE o prefixo de escopo "${scope}" em TODOS os seletores.
3. Use apenas propriedades CSS compatíveis com Puppeteer: cores em hex, sem gradientes, sem variáveis CSS (--var).
4. Preserve todas as propriedades existentes, modificando apenas o que a instrução solicita.
5. Não adicione seletores além dos listados acima.`;

  const prompt = `CSS atual:\n${currentCss}\n\nInstrução: ${userInstruction}\n\nRetorne o CSS completo modificado.`;

  const result = await reviseTextWithAi({ text: prompt, systemInstruction, preserveFormatting: true });
  const raw = String(result && result.revisedText ? result.revisedText : "");
  return raw.replace(/^```css?\s*/i, "").replace(/```\s*$/, "").trim();
}

module.exports = {
  generateDefaultCss,
  generateDefaultAlberCss,
  generateDefaultFluke521Css,
  generateDefaultDischargeCss,
  generateDefaultTimesheetCss,
  generateDefaultTechteamCss,
  generateDefaultEquipmentCss,
  buildStyleConfig,
  scopeMeasurementStyleConfig,
  getDefaultMeasurementStyleConfig,
  saveDefaultMeasurementStyleConfig,
  applyDefaultMeasurementStyle,
  buildPreviewHtml,
  buildAlberPreviewHtml,
  buildAlberStyleConfig,
  scopeAlberStyleConfig,
  getDefaultAlberStyleConfig,
  saveDefaultAlberStyleConfig,
  applyDefaultAlberStyle,
  applyStyleViaAi,
  applyAlberStyleViaAi,
  buildFluke521PreviewHtml,
  buildFluke521StyleConfig,
  scopeFluke521StyleConfig,
  getDefaultFluke521StyleConfig,
  saveDefaultFluke521StyleConfig,
  applyDefaultFluke521Style,
  applyFluke521StyleViaAi,
  mergeCssPreservingMissingRules,
  buildDischargeStyleConfig,
  scopeDischargeStyleConfig,
  getDefaultDischargeStyleConfig,
  saveDefaultDischargeStyleConfig,
  applyDefaultDischargeStyle,
  buildDischargePreviewHtml,
  applyDischargeStyleViaAi,
  buildTimesheetStyleConfig,
  getDefaultTimesheetStyleConfig,
  saveDefaultTimesheetStyleConfig,
  buildTimesheetPreviewHtml,
  applyTimesheetStyleViaAi,
  buildTechteamStyleConfig,
  getDefaultTechteamStyleConfig,
  saveDefaultTechteamStyleConfig,
  buildTechteamPreviewHtml,
  applyTechteamStyleViaAi,
  buildEquipmentStyleConfig,
  getDefaultEquipmentStyleConfig,
  saveDefaultEquipmentStyleConfig,
  buildEquipmentPreviewHtml,
  applyEquipmentStyleViaAi,
  generateDefaultDischargeChartCss,
  buildDischargeChartStyleConfig,
  scopeDischargeChartStyleConfig,
  getDefaultDischargeChartStyleConfig,
  saveDefaultDischargeChartStyleConfig,
  buildDischargeChartPreviewHtml,
  applyDischargeChartStyleViaAi,
  generateDefaultComponentsCss,
  buildComponentsStyleConfig,
  scopeComponentsStyleConfig,
  getDefaultComponentsStyleConfig,
  saveDefaultComponentsStyleConfig,
  applyDefaultComponentsStyle,
  buildComponentsPreviewHtml,
  applyComponentsStyleViaAi,
  buildUpsStyleConfig,
  scopeUpsStyleConfig,
  getDefaultUpsStyleConfig,
  saveDefaultUpsStyleConfig,
  applyDefaultUpsStyle,
  buildUpsPreviewHtml,
  applyUpsStyleViaAi,
  buildEventLogStyleConfig,
  scopeEventLogStyleConfig,
  getDefaultEventLogStyleConfig,
  saveDefaultEventLogStyleConfig,
  applyDefaultEventLogStyle,
  buildEventLogPreviewHtml,
  applyEventLogStyleViaAi
};
