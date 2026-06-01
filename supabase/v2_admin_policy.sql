-- ============================================================
--  Busca Guincho — Policies para o painel ADMIN + avaliações.
--  Rode TUDO no SQL Editor do Supabase (é idempotente).
-- ============================================================

-- 1) PRESTADORES: leitura ampla (admin vê inclusive os ocultos).
--    O público continua vendo só ativos porque o app filtra ativo=true.
DROP POLICY IF EXISTS "ler prestadores ativos" ON prestadores;
DROP POLICY IF EXISTS "ler prestadores" ON prestadores;
CREATE POLICY "ler prestadores" ON prestadores FOR SELECT USING (true);

-- 2) PRESTADORES: escrita (cadastrar / editar / excluir / ativar-ocultar).
DROP POLICY IF EXISTS "gerenciar prestador insert" ON prestadores;
CREATE POLICY "gerenciar prestador insert" ON prestadores FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "gerenciar prestador update" ON prestadores;
CREATE POLICY "gerenciar prestador update" ON prestadores FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "gerenciar prestador delete" ON prestadores;
CREATE POLICY "gerenciar prestador delete" ON prestadores FOR DELETE USING (true);

-- 3) AVALIAÇÕES: leitura pública (mostrar estrelas/comentários no perfil).
DROP POLICY IF EXISTS "ler avaliacoes" ON avaliacoes;
CREATE POLICY "ler avaliacoes" ON avaliacoes FOR SELECT USING (true);

-- ⚠️ PRODUÇÃO: estas policies são permissivas (acesso via anon key) por ser
-- protótipo. Antes de lançar, troque a escrita por Supabase Auth (usuário admin)
-- e restrinja a auth.role() = 'authenticated'. Posso implementar quando quiser.
