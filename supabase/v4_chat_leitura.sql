-- ============================================================
--  Busca Guincho V4 — Confirmação de leitura no chat (estilo WhatsApp)
--  Rode no SQL Editor do Supabase.
-- ============================================================
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS lida BOOLEAN DEFAULT false;

-- permite marcar como lida (UPDATE)
DROP POLICY IF EXISTS "atualizar mensagens" ON mensagens;
CREATE POLICY "atualizar mensagens" ON mensagens FOR UPDATE USING (true) WITH CHECK (true);

-- (mensagens já está com REPLICA IDENTITY FULL + na publicação do Realtime)
