-- ============================================================
--  Busca Guincho V4 — Chat em tempo real (cliente <-> prestador)
--  Rode no SQL Editor do Supabase.
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS mensagens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chamado_id UUID REFERENCES chamados(id) ON DELETE CASCADE,
  autor VARCHAR(20) NOT NULL,        -- 'cliente' | 'prestador'
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_chamado ON mensagens(chamado_id, created_at);

-- Realtime
ALTER TABLE mensagens REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;

-- RLS (protótipo: liberado)
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ler mensagens" ON mensagens;
CREATE POLICY "ler mensagens" ON mensagens FOR SELECT USING (true);
DROP POLICY IF EXISTS "criar mensagens" ON mensagens;
CREATE POLICY "criar mensagens" ON mensagens FOR INSERT WITH CHECK (true);
