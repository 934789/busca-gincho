-- ============================================================
--  BUSCA GUINCHO — Versão 2 (Supabase / PostgreSQL)
--  Rode TUDO de uma vez no SQL Editor do Supabase.
--  Cria o schema completo + rastreamento em tempo real + avaliações.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PRESTADORES
-- ============================================================
CREATE TABLE IF NOT EXISTS prestadores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    nome VARCHAR(255) NOT NULL,
    foto_url TEXT,
    banner_url TEXT,
    whatsapp VARCHAR(20) NOT NULL,
    telefone VARCHAR(20),
    bairro VARCHAR(255),
    atendimento_regioes TEXT DEFAULT 'Rio de Janeiro - RJ',
    cnh_verificada BOOLEAN DEFAULT true,
    perfil_verificado BOOLEAN DEFAULT true,
    avaliacao NUMERIC(2,1) DEFAULT 5.0,
    total_avaliacoes INT DEFAULT 0,
    reboque_leve     BOOLEAN DEFAULT false,
    reboque_pesado   BOOLEAN DEFAULT false,
    carga_bateria    BOOLEAN DEFAULT false,
    troca_pneu       BOOLEAN DEFAULT false,
    resgate_veicular BOOLEAN DEFAULT false,
    latitude  NUMERIC(10,8) NOT NULL,
    longitude NUMERIC(11,8) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_provisoria TEXT NOT NULL,
    views INT DEFAULT 0,
    clicks_whatsapp INT DEFAULT 0,
    clicks_ligar INT DEFAULT 0
);

-- ============================================================
-- 2. CHAMADOS (com tracking em tempo real)
-- ============================================================
CREATE TABLE IF NOT EXISTS chamados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    nome_cliente VARCHAR(255),
    bairro_cliente VARCHAR(255),
    servico_solicitado VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Pendente',            -- 'Pendente' | 'A Caminho' | 'Finalizado'
    latitude_atual_guincho  NUMERIC(10,8),
    longitude_atual_guincho NUMERIC(11,8),
    link_token UUID DEFAULT uuid_generate_v4()
);

-- ============================================================
-- 3. AVALIAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS avaliacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    chamado_id   UUID REFERENCES chamados(id) ON DELETE CASCADE,
    nota INT CHECK (nota >= 1 AND nota <= 5) NOT NULL,
    comentario TEXT
);

-- ============================================================
-- 4. TRIGGER: recalcula média de estrelas do prestador
--    (SECURITY DEFINER para atualizar mesmo com RLS ligado)
-- ============================================================
CREATE OR REPLACE FUNCTION atualizar_media_prestador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE prestadores
    SET
        avaliacao = COALESCE((SELECT ROUND(AVG(nota)::numeric, 1) FROM avaliacoes WHERE prestador_id = NEW.prestador_id), 5.0),
        total_avaliacoes = (SELECT COUNT(*) FROM avaliacoes WHERE prestador_id = NEW.prestador_id)
    WHERE id = NEW.prestador_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_atualizar_aval_prestador ON avaliacoes;
CREATE TRIGGER trigger_atualizar_aval_prestador
AFTER INSERT ON avaliacoes
FOR EACH ROW
EXECUTE FUNCTION atualizar_media_prestador();

-- ============================================================
-- 5. REALTIME: o mapa do cliente escuta a tabela de chamados
-- ============================================================
ALTER TABLE chamados REPLICA IDENTITY FULL;   -- garante todas as colunas no payload
ALTER PUBLICATION supabase_realtime ADD TABLE chamados;

-- ============================================================
-- 6. RLS (Row Level Security)
--    Padrão deste protótipo (app 100% no navegador, sem backend).
--    Em produção, restrinja UPDATE de chamados a usuários autenticados.
-- ============================================================
ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados    ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes  ENABLE ROW LEVEL SECURITY;

-- Público lê só prestadores ativos
CREATE POLICY "ler prestadores ativos" ON prestadores
  FOR SELECT USING (ativo = true);
-- Protótipo: permite o prestador editar o perfil e o admin gerenciar.
-- ⚠️ Em produção, restrinja a usuários autenticados (Supabase Auth).
CREATE POLICY "gerenciar prestador insert" ON prestadores FOR INSERT WITH CHECK (true);
CREATE POLICY "gerenciar prestador update" ON prestadores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "gerenciar prestador delete" ON prestadores FOR DELETE USING (true);

-- Cliente cria chamado (clique no WhatsApp)
CREATE POLICY "criar chamado" ON chamados
  FOR INSERT WITH CHECK (true);
-- Cliente/motorista leem o chamado (necessário p/ o Realtime do rastreio)
CREATE POLICY "ler chamado" ON chamados
  FOR SELECT USING (true);
-- Motorista atualiza posição/status do chamado
CREATE POLICY "atualizar chamado" ON chamados
  FOR UPDATE USING (true) WITH CHECK (true);

-- Cliente envia avaliação
CREATE POLICY "criar avaliacao" ON avaliacoes
  FOR INSERT WITH CHECK (true);

-- ============================================================
-- 7. DADOS DE EXEMPLO (senha em texto só p/ teste — troque depois)
-- ============================================================
INSERT INTO prestadores (nome, whatsapp, telefone, bairro, atendimento_regioes, latitude, longitude,
                         reboque_leve, reboque_pesado, carga_bateria, troca_pneu, resgate_veicular,
                         email, senha_provisoria, avaliacao, total_avaliacoes)
VALUES
('Marcos Pereira','5521991112233','552127778888','Barra da Tijuca, RJ','Zona Oeste, Barra, Recreio e Jacarepaguá',-23.0045,-43.3650, true,false,true,true,false,  'marcos@buscagincho.com','troque123',5.0,0),
('Alexandre Silva','5521983456789','552133334444','Méier, RJ','Zona Norte, Méier, Tijuca e Madureira',-22.9068,-43.2096, true,true,true,true,true,   'alexandre@buscagincho.com','troque123',5.0,0),
('Rodrigo Costa','5521974561122','552122220000','Centro, RJ','Centro, Lapa, Glória e Flamengo',-22.9519,-43.1822, true,true,true,true,true,        'rodrigo@buscagincho.com','troque123',5.0,0)
ON CONFLICT (email) DO NOTHING;
