-- ============================================================
--  Busca Guincho V4 — Rotação circular de prestadores (round-robin)
--  Quem fica no topo muda a cada 20 min, de forma justa.
--  Rode no SQL Editor. (A query da home será ajustada na próxima etapa.)
-- ============================================================

-- 1. coluna de controle de tempo no topo
ALTER TABLE prestadores
  ADD COLUMN IF NOT EXISTS ultimo_topo_em TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- 2. pg_cron (Supabase: habilite a extensão em Database > Extensions, ou aqui)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. função que joga o atual do topo p/ o fim da fila
CREATE OR REPLACE FUNCTION rotar_prestadores_circular_20m()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE prestadores
  SET ultimo_topo_em = timezone('utc'::text, now())
  WHERE id = (SELECT id FROM prestadores WHERE ativo = true AND online = true
              ORDER BY ultimo_topo_em ASC LIMIT 1);
END; $$;

-- 4. agenda a cada 20 minutos
SELECT cron.schedule('rotacao_circular_prestadores', '*/20 * * * *', 'SELECT rotar_prestadores_circular_20m()');

-- Depois, a home ordenará por: .order('ultimo_topo_em', { ascending: true })
-- (quem está há mais tempo sem o topo aparece primeiro). A lista fica ESTÁTICA
-- por sessão e só muda em refresh/reabertura, garantindo justiça sem confundir o cliente.
