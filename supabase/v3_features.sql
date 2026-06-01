-- ============================================================
--  Busca Guincho V3 — Comprovante PDF, Faturamento, Online/Offline, Chaveiro
--  Rode TUDO no SQL Editor do Supabase (idempotente).
-- ============================================================

-- CHAMADOS: dados do comprovante + financeiro
ALTER TABLE chamados
  ADD COLUMN IF NOT EXISTS cpf_cliente      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS placa_veiculo    VARCHAR(15),
  ADD COLUMN IF NOT EXISTS modelo_veiculo   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cor_veiculo      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS endereco_origem  TEXT,
  ADD COLUMN IF NOT EXISTS endereco_destino TEXT,
  ADD COLUMN IF NOT EXISTS km_rodados       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS valor_servico    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS forma_pagamento  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS descricao_servico VARCHAR(255);
-- (nome_cliente já existe na tabela chamados)

-- PRESTADORES: dados fiscais p/ o comprovante + status online + chaveiro
ALTER TABLE prestadores
  ADD COLUMN IF NOT EXISTS documento     VARCHAR(30),   -- CNPJ ou CPF
  ADD COLUMN IF NOT EXISTS razao_social  VARCHAR(255),  -- nome da empresa (opcional)
  ADD COLUMN IF NOT EXISTS endereco_base TEXT,
  ADD COLUMN IF NOT EXISTS online        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS chaveiro      BOOLEAN DEFAULT false;

-- garante que prestadores existentes fiquem online por padrão
UPDATE prestadores SET online = true WHERE online IS NULL;
