-- V6 — Emissão de Nota Fiscal pelo prestador (selo CNPJ/MEI)
-- Rode no SQL Editor do Supabase.

ALTER TABLE prestadores
  ADD COLUMN IF NOT EXISTS emite_nf BOOLEAN DEFAULT false;

-- O CNPJ usa a coluna 'documento' já existente (CNPJ ou CPF).
-- Quando emite_nf = true, o perfil exibe o selo "CNPJ/MEI".
