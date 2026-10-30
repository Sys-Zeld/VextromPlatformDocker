// Validação e máscara de CPF.

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isValidCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

function formatCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return cpf;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

// "123.456.789-09" → "***.456.789-**" (padrão usual de exibição parcial).
function maskCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return cpf ? "***" : "";
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

// Mantém só os últimos `visible` caracteres: "123456" → "****56".
function maskTail(value, visible = 2) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= visible) return "*".repeat(text.length);
  return "*".repeat(Math.min(text.length - visible, 6)) + text.slice(-visible);
}

// Chave Pix: e-mail mostra início + domínio; demais, só o final.
function maskPixKey(value, type) {
  const text = String(value || "");
  if (!text) return "";
  if (type === "EMAIL" && text.includes("@")) {
    const [user, domain] = text.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (type === "CPF") return maskCpf(text);
  return maskTail(text, 4);
}

module.exports = { onlyDigits, isValidCpf, formatCpf, maskCpf, maskTail, maskPixKey };
