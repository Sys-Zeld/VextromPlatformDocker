const { z } = require("zod");

// Modelo de equipamento pertence a um fabricante + um tipo.
const equipmentModelInputSchema = z.object({
  manufacturerId: z.coerce.number().int().positive("Fabricante é obrigatório"),
  equipmentTypeId: z.coerce.number().int().positive("Tipo de equipamento é obrigatório"),
  name: z.string().trim().min(1, "Nome do modelo é obrigatório").max(200, "Nome muito longo"),
  notes: z.string().trim().max(2000).optional().default("")
});

function parseEquipmentModelInput(body) {
  return equipmentModelInputSchema.parse(body ?? {});
}

module.exports = { equipmentModelInputSchema, parseEquipmentModelInput };
