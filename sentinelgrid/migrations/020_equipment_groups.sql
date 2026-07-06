-- Fase 12 — Grupos de equipamentos por site. Facilita gerar planos para todos os
-- equipamentos do grupo de uma vez. O grupo pertence a um site; os membros são
-- equipamentos daquele site (validação na aplicação).

CREATE TABLE IF NOT EXISTS sg_equipment_groups (
  id          BIGSERIAL PRIMARY KEY,
  site_id     BIGINT NOT NULL REFERENCES sg_sites(id) ON DELETE RESTRICT,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT '',
  updated_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sg_equipment_groups_site_name
  ON sg_equipment_groups (site_id, LOWER(name)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sg_equipment_groups_site
  ON sg_equipment_groups (site_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS sg_equipment_group_members (
  group_id     BIGINT NOT NULL REFERENCES sg_equipment_groups(id) ON DELETE CASCADE,
  equipment_id BIGINT NOT NULL REFERENCES sg_equipment(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, equipment_id)
);
CREATE INDEX IF NOT EXISTS idx_sg_group_members_equipment
  ON sg_equipment_group_members (equipment_id);
