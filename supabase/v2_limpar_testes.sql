-- ============================================================
--  Limpa os dados de TESTE (chamados/avaliações) e zera as médias.
--  Rode UMA vez no SQL Editor. NÃO apaga os prestadores.
-- ============================================================
DELETE FROM avaliacoes;
DELETE FROM chamados;
UPDATE prestadores SET avaliacao = 5.0, total_avaliacoes = 0;
