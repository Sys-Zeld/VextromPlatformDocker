import { useQuery } from "@tanstack/react-query";
import { api } from "./client";

export interface SessionInfo {
  authenticated: boolean;
  username: string | null;
  role: string | null;
  roleLabel: string | null;
  capabilities: string[];
  lang: string;
}

/** Capacidades usadas pela UI. O espelho autoritativo está em specflow/services/accessControl.js. */
export const CAP = {
  SYSTEM_MANAGE: "system:manage",
  RECORDS_READ: "records:read",
  RECORDS_WRITE: "records:write",
  RECORDS_DELETE: "records:delete",
  ORDERS_READ: "orders:read",
  ORDERS_EDIT: "orders:edit",
  ORDERS_CREATE: "orders:create",
  ORDERS_DELETE: "orders:delete",
  SENTINELGRID_READ: "sentinelgrid:read",
  SENTINELGRID_WRITE: "sentinelgrid:write"
} as const;

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: () => api<SessionInfo>("/session") });
}

/**
 * Esconder botões que o perfil não pode usar é conveniência de UI — quem barra
 * de verdade é o servidor. Enquanto a sessão carrega, `can` devolve false, para
 * não exibir uma ação e retirá-la em seguida.
 */
export function useCan() {
  const { data } = useSession();
  const granted = new Set(data?.capabilities ?? []);
  return (capability: string) => granted.has(capability);
}
