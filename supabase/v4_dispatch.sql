-- ============================================================
--  Busca Guincho V4 — Bloco 3: Despacho automático (estilo Uber)
--  Fundação no banco. Rode no SQL Editor do Supabase.
--  NÃO usa PostGIS (distância via Haversine puro).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- pg_cron: se este CREATE falhar, habilite em Database > Extensions > pg_cron e rode de novo.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1) PRESTADORES: localização ao vivo + disponibilidade de plantão
ALTER TABLE prestadores
  ADD COLUMN IF NOT EXISTS latitude_atual  NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS longitude_atual NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS status_disponibilidade VARCHAR(20) DEFAULT 'Offline'; -- Offline | Online | Ocupado

-- 2) CHAMADOS: campos do fluxo de despacho
ALTER TABLE chamados
  ADD COLUMN IF NOT EXISTS prestador_notificado_id   UUID REFERENCES prestadores(id),
  ADD COLUMN IF NOT EXISTS tempo_notificacao_enviada TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS prestadores_recusaram     UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS local_partida_lat  NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS local_partida_lng  NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS local_chegada_lat  NUMERIC(10,8),
  ADD COLUMN IF NOT EXISTS local_chegada_lng  NUMERIC(11,8),
  ADD COLUMN IF NOT EXISTS valor_estimado     NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS distancia_estimada_km NUMERIC(10,2);
-- Estados do status: Pendente | Notificando | Aceito | A Caminho | Chegou | Iniciado | Finalizado | Recusado | Expirado

-- 3) FUNÇÃO: despacha o chamado p/ o prestador Online mais próximo (Haversine)
CREATE OR REPLACE FUNCTION despachar_chamado()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_id UUID;
BEGIN
  IF NEW.status = 'Pendente' AND NEW.prestador_notificado_id IS NULL AND NEW.local_partida_lat IS NOT NULL THEN
    SELECT id INTO v_id FROM prestadores
    WHERE status_disponibilidade = 'Online' AND ativo = true AND online = true
      AND latitude_atual IS NOT NULL AND longitude_atual IS NOT NULL
      AND id <> ALL (COALESCE(NEW.prestadores_recusaram, '{}'))
    ORDER BY (
      6371 * acos( greatest(-1, least(1,
        cos(radians(NEW.local_partida_lat)) * cos(radians(latitude_atual)) *
        cos(radians(longitude_atual) - radians(NEW.local_partida_lng)) +
        sin(radians(NEW.local_partida_lat)) * sin(radians(latitude_atual))
      )))
    ) ASC
    LIMIT 1;

    IF v_id IS NOT NULL THEN
      UPDATE chamados
      SET prestador_notificado_id = v_id,
          tempo_notificacao_enviada = timezone('utc'::text, now()),
          status = 'Notificando'
      WHERE id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

-- dispara na criação E quando o status volta p/ 'Pendente' (recusa/timeout re-despacham o próximo)
DROP TRIGGER IF EXISTS trigger_despacho ON chamados;
CREATE TRIGGER trigger_despacho
AFTER INSERT OR UPDATE OF status ON chamados
FOR EACH ROW EXECUTE FUNCTION despachar_chamado();

-- 4) FUNÇÃO: timeout de 2 min — quem foi notificado e não respondeu vai pro fim da fila
CREATE OR REPLACE FUNCTION lidar_com_timeouts_despacho()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE chamados
  SET prestadores_recusaram = array_append(prestadores_recusaram, prestador_notificado_id),
      status = 'Pendente',
      prestador_notificado_id = NULL,
      tempo_notificacao_enviada = NULL
  WHERE status = 'Notificando'
    AND tempo_notificacao_enviada < timezone('utc'::text, now()) - INTERVAL '2 minutes';
END; $$;

-- agenda a cada 1 minuto
SELECT cron.schedule('timeout_despacho_1m', '*/1 * * * *', 'SELECT lidar_com_timeouts_despacho()');

-- 5) garante o Realtime na tabela (já deve estar, mas reforça)
ALTER TABLE chamados REPLICA IDENTITY FULL;
-- (se a publicação já tiver a tabela, ignore o erro abaixo)
-- ALTER PUBLICATION supabase_realtime ADD TABLE chamados;

-- ⚠️ Protótipo: políticas RLS permissivas já cobrem insert/update/select de chamados.
