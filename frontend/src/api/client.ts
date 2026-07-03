// Cliente HTTP do SPA: usa a MESMA sessão de cookie do admin legado
// (credentials: "include") e injeta o token CSRF do csurf via header X-CSRF-Token.

export const API_BASE = "/admin/api/v2";

let csrfToken: string | null = null;

async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch(`${API_BASE}/csrf-token`, { credentials: "include" });
  if (!res.ok) throw new ApiError(res.status, "Falha ao obter token CSRF");
  const data = (await res.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRF-Token", await fetchCsrfToken());
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include"
  });

  if (res.status === 401) {
    // Sessão de admin ausente/expirada → volta ao login legado.
    window.location.href = "/admin/login";
    throw new ApiError(401, "Não autenticado");
  }
  if (res.status === 403) {
    // Token CSRF pode ter expirado: limpa o cache para a próxima tentativa.
    csrfToken = null;
  }
  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch (_e) {
      /* resposta sem corpo JSON */
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(res.status, "Resposta inesperada do servidor. Faça login novamente e tente outra vez.");
  }
  return (await res.json()) as T;
}
