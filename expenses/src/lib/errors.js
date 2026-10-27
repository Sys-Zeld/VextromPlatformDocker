// Erro de domínio com status HTTP e código estável. As rotas convertem em
// { error, errorCode, details } — mesmo envelope do restante da façade v2.
class DomainError extends Error {
  constructor(status, errorCode, message, details = null) {
    super(message);
    this.name = "DomainError";
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

const badRequest = (code, msg, details) => new DomainError(400, code, msg, details);
const forbidden = (msg = "Acesso negado", code = "EX_FORBIDDEN") => new DomainError(403, code, msg);
const notFound = (msg = "Registro não encontrado", code = "EX_NOT_FOUND") => new DomainError(404, code, msg);
const conflict = (code, msg, details) => new DomainError(409, code, msg, details);
const unprocessable = (code, msg, details) => new DomainError(422, code, msg, details);

// Normaliza erro do zod.
function fromZod(err) {
  return badRequest(
    "EX_VALIDATION",
    "Dados inválidos",
    err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
  );
}

module.exports = { DomainError, badRequest, forbidden, notFound, conflict, unprocessable, fromZod };
