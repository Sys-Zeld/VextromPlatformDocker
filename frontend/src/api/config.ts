import { api } from "./client";

export interface ReportConfig {
  logoVextrom: string;
  logoChloride: string;
  logoCover: string;
  templateKey: string;
  footerHtml: string;
  defaultScopeHtml: string;
  defaultRecommendationsHtml: string;
}

export function getConfig() {
  return api<ReportConfig>("/config");
}

export function saveConfig(input: ReportConfig) {
  return api<ReportConfig>("/config", { method: "PUT", body: JSON.stringify(input) });
}
