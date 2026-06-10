-- V13 — Login Google: liberar o papel 'authenticated' nas tabelas (antes só 'anon')
-- Quando o cliente loga pelo Google, vira 'authenticated' e as policies só de 'anon' bloqueavam.
-- Rode no SQL Editor do Supabase.

-- Recria as permissivas conhecidas como TO public (cobre anon + authenticated)
DROP POLICY IF EXISTS cli_all ON clientes;
CREATE POLICY cli_all ON clientes FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sc_all ON suporte_conversas;
CREATE POLICY sc_all ON suporte_conversas FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sm_all ON suporte_mensagens;
CREATE POLICY sm_all ON suporte_mensagens FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS sq_all ON saques;
CREATE POLICY sq_all ON saques FOR ALL TO public USING (true) WITH CHECK (true);

-- chamados / prestadores / mensagens / avaliacoes: adiciona acesso p/ 'authenticated'
-- (mantém as policies antigas de 'anon'; policies permissivas se somam com OR)
DROP POLICY IF EXISTS auth_all ON chamados;
CREATE POLICY auth_all ON chamados     FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all ON prestadores;
CREATE POLICY auth_all ON prestadores  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all ON mensagens;
CREATE POLICY auth_all ON mensagens    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS auth_all ON avaliacoes;
CREATE POLICY auth_all ON avaliacoes   FOR ALL TO authenticated USING (true) WITH CHECK (true);
