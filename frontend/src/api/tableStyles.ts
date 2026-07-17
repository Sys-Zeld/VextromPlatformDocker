import { api } from "./client";

export interface TableStyleType {
  key: string;
  label: string;
  hasCustomStyle: boolean;
}

export interface TableStyleConfig {
  customCss?: string;
}

export interface TableStylePreviewResult {
  previewHtml: string;
  styleConfig: TableStyleConfig | null;
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

export function resetTableStylePreview(tableType: string) {
  return api<TableStylePreviewResult>(
    `/table-styles/${tableType}/style-reset`,
    { method: "POST" }
  );
}

export function updateTableStyle(
  tableType: string,
  input: { instruction?: string; currentStyle?: TableStyleConfig | null; apply?: boolean } = {}
) {
  return api<TableStylePreviewResult>(`/table-styles/${tableType}/style-ai`, {
    method: "POST",
    body: JSON.stringify({
      instruction: input.instruction || "",
      current_style: input.currentStyle ? JSON.stringify(input.currentStyle) : "",
      apply: input.apply === true
    })
  });
}
