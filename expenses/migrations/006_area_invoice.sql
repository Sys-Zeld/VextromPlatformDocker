-- Campos do Formulário de Reembolso (exportação em Excel):
--   ÁREA do colaborador, no cadastro de reembolso;
--   Nº da nota fiscal de cada despesa (opcional).
ALTER TABLE ex_profiles ADD COLUMN area TEXT NOT NULL DEFAULT '';
ALTER TABLE ex_items ADD COLUMN invoice_number TEXT NOT NULL DEFAULT '';
