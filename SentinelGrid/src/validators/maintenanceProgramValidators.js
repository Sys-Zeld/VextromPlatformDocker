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
  contractId: optionalId,
  criticality: optionalCriticality,
  maintenanceType: z.enum(MAINTENANCE_TYPE),
  periodicity: z.enum(PERIODICITY),
  active: z.boolean().optional().default(true),
  scopeNotes: text(1000),
  notes: text(2000)
});

function parseMaintenanceProgramInput(body) {
  return maintenanceProgramInputSchema.parse(body ?? {});
}

module.exports = { maintenanceProgramInputSchema, parseMaintenanceProgramInput };
