const { z } = require("zod");
const { MAINTENANCE_TYPE, PERIODICITY } = require("../constants");

const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());

const optionalId = nullable(z.coerce.number().int().positive());
const optionalDate = nullable(z.string().trim());
const text = (max) => z.string().trim().max(max).optional().default("");

const equipmentPlanInputSchema = z.object({
  equipmentId: z.coerce.number().int().positive("Equipamento e obrigatorio"),
  programId: optionalId,
  name: z.string().trim().min(2, "Nome e obrigatorio").max(180),
  maintenanceType: z.enum(MAINTENANCE_TYPE),
  periodicity: z.enum(PERIODICITY),
  adjustments: z.record(z.unknown()).optional().default({}),
  active: z.boolean().optional().default(true),
  notes: text(2000),
  initialNextDueDate: optionalDate
});

const planItemInputSchema = z.object({
  title: z.string().trim().min(2, "Titulo e obrigatorio").max(180),
  maintenanceType: z.enum(MAINTENANCE_TYPE),
  periodicity: z.enum(PERIODICITY),
  nextDueDate: optionalDate,
  orderIndex: z.coerce.number().int().nonnegative().optional().default(0),
  notes: text(2000)
});

function parseEquipmentPlanInput(body) {
  return equipmentPlanInputSchema.parse(body ?? {});
}

function parsePlanItemInput(body) {
  return planItemInputSchema.parse(body ?? {});
}

module.exports = { equipmentPlanInputSchema, planItemInputSchema, parseEquipmentPlanInput, parsePlanItemInput };
