const { z } = require("zod");

const nullable = (schema) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), schema.nullable());

// Contrato / escopo de atendimento (§26): pertence a um cliente.
const contractInputSchema = z.object({
  clientId: z.coerce.number().int().positive("Cliente é obrigatório"),
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  contractNumber: z.string().trim().max(60).optional().default(""),
  validFrom: nullable(z.string().trim()),
  validTo: nullable(z.string().trim()),
  maintPerYear: nullable(z.coerce.number().int().nonnegative()),
  slaCorrective: z.string().trim().max(120).optional().default(""),
  requiresReport: z.boolean().optional().default(false),
  requiresApproval: z.boolean().optional().default(false),
  contactEmail: z.string().trim().max(200).optional().default(""),
  contactPhone: z.string().trim().max(60).optional().default(""),
  scope: z.string().trim().max(2000).optional().default(""),
  notes: z.string().trim().max(2000).optional().default("")
});

function parseContractInput(body) {
  return contractInputSchema.parse(body ?? {});
}

module.exports = { contractInputSchema, parseContractInput };
