const { z } = require("zod");

const CHECKLIST_RESULT_STATUS = ["pendente", "ok", "nao_conforme", "nao_aplicavel"];
const text = (max) => z.string().trim().max(max).optional().default("");

const checklistResultInputSchema = z.object({
  checklistItemId: z.coerce.number().int().positive("Item de checklist e obrigatorio"),
  value: text(1000),
  status: z.enum(CHECKLIST_RESULT_STATUS).optional().default("pendente"),
  notes: text(2000)
});

function parseChecklistResultInput(body) {
  return checklistResultInputSchema.parse(body ?? {});
}

module.exports = {
  CHECKLIST_RESULT_STATUS,
  checklistResultInputSchema,
  parseChecklistResultInput
};
