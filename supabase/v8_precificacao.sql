-- V8 — Precificação automatizada + split (cliente / plataforma / prestador)
-- Rode no SQL Editor do Supabase.

ALTER TABLE chamados
  ADD COLUMN IF NOT EXISTS valor_cliente        NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS comissao_plataforma  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS ganho_prestador      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS fator_multiplicador  NUMERIC(4,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS categoria_servico    VARCHAR(30);
