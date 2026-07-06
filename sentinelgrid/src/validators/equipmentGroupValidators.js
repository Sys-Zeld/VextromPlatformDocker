const { z } = require("zod");

// Grupo de equipamentos (por site) — Fase 12.
const equipmentGroupInputSchema = z.object({
  siteId: z.coerce.number().int().positive("Site é obrigatório"),
  name: z.string().trim().min(1, "Nome é obrigatório").max(160, "Nome muito longo"),
  description: z.string().trim().max(2000).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

const groupMembersInputSchema = z.object({
  equipmentIds: z.array(z.coerce.number().int().positive()).min(1, "Informe ao menos um equipamento")
});

function parseEquipmentGroupInput(body) {
  return equipmentGroupInputSchema.parse(body ?? {});
}

function parseGroupMembersInput(body) {
  return groupMembersInputSchema.parse(body ?? {});
}

module.exports = { equipmentGroupInputSchema, groupMembersInputSchema, parseEquipmentGroupInput, parseGroupMembersInput };
