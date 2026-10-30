// Versão mobile do módulo de Despesas. Quem decide é o servidor (pelo navegador):
// ele grava o cookie ex_ui e o SPA só o segue. ex_view=desktop é a escolha do
// usuário por ver a versão completa no celular.
const COOKIE_PATH = "/app/expenses";

function readCookie(name: string): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export const isMobileDevice = () => readCookie("ex_ui") === "mobile";

export const prefersMobile = () => isMobileDevice() && readCookie("ex_view") !== "desktop";

export function setViewPreference(view: "desktop" | "mobile") {
  // 1 ano; "mobile" apaga a preferência e volta a seguir o servidor.
  const maxAge = view === "desktop" ? 60 * 60 * 24 * 365 : 0;
  document.cookie = `ex_view=${view}; path=${COOKIE_PATH}; max-age=${maxAge}; samesite=lax`;
}

const MOBILE_EQUIVALENT = new Set(["/reports/new", "/history", "/notifications", "/change-password"]);

// Rota da versão completa → equivalente mobile (espelha mobilePathFor do servidor).
export function toMobilePath(pathname: string): string {
  const path = pathname.replace(/^\/expenses/, "");
  if (MOBILE_EQUIVALENT.has(path)) return `/expenses/m${path}`;
  const report = /^\/reports\/(\d+)$/.exec(path);
  return report ? `/expenses/m/reports/${report[1]}` : "/expenses/m";
}

export const isMobilePath = (pathname: string) => pathname === "/expenses/m" || pathname.startsWith("/expenses/m/");
