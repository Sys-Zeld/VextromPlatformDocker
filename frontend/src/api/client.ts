// Cliente HTTP do SPA: usa sessão por cookie (credentials: "include") e injeta
// o token CSRF do csurf via header X-CSRF-Token.
//
// `createApiClient` permite clientes com base/login próprios — o módulo de
// Despesas tem login independente do hub (ver api/expenses.ts). O cliente
// padrão (`api`, `downloadFile`) continua usando a sessão de admin do hub.

export const API_BASE = "/admin/api/v2";

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ClientOptions {
  base: string;
  /** Endpoint (relativo à base) que devolve { csrfToken }. */
  csrfPath: string;
  /** Para onde mandar o navegador quando a sessão expira (401). */
  loginUrl: string | (() => string);
  /** Paths (relativos à base) cujo 401 NÃO redireciona — ex.: o próprio login. */
  noRedirectPrefixes?: string[];
}

export function createApiClient(opts: ClientOptions) {
  let csrfToken: string | null = null;

  async function fetchCsrfToken(): Promise<string> {
    if (csrfToken) return csrfToken;
    const res = await fetch(`${opts.base}${opts.csrfPath}`, { credentials: "include" });
    if (!res.ok) throw new ApiError(res.status, "Falha ao obter token CSRF");
    const data = (await res.json()) as { csrfToken: string };
    csrfToken = data.csrfToken;
    return csrfToken;
  }

  function redirectToLogin(path: string) {
    if ((opts.noRedirectPrefixes || []).some((p) => path.startsWith(p))) return;
    window.location.href = typeof opts.loginUrl === "function" ? opts.loginUrl() : opts.loginUrl;
  }

  async function readError(res: Response): Promise<ApiError> {
    let message = `Erro ${res.status}`;
    let code: string | null = null;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
      code = body.errorCode || null;
    } catch (_e) {
      /* resposta sem corpo JSON */
    }
    return new ApiError(res.status, message, code);
  }

  async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method || "GET").toUpperCase();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if (method !== "GET" && method !== "HEAD") {
      headers.set("X-CSRF-Token", await fetchCsrfToken());
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }

    const res = await fetch(`${opts.base}${path}`, {
      ...init,
      headers,
      credentials: "include"
    });

    if (res.status === 401) {
      const err = await readError(res);
      redirectToLogin(path);
      throw err;
    }
    if (res.status === 403) {
      // Token CSRF pode ter expirado: limpa o cache para a próxima tentativa.
      csrfToken = null;
    }
    if (!res.ok) throw await readError(res);

    if (res.status === 204) return undefined as T;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new ApiError(res.status, "Resposta inesperada do servidor. Faça login novamente e tente outra vez.");
    }
    return (await res.json()) as T;
  }

  // Baixa um arquivo gerado pela API (XLSX/CSV/PDF). Não usa api() porque aquele
  // helper só aceita JSON; aqui a resposta é binária e vira download no browser.
  async function downloadFile(path: string, fallbackName: string): Promise<void> {
    const res = await fetch(`${opts.base}${path}`, {
      headers: new Headers({ Accept: "*/*" }),
      credentials: "include"
    });

    if (res.status === 401) {
      redirectToLogin(path);
      throw new ApiError(401, "Não autenticado");
    }
    // Erro vem como JSON mesmo quando o formato pedido era binário.
    if (!res.ok) throw await readError(res);

    // Nome sugerido pelo servidor via Content-Disposition; senão o informado.
    const disposition = res.headers.get("content-disposition") || "";
    const match = /filename="?([^"';]+)"?/i.exec(disposition);
    const filename = match ? match[1] : fallbackName;

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      // Revogação adiada: revogar na hora aborta o download em alguns browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    }
  }

  // Após login/logout o token CSRF pode mudar: força buscar de novo.
  function resetCsrf() {
    csrfToken = null;
  }

  return { api, downloadFile, resetCsrf };
}

// Cliente padrão: sessão de admin do hub. Sessão ausente/expirada → login legado.
const platformClient = createApiClient({ base: API_BASE, csrfPath: "/csrf-token", loginUrl: "/admin/login" });

export const api = platformClient.api;
export const downloadFile = platformClient.downloadFile;
