-- ============================================================
--  Busca Guincho — Storage para upload de fotos de prestadores.
--  Rode no SQL Editor do Supabase (idempotente).
-- ============================================================

-- bucket público chamado "fotos"
INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

-- permitir UPLOAD (insert) e LEITURA (select) das fotos
DROP POLICY IF EXISTS "fotos upload" ON storage.objects;
CREATE POLICY "fotos upload" ON storage.objects
  FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'fotos');

DROP POLICY IF EXISTS "fotos read" ON storage.objects;
CREATE POLICY "fotos read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'fotos');

DROP POLICY IF EXISTS "fotos update" ON storage.objects;
CREATE POLICY "fotos update" ON storage.objects
  FOR UPDATE TO anon, authenticated USING (bucket_id = 'fotos');

-- ⚠️ Protótipo: upload liberado p/ anon. Em produção, restrinja a authenticated.
