-- ============================================================
--  LIMPAR DADOS DE TESTE — Busca Guincho
--  Apaga chamados, avaliações, mensagens (chat) e fotos de evidência,
--  e zera as médias/disponibilidade dos prestadores.
--  >>> NÃO apaga os prestadores cadastrados. <<<
--  Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) chat de todos os chamados
DELETE FROM mensagens;

-- 2) avaliações (estrelas)
DELETE FROM avaliacoes;

-- 3) chamados (corridas)
DELETE FROM chamados;

-- (As fotos de evidência NÃO podem ser apagadas por SQL — o Supabase bloqueia.
--  Limpe pelo painel: Storage > evidencias-chamados > selecionar tudo > Delete.
--  São inofensivas se ficarem; só ocupam espaço.)

-- 4) zera médias e volta todos os prestadores pra "Online" e topo da fila
UPDATE prestadores SET
  avaliacao = 5.0,
  total_avaliacoes = 0,
  status_disponibilidade = 'Online',
  online = true,
  ultimo_topo_em = timezone('utc', now());

-- ============================================================
-- OPCIONAL — apagar TUDO, inclusive os prestadores cadastrados.
-- Descomente as 2 linhas abaixo só se quiser zerar a base inteira:
-- DELETE FROM prestadores;
-- (depois você recadastra pelo painel admin)
-- ============================================================
