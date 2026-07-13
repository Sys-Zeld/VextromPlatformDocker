WITH duplicated AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY id) AS rn
  FROM sg_associated_reports
  WHERE external_id <> '' AND deleted_at IS NULL
)
UPDATE sg_associated_reports r SET external_id=''
FROM duplicated d WHERE r.id=d.id AND d.rn>1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sg_associated_reports_external
  ON sg_associated_reports (external_id)
  WHERE external_id <> '' AND deleted_at IS NULL;
