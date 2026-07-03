const { z } = require("zod");
const { MAINTENANCE_TYPE } = require("../constants");

const CHECKLIST_ITEM_TYPE = ["inspection", "measurement", "test", "safety", "note"];

const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());

const optionalId = nullable(z.coerce.number().int().positive());
const text = (max) => z.string().trim().max(max).optional().default("");

const checklistInputSchema = z.object({
  name: z.string().trim().min(2, "Nome e obrigatorio").max(160),
  description: text(2000),
  equipmentTypeId: optionalId,
  manufacturerId: optionalId,
  modelId: optionalId,
  programId: optionalId,
  maintenanceType: z.enum(MAINTENANCE_TYPE),
  active: z.boolean().optional().default(true),
  notes: text(2000)
});

const checklistItemInputSchema = z.object({
  title: z.string().trim().min(2, "Titulo e obrigatorio").max(240),
  itemType: z.enum(CHECKLIST_ITEM_TYPE).optional().default("inspection"),
  required: z.boolean().optional().default(true),
  expectedValue: text(500),
  unit: text(60),
  acceptanceCriteria: text(1000),
  orderIndex: z.coerce.number().int().min(0).max(10000).optional().default(0),
  notes: text(1000)
});

function parseChecklistInput(body) {
  return checklistInputSchema.parse(body ?? {});
}

function parseChecklistItemInput(body) {
  return checklistItemInputSchema.parse(body ?? {});
}

module.exports = {
  CHECKLIST_ITEM_TYPE,
  checklistInputSchema,
  checklistItemInputSchema,
  parseChecklistInput,
  parseChecklistItemInput
};
