-- Documentos técnicos associados ao programa de manutenção.
ALTER TABLE sg_maintenance_programs
  ADD COLUMN IF NOT EXISTS manual_stored_name TEXT,
  ADD COLUMN IF NOT EXISTS manual_original_name TEXT,
  ADD COLUMN IF NOT EXISTS manual_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS manual_file_size BIGINT,
  ADD COLUMN IF NOT EXISTS nameplate_stored_name TEXT,
  ADD COLUMN IF NOT EXISTS nameplate_original_name TEXT,
  ADD COLUMN IF NOT EXISTS nameplate_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS nameplate_file_size BIGINT;
