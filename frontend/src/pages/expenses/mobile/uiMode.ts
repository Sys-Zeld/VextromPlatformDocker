// Versão mobile do módulo de Despesas. Quem decide é o servidor (pelo navegador):
// ele grava o cookie ex_ui e o SPA só o segue. ex_view_session=desktop é a
// escolha do usuário por ver a versão completa no celular (até fechar o navegador).
const COOKIE_PATH = "/app/expenses";

function readCookie(name: string): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export const isMobileDevice = () => readCookie("ex_ui") === "mobile";

const VIEW_COOKIE = "ex_view_session";

export const prefersMobile = () => isMobileDevice() && readCookie(VIEW_COOKIE) !== "desktop";

export function setViewPreference(view: "desktop" | "mobile") {
  // "desktop" vale até fechar o navegador; "mobile" apaga e volta a seguir o servidor.
  document.cookie = view === "desktop"
    ? `${VIEW_COOKIE}=desktop; path=${COOKIE_PATH}; samesite=lax`
    : `${VIEW_COOKIE}=; path=${COOKIE_PATH}; max-age=0; samesite=lax`;
}

// Telas só da versão completa que a mobile abre de propósito (espelha o servidor).
export const isDesktopOnlyPath = (pathname: string) => pathname === "/expenses/profile";

// Dados bancários: abre a tela da versão completa sem mudar a preferência.
export const BANK_DATA_URL = "/app/expenses/profile";

const MOBILE_EQUIVALENT = new Set(["/reports/new", "/history", "/notifications", "/change-password"]);

// Rota da versão completa → equivalente mobile (espelha mobilePathFor do servidor).
export function toMobilePath(pathname: string): string {
  const path = pathname.replace(/^\/expenses/, "");
  if (MOBILE_EQUIVALENT.has(path)) return `/expenses/m${path}`;
  const report = /^\/reports\/(\d+)$/.exec(path);
  return report ? `/expenses/m/reports/${report[1]}` : "/expenses/m";
}

export const isMobilePath = (pathname: string) => pathname === "/expenses/m" || pathname.startsWith("/expenses/m/");
