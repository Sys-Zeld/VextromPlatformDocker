const { z } = require("zod");
const { CLIENT_STATUS } = require("../constants");

// Contrato de entrada de Cliente (ADR-009): zod como fonte única de validação.
// A façade valida com parseClientInput e devolve issues normalizados no 400.
const clientInputSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  taxId: z.string().trim().max(40, "Identificação fiscal muito longa").optional().default(""),
  segment: z.string().trim().max(120, "Segmento muito longo").optional().default(""),
  status: z.enum(CLIENT_STATUS).optional().default("ativo"),
  notes: z.string().trim().max(2000, "Observações muito longas").optional().default("")
});

function parseClientInput(body) {
  return clientInputSchema.parse(body ?? {});
}

module.exports = { clientInputSchema, parseClientInput };
