// Interface mobile do módulo: o servidor decide pelo navegador quem recebe a
// versão de celular (só as funções do Colaborador). Tablets ficam na versão
// completa — iPadOS se apresenta como Mac e tablets Android não trazem "Mobile".

const MOBILE_UA = /Android.+Mobile|iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i;

// Cookie lido pelo SPA para seguir a mesma decisão nas navegações internas.
const UI_COOKIE = "ex_ui";
// Preferência do usuário ("desktop" = quer a versão completa no celular).
const VIEW_COOKIE = "ex_view";

function isMobileRequest(req) {
  // Client Hint é mais confiável que o user-agent quando o navegador envia
  // (Chromium; inclusive "versão para computador" no Android manda ?0).
  const hint = String(req.get("sec-ch-ua-mobile") || "").trim();
  if (hint === "?1") return true;
  if (hint === "?0") return false;
  return MOBILE_UA.test(String(req.get("user-agent") || ""));
}

// Rotas do Colaborador com tela própria no mobile; o resto cai na lista.
const MOBILE_EQUIVALENT = new Set(["/reports/new", "/history", "/notifications", "/change-password"]);

// Rota da versão completa (relativa a /app/expenses) → equivalente mobile.
function mobilePathFor(path) {
  if (MOBILE_EQUIVALENT.has(path)) return `/m${path}`;
  const report = /^\/reports\/(\d+)$/.exec(path);
  if (report) return `/m/reports/${report[1]}`;
  return "/m";
}

function isMobilePath(path) {
  return path === "/m" || path.startsWith("/m/");
}

module.exports = { isMobileRequest, mobilePathFor, isMobilePath, UI_COOKIE, VIEW_COOKIE };
