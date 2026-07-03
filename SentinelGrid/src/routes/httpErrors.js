// Helpers de envelope de erro JSON compartilhados pelas rotas do módulo.

// Normaliza erro do zod para { error, errorCode, details }.
function toValidationError(err) {
  if (err && Array.isArray(err.issues)) {
    return {
      error: "Dados inválidos",
      errorCode: "SG_VALIDATION",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    };
  }
  return { error: (err && err.message) || "Dados inválidos", errorCode: "SG_VALIDATION" };
}

// Violação de FK do Postgres (ex.: client_id inexistente).
function isForeignKeyError(err) {
  return Boolean(err && err.code === "23503");
}

// Violação de unicidade do Postgres (ex.: nome duplicado).
function isUniqueViolation(err) {
  return Boolean(err && err.code === "23505");
}

module.exports = { toValidationError, isForeignKeyError, isUniqueViolation };
