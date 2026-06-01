-- ============================================================
--  BuscaGincho — Schema do banco (Supabase / PostgreSQL)
--  Rode no SQL Editor do painel do Supabase.
-- ============================================================

-- 1. Extensões de geolocalização (opcional p/ RPC por proximidade)
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance CASCADE;

-- 2. Prestadores de serviço
CREATE TABLE IF NOT EXISTS prestadores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    nome VARCHAR(255) NOT NULL,
    foto_url TEXT,
    banner_url TEXT,
    whatsapp VARCHAR(20) NOT NULL,
    telefone VARCHAR(20),
    atendimento_regioes TEXT DEFAULT 'Centro, Zona Sul, Zona Norte, Barra e Região',
    cnh_verificada BOOLEAN DEFAULT true,
    perfil_verificado BOOLEAN DEFAULT true,
    avaliacao FLOAT DEFAULT 5.0,
    total_avaliacoes INT DEFAULT 1,

    -- Categorias de serviços (filtros rápidos)
    reboque_leve     BOOLEAN DEFAULT false,
    reboque_pesado   BOOLEAN DEFAULT false,
    carga_bateria    BOOLEAN DEFAULT false,
    troca_pneu       BOOLEAN DEFAULT false,
    resgate_veicular BOOLEAN DEFAULT false,

    -- Coordenadas da base do guincho
    latitude  NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,

    -- Controle de mensalidade: visível ao público somente se ativo = true
    ativo BOOLEAN DEFAULT true,

    -- Autenticação simples gerada pelo admin
    email VARCHAR(255) UNIQUE NOT NULL,
    senha_provisoria TEXT NOT NULL
);

-- 3. Chamados (registro de cliques no WhatsApp / métricas)
CREATE TABLE IF NOT EXISTS chamados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    prestador_id UUID REFERENCES prestadores(id) ON DELETE CASCADE,
    nome_cliente VARCHAR(255),
    bairro_cliente VARCHAR(255),
    servico_solicitado VARCHAR(100),
    status VARCHAR(50) DEFAULT 'Pendente'  -- Pendente | Aceito | Finalizado
);

-- ============================================================
--  RLS (Row Level Security) — recomendado para produção
-- ============================================================
ALTER TABLE prestadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados    ENABLE ROW LEVEL SECURITY;

-- Público pode LER apenas prestadores ativos
CREATE POLICY "ler prestadores ativos"
  ON prestadores FOR SELECT
  USING (ativo = true);

-- Público pode INSERIR chamados (clique no WhatsApp)
CREATE POLICY "inserir chamados"
  ON chamados FOR INSERT
  WITH CHECK (true);

-- OBS.: As operações de cadastro/edição/bloqueio (UPDATE/INSERT em prestadores,
-- UPDATE em chamados) devem ser feitas por usuários autenticados (Supabase Auth)
-- ou via service_role no backend do admin. Para o protótipo em DEMO_MODE,
-- nada disso é necessário.

-- ============================================================
--  (Opcional) RPC de proximidade no servidor — alternativa ao
--  cálculo Haversine feito no front-end.
-- ============================================================
CREATE OR REPLACE FUNCTION prestadores_proximos(lat double precision, lng double precision)
RETURNS SETOF prestadores
LANGUAGE sql STABLE AS $$
  SELECT *
  FROM prestadores
  WHERE ativo = true
  ORDER BY point(longitude, latitude) <@> point(lng, lat) ASC;
$$;

-- ============================================================
--  Dados de exemplo (Rio de Janeiro)
-- ============================================================
INSERT INTO prestadores (nome, whatsapp, telefone, latitude, longitude, email, senha_provisoria,
                         reboque_leve, reboque_pesado, carga_bateria, troca_pneu, resgate_veicular,
                         avaliacao, total_avaliacoes)
VALUES
('Alexandre Silva', '5521987654321', '552133334444', -22.9068, -43.1729, 'alexandre@buscagincho.com', 'troque123',
 true, true, true, true, true, 5.0, 48);
