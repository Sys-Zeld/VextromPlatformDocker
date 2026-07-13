const { z } = require("zod");
const { CRITICALITY, MAINTENANCE_TYPE, PERIODICITY } = require("../constants");

const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());

const optionalId = nullable(z.coerce.number().int().positive());
const optionalCriticality = nullable(z.enum(CRITICALITY));
const text = (max) => z.string().trim().max(max).optional().default("");

const maintenanceProgramInputSchema = z.object({
  name: z.string().trim().min(2, "Nome e obrigatorio").max(160),
  description: text(2000),
  equipmentTypeId: optionalId,
  manufacturerId: optionalId,
  modelId: optionalId,
  contractId: z.coerce.number().int().positive("Contrato e obrigatorio"),
  criticality: optionalCriticality,
  maintenanceType: z.enum(MAINTENANCE_TYPE),
  periodicity: z.enum(PERIODICITY),
  planIntervalsMonths: z.array(z.coerce.number().int().positive().max(120)).optional().default([]),
  active: z.boolean().optional().default(true),
  scopeNotes: text(1000),
  notes: text(2000)
});

function parseMaintenanceProgramInput(body) {
  return maintenanceProgramInputSchema.parse(body ?? {});
}

// Geração de planos a partir do programa: equipamentos + um bloco de datas por intervalo.
// Cada item de `plans` vira um plano (por equipamento) com um item por data.
const dateArray = z.array(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida")).min(1, "Informe ao menos uma data");
const generatePlansSchema = z.object({
  equipmentIds: z.array(z.coerce.number().int().positive()).min(1, "Selecione ao menos um equipamento"),
  plans: z.array(z.object({
    intervalMonths: z.coerce.number().int().positive().max(120),
    dates: dateArray
  })).min(1, "Informe ao menos um intervalo")
});

function parseGeneratePlansInput(body) {
  return generatePlansSchema.parse(body ?? {});
}

module.exports = { maintenanceProgramInputSchema, parseMaintenanceProgramInput, generatePlansSchema, parseGeneratePlansInput };
