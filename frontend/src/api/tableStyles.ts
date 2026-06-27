import { api } from "./client";

export interface TableStyleType {
  key: string;
  label: string;
  hasCustomStyle: boolean;
}

export function listTableStyles() {
  return api<{ types: TableStyleType[] }>("/table-styles");
}

export function resetTableStyle(tableType: string) {
  return api<{ ok: boolean; key: string; hasCustomStyle: boolean }>(
    `/table-styles/${tableType}/reset`,
    { method: "POST" }
  );
}
