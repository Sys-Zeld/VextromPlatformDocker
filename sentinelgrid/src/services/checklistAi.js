const { generateProfileJsonFromDocument } = require("../../../specflow/services/aiProfiles");
const { MAINTENANCE_TYPE } = require("../constants");
const { CHECKLIST_ITEM_TYPE } = require("../validators/checklistValidators");

const CHECKLIST_JSON_TEMPLATE = JSON.stringify({
  name: "Nome do checklist identificado no documento",
  description: "Objetivo e contexto do checklist",
  maintenanceType: "preventiva_sem_parada",
  equipmentType: "Tipo de equipamento, se informado",
  manufacturer: "Fabricante, se informado",
  model: "Modelo, se informado",
  program: "Programa ou plano de manutencao, se informado",
  notes: "Observacoes gerais do documento",
  fields: [
    {
      title: "Nome completo do campo, pergunta, verificacao ou atividade",
      itemType: "inspection",
      required: true,
      expectedValue: "Valor ou resultado esperado",
      unit: "Unidade de medida",
      acceptanceCriteria: "Limites, faixa, regra ou criterio de aceite",
      notes: "Instrucao, metodo, referencia, risco ou observacao",
      additionalFields: [{ label: "Nome de outra coluna encontrada", value: "Conteudo original" }]
    }
  ]
});

const CHECKLIST_AI_INSTRUCTIONS = `
Converta o PDF em um checklist operacional completo para manutencao.
- Crie um item em fields para CADA campo, linha, pergunta, medicao, teste, inspecao, requisito de seguranca ou atividade encontrada. Nao agrupe e nao omita itens repetidos que representem etapas diferentes.
- Preserve a ordem do documento e a terminologia tecnica original.
- Use itemType somente como inspection, measurement, test, safety ou note.
- Extraia valor esperado, unidade e criterio de aceite somente quando existirem; nao invente limites tecnicos.
- required deve refletir marcacoes do documento. Quando nao estiver claro, use true.
- Toda coluna ou propriedade do documento que nao tenha campo equivalente deve ser preservada em additionalFields como label/value.
- maintenanceType deve ser exatamente um destes valores: preventiva_sem_parada, preventiva_com_parada, corretiva, comissionamento, teste_bateria ou retrofit.
- Retorne todos os campos do modelo JSON, mesmo quando o valor for string vazia.
`;

function text(value, max) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try { return JSON.stringify(value).slice(0, max); } catch (_err) { return ""; }
  }
  return String(value).trim().slice(0, max);
}

function normalizedToken(value) {
  return text(value, 100)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMaintenanceType(value) {
  const token = normalizedToken(value);
  if (MAINTENANCE_TYPE.includes(token)) return token;
  if (token.includes("corret")) return "corretiva";
  if (token.includes("comission")) return "comissionamento";
  if (token.includes("bateria") || token.includes("battery")) return "teste_bateria";
  if (token.includes("retrofit") || token.includes("moderniza")) return "retrofit";
  if (token.includes("com_parada") || token.includes("shutdown") || token.includes("outage")) return "preventiva_com_parada";
  return "preventiva_sem_parada";
}

function normalizeItemType(value) {
  const token = normalizedToken(value);
  if (CHECKLIST_ITEM_TYPE.includes(token)) return token;
  if (/medic|measurement|leitura|reading/.test(token)) return "measurement";
  if (/teste|test|ensaio/.test(token)) return "test";
  if (/segur|safety|risco|epi|bloqueio/.test(token)) return "safety";
  if (/nota|note|observ/.test(token)) return "note";
  return "inspection";
}

function normalizeRequired(value) {
  if (typeof value === "boolean") return value;
  const token = normalizedToken(value);
  if (["false", "nao", "no", "optional", "opcional", "0"].includes(token)) return false;
  return true;
}

function first(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") return source[key];
  }
  return "";
}

function additionalNotes(field) {
  const additional = first(field, ["additionalFields", "additional_fields", "extraFields", "extra_fields"]);
  if (!additional) return "";
  if (Array.isArray(additional)) {
    return additional
      .map((entry) => {
        if (!entry || typeof entry !== "object") return text(entry, 300);
        const label = text(first(entry, ["label", "name", "key", "column"]), 120);
        const value = text(first(entry, ["value", "content", "text"]), 300);
        return label && value ? `${label}: ${value}` : value || label;
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof additional === "object") {
    return Object.entries(additional)
      .map(([key, value]) => `${text(key, 120)}: ${text(value, 300)}`)
      .join("; ");
  }
  return text(additional, 800);
}

function normalizeChecklistDraft(profileJson) {
  const source = profileJson && typeof profileJson === "object" ? profileJson : {};
  const fields = Array.isArray(source.fields) ? source.fields : [];
  const items = fields.map((raw, index) => {
    const field = raw && typeof raw === "object" ? raw : { title: raw };
    const title = text(first(field, ["title", "name", "label", "field", "activity", "question", "description"]), 240);
    if (!title) return null;
    const baseNotes = text(first(field, ["notes", "note", "instructions", "instruction", "method", "reference"]), 700);
    const extras = additionalNotes(field);
    return {
      title,
      itemType: normalizeItemType(first(field, ["itemType", "item_type", "type", "kind"])),
      required: normalizeRequired(first(field, ["required", "mandatory", "obrigatorio", "obrigatoria"])),
      expectedValue: text(first(field, ["expectedValue", "expected_value", "expected", "target", "referenceValue", "valorEsperado"]), 500),
      unit: text(first(field, ["unit", "unidade", "uom"]), 60),
      acceptanceCriteria: text(first(field, ["acceptanceCriteria", "acceptance_criteria", "criteria", "criterion", "limits", "range", "criterioAceite"]), 1000),
      orderIndex: (index + 1) * 10,
      notes: [baseNotes, extras].filter(Boolean).join("; ").slice(0, 1000)
    };
  }).filter(Boolean);

  if (!items.length) {
    const err = new Error("A IA nao identificou campos de checklist no documento.");
    err.statusCode = 422;
    throw err;
  }

  return {
    checklist: {
      name: text(first(source, ["name", "title", "checklistName"]), 160) || "Checklist importado de PDF",
      description: text(first(source, ["description", "objective", "scope"]), 2000),
      equipmentTypeId: null,
      manufacturerId: null,
      modelId: null,
      programId: null,
      maintenanceType: normalizeMaintenanceType(first(source, ["maintenanceType", "maintenance_type", "type"])),
      active: true,
      notes: text(first(source, ["notes", "observations", "references"]), 2000)
    },
    suggestedScope: {
      equipmentType: text(first(source, ["equipmentType", "equipment_type"]), 160),
      manufacturer: text(source.manufacturer, 160),
      model: text(source.model, 160),
      program: text(source.program, 160)
    },
    items
  };
}

async function extractChecklistFromPdf({ fileBuffer, fileName, userInstructions = "" }) {
  const result = await generateProfileJsonFromDocument({
    fileBuffer,
    fileName,
    mimeType: "application/pdf",
    jsonModelTemplate: CHECKLIST_JSON_TEMPLATE,
    userInstructions: [CHECKLIST_AI_INSTRUCTIONS, text(userInstructions, 4000)].filter(Boolean).join("\n\n")
  });
  return normalizeChecklistDraft(result.profileJson);
}

module.exports = { extractChecklistFromPdf, normalizeChecklistDraft };
