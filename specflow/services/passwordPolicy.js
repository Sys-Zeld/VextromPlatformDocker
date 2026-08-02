// Política de senha forte.
//
// Vale para senhas NOVAS (convite, redefinição, troca e cadastro por admin).
// As senhas já existentes não são revalidadas — continuam funcionando como
// estão, e só passam a exigir a política quando forem trocadas.

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

// Senhas campeãs de vazamento e as óbvias deste domínio. Comparação é feita
// sobre a senha em minúsculas, então basta a forma minúscula aqui.
const BLOCKLIST = new Set([
  "password", "senha123", "12345678", "123456789", "1234567890",
  "qwertyui", "qwerty123", "admin123", "administrador", "vextrom123",
  "changeme", "change-me", "mudar123", "trocar123", "abc12345",
  "senhasenha", "password1", "password123", "iloveyou", "letmein"
]);

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** Trecho de 4+ caracteres em sequência de teclado/alfabeto, para frente ou para trás. */
function hasSequentialRun(value) {
  const lower = value.toLowerCase();
  for (const sequence of SEQUENCES) {
    const reversed = [...sequence].reverse().join("");
    for (const source of [sequence, reversed]) {
      for (let i = 0; i + 4 <= source.length; i++) {
        if (lower.includes(source.slice(i, i + 4))) return true;
      }
    }
  }
  return false;
}

/** 3+ vezes o mesmo caractere seguido (aaa, 111). */
function hasRepeatedRun(value) {
  return /(.)\1{2,}/.test(value);
}

/**
 * Valida a senha e devolve a lista de problemas em português.
 * Lista vazia = senha aceita.
 */
function validatePassword(password, context = {}) {
  const value = String(password || "");
  const problems = [];

  if (value.length < MIN_LENGTH) problems.push(`Use ao menos ${MIN_LENGTH} caracteres.`);
  if (value.length > MAX_LENGTH) problems.push(`Use no máximo ${MAX_LENGTH} caracteres.`);
  if (!/[a-z]/.test(value)) problems.push("Inclua ao menos uma letra minúscula.");
  if (!/[A-Z]/.test(value)) problems.push("Inclua ao menos uma letra maiúscula.");
  if (!/[0-9]/.test(value)) problems.push("Inclua ao menos um número.");
  if (!/[^A-Za-z0-9]/.test(value)) problems.push("Inclua ao menos um símbolo (ex.: ! @ # $ %).");
  if (/\s/.test(value)) problems.push("Não use espaços.");

  const lower = value.toLowerCase();
  if (BLOCKLIST.has(lower)) problems.push("Essa senha é muito comum. Escolha outra.");
  if (hasRepeatedRun(value)) problems.push("Evite repetir o mesmo caractere três vezes seguidas.");
  if (hasSequentialRun(value)) problems.push("Evite sequências óbvias como \"abcd\" ou \"1234\".");

  // A senha não pode conter o próprio login/e-mail — é o primeiro palpite de quem ataca.
  for (const field of ["username", "email"]) {
    const raw = String(context[field] || "").trim().toLowerCase();
    const needle = field === "email" ? raw.split("@")[0] : raw;
    if (needle.length >= 4 && lower.includes(needle)) {
      problems.push("A senha não pode conter o seu usuário ou e-mail.");
      break;
    }
  }

  return problems;
}

function isStrongPassword(password, context = {}) {
  return validatePassword(password, context).length === 0;
}

/** Texto único para telas que mostram um erro só. */
function describeRequirements() {
  return `Mínimo de ${MIN_LENGTH} caracteres, com maiúscula, minúscula, número e símbolo. `
    + "Sem espaços, sequências óbvias ou repetições, e sem conter seu usuário/e-mail.";
}

module.exports = {
  MIN_LENGTH,
  MAX_LENGTH,
  validatePassword,
  isStrongPassword,
  describeRequirements
};
