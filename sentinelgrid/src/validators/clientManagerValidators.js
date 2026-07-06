const { z } = require("zod");

const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());

// Gestor do cliente (§8): pertence a um cliente, com escopo opcional de site.
const clientManagerInputSchema = z.object({
  clientId: z.coerce.number().int().positive("Cliente é obrigatório"),
  siteId: nullable(z.coerce.number().int().positive()),
  areaId: nullable(z.coerce.number().int().positive()),
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  roleType: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().max(200).optional().default(""),
  phone: z.string().trim().max(60).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

function parseClientManagerInput(body) {
  return clientManagerInputSchema.parse(body ?? {});
}

module.exports = { clientManagerInputSchema, parseClientManagerInput };
