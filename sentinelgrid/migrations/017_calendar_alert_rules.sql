-- Fase 10 · Fatia 10.2 — Regras de vencimento configuráveis do Mapa Calendário (§8/A.9).
-- Uma linha por criticidade do equipamento. `first_alert_days` = janela do 1º alerta
-- (amarelo/próxima); `critical_alert_days` = janela do alerta crítico (laranja/vermelho).
-- `critical_after_due` = TRUE quando o alerta crítico só vale após o vencimento
-- (caso "após vencimento" da criticidade baixa).

CREATE TABLE IF NOT EXISTS sg_calendar_alert_rules (
  criticality         TEXT PRIMARY KEY,
  first_alert_days    INTEGER NOT NULL DEFAULT 30,
  critical_alert_days INTEGER NOT NULL DEFAULT 7,
  critical_after_due  BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by          TEXT NOT NULL DEFAULT '',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed com os defaults do prompt (§8). ON CONFLICT DO NOTHING preserva ajustes futuros.
INSERT INTO sg_calendar_alert_rules (criticality, first_alert_days, critical_alert_days, critical_after_due) VALUES
  ('baixa',          15,  0, TRUE),
  ('media',          30,  7, FALSE),
  ('alta',           45, 15, FALSE),
  ('missao_critica', 60, 30, FALSE)
ON CONFLICT (criticality) DO NOTHING;
