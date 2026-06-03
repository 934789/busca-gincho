-- V5 — telefone do cliente no chamado + placa do guincho do prestador
-- Rode no SQL Editor do Supabase.

-- telefone do cliente (preenchido na home ao chamar)
ALTER TABLE chamados
  ADD COLUMN IF NOT EXISTS telefone_cliente VARCHAR(30);

-- placa + modelo do veículo (guincho) do prestador — exibidos ao cliente no rastreio
ALTER TABLE prestadores
  ADD COLUMN IF NOT EXISTS placa   VARCHAR(15),
  ADD COLUMN IF NOT EXISTS veiculo VARCHAR(80);

-- (nome_cliente já existe em chamados desde a v2)
