const { renderMeasurementsInlineTable, generateDefaultCss, renderAlberLeituraTable, generateDefaultAlberCss } = require("./reportPreviewService");
const repo = require("../repositories/serviceReportRepository");

const ALBER_DEFAULT_STYLE_SETTING_KEY = "report.preview.alber.style.default";

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

module.exports = {
  generateDefaultCss,
  generateDefaultAlberCss,
  buildStyleConfig,
  buildPreviewHtml,
  buildAlberPreviewHtml,
  buildAlberStyleConfig,
  scopeAlberStyleConfig,
  getDefaultAlberStyleConfig,
  saveDefaultAlberStyleConfig,
  applyDefaultAlberStyle,
  applyStyleViaAi,
  applyAlberStyleViaAi
};
