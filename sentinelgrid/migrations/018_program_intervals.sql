-- Fase 2 (ajuste) — Programa passa a suportar VÁRIOS intervalos de manutenção (em meses).
-- "Gerar Planos" cria um plano por intervalo (ex.: [1, 3, 12] → plano mensal, trimestral, anual).
-- Mantém a coluna `periodicity` (periodicidade base) para compatibilidade com o restante do módulo.

ALTER TABLE sg_maintenance_programs
  ADD COLUMN IF NOT EXISTS plan_intervals_months INTEGER[] NOT NULL DEFAULT '{}';

-- Backfill: programas existentes (não personalizados) ganham o intervalo equivalente à periodicidade.
UPDATE sg_maintenance_programs
   SET plan_intervals_months = ARRAY[CASE periodicity
         WHEN 'mensal' THEN 1
         WHEN 'trimestral' THEN 3
         WHEN 'semestral' THEN 6
         WHEN 'anual' THEN 12
         WHEN 'bienal' THEN 24
         ELSE 0 END]
 WHERE plan_intervals_months = '{}'
   AND periodicity <> 'personalizada';
