const { z } = require("zod");

// Contrato genérico de lookup { name, notes } (fabricante, tipo de equipamento).
const lookupInputSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  notes: z.string().trim().max(2000).optional().default("")
});

function parseLookupInput(body) {
  return lookupInputSchema.parse(body ?? {});
}

module.exports = { lookupInputSchema, parseLookupInput };
