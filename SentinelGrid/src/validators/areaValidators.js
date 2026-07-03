const { z } = require("zod");

// Contrato de entrada de Área. siteId obrigatório (toda área pertence a um site).
const areaInputSchema = z.object({
  siteId: z.coerce.number().int().positive("Site é obrigatório"),
  name: z.string().trim().min(1, "Nome da área é obrigatório").max(200, "Nome muito longo"),
  areaType: z.string().trim().max(120).optional().default(""),
  classification: z.string().trim().max(120).optional().default(""),
  accessRestrictions: z.string().trim().max(500).optional().default(""),
  envConditions: z.string().trim().max(500).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

function parseAreaInput(body) {
  return areaInputSchema.parse(body ?? {});
}

module.exports = { areaInputSchema, parseAreaInput };
