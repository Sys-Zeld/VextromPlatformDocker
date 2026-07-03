const { z } = require("zod");

// Contrato de entrada de Site. clientId obrigatório (todo site pertence a um cliente).
const siteInputSchema = z.object({
  clientId: z.coerce.number().int().positive("Cliente é obrigatório"),
  name: z.string().trim().min(1, "Nome do site é obrigatório").max(200, "Nome muito longo"),
  siteType: z.string().trim().max(120).optional().default(""),
  location: z.string().trim().max(200).optional().default(""),
  localContact: z.string().trim().max(200).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

function parseSiteInput(body) {
  return siteInputSchema.parse(body ?? {});
}

module.exports = { siteInputSchema, parseSiteInput };
