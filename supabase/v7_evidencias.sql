-- V7 — Evidências por foto (antes/depois) do atendimento
-- Rode no SQL Editor do Supabase.

-- 1) colunas das fotos + código de confirmação do cliente (PIN da retirada)
ALTER TABLE chamados
  ADD COLUMN IF NOT EXISTS foto_antes_url    TEXT,
  ADD COLUMN IF NOT EXISTS foto_depois_url   TEXT,
  ADD COLUMN IF NOT EXISTS codigo_confirmacao VARCHAR(6);

-- RPC: o prestador confirma a retirada digitando o código que o cliente vê na tela.
-- SECURITY DEFINER: valida o código sem expô-lo ao prestador; se bater, marca 'Chegou'.
CREATE OR REPLACE FUNCTION confirmar_retirada(p_chamado uuid, p_codigo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE ok boolean;
BEGIN
  SELECT (codigo_confirmacao = p_codigo) INTO ok FROM chamados WHERE id = p_chamado;
  IF ok THEN UPDATE chamados SET status = 'Chegou' WHERE id = p_chamado; END IF;
  RETURN COALESCE(ok, false);
END; $$;

-- 2) bucket público de evidências
INSERT INTO storage.buckets (id, name, public)
VALUES ('evidencias-chamados', 'evidencias-chamados', true)
ON CONFLICT (id) DO NOTHING;

-- 3) policies de protótipo (anon pode enviar/ler/atualizar só nesse bucket)
DROP POLICY IF EXISTS "evid_insert" ON storage.objects;
DROP POLICY IF EXISTS "evid_select" ON storage.objects;
DROP POLICY IF EXISTS "evid_update" ON storage.objects;
CREATE POLICY "evid_insert" ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'evidencias-chamados');
CREATE POLICY "evid_select" ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'evidencias-chamados');
CREATE POLICY "evid_update" ON storage.objects FOR UPDATE TO anon
  USING (bucket_id = 'evidencias-chamados');
