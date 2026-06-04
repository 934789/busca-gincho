-- V9 — 2º PIN (entrega) + Chatbot de Suporte híbrido + Carteira/Saques
-- Rode no SQL Editor do Supabase.

-- ====== 2º PIN: confirmação de ENTREGA no destino ======
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS codigo_entrega VARCHAR(6);

CREATE OR REPLACE FUNCTION confirmar_entrega(p_chamado uuid, p_codigo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ok boolean;
BEGIN
  SELECT (codigo_entrega = p_codigo) INTO ok FROM chamados WHERE id = p_chamado;
  RETURN COALESCE(ok, false);
END; $$;

-- ====== SUPORTE (chatbot híbrido FAQ + humano) ======
CREATE TABLE IF NOT EXISTS suporte_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid,
  user_nome text,
  user_tipo text DEFAULT 'cliente',   -- cliente | prestador
  status    text DEFAULT 'bot',       -- bot | humano | resolvido
  created_at timestamptz DEFAULT timezone('utc', now()),
  updated_at timestamptz DEFAULT timezone('utc', now())
);
CREATE TABLE IF NOT EXISTS suporte_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid REFERENCES suporte_conversas(id) ON DELETE CASCADE,
  enviado_por text,                   -- usuario | bot | atendente
  texto text,
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- ====== CARTEIRA / SAQUES do prestador ======
CREATE TABLE IF NOT EXISTS saques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id uuid REFERENCES prestadores(id) ON DELETE CASCADE,
  valor numeric(10,2),
  chave_pix text,
  status text DEFAULT 'Pendente',     -- Pendente | Pago | Recusado
  created_at timestamptz DEFAULT timezone('utc', now())
);

-- ====== RLS (protótipo: anon lê/grava) ======
ALTER TABLE suporte_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE suporte_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE saques            ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sc_all ON suporte_conversas;
DROP POLICY IF EXISTS sm_all ON suporte_mensagens;
DROP POLICY IF EXISTS sq_all ON saques;
CREATE POLICY sc_all ON suporte_conversas FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY sm_all ON suporte_mensagens FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY sq_all ON saques            FOR ALL TO anon USING (true) WITH CHECK (true);

-- ====== REALTIME ======
ALTER TABLE suporte_conversas REPLICA IDENTITY FULL;
ALTER TABLE suporte_mensagens REPLICA IDENTITY FULL;
ALTER TABLE saques            REPLICA IDENTITY FULL;
-- (se já estiverem na publicação, ignore o erro "already member")
ALTER PUBLICATION supabase_realtime ADD TABLE suporte_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE suporte_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE saques;
