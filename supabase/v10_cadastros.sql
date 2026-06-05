-- V10 — Cadastro de Parceiro (análise + docs/selfie) + Conta de Cliente + dados do veículo
-- Rode no SQL Editor do Supabase.

-- ====== PRESTADOR: status do cadastro + documentos/selfie ======
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS status_cadastro text DEFAULT 'aprovado'; -- em_analise | aprovado | recusado
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS selfie_url text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS doc_cnh_url text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS doc_crlv_url text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS doc_identidade_url text;
ALTER TABLE prestadores ADD COLUMN IF NOT EXISTS motivo_recusa text;
-- prestadores já existentes continuam 'aprovado' (default). Cadastros novos entram 'em_analise' + ativo=false.

-- ====== CONTA DE CLIENTE (cadastro após o 1º chamado, na avaliação) ======
CREATE TABLE IF NOT EXISTS clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text,
  telefone text UNIQUE,
  email text,
  cpf text,
  senha text,
  endereco_casa text,
  endereco_trabalho text,
  created_at timestamptz DEFAULT timezone('utc', now())
);
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cli_all ON clientes;
CREATE POLICY cli_all ON clientes FOR ALL TO anon USING (true) WITH CHECK (true);

-- vincular chamado a um cliente cadastrado (opcional)
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id);

-- ====== BUCKET de documentos do prestador ======
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-prestadores', 'documentos-prestadores', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS docp_read  ON storage.objects;
DROP POLICY IF EXISTS docp_write ON storage.objects;
CREATE POLICY docp_read  ON storage.objects FOR SELECT TO anon USING (bucket_id = 'documentos-prestadores');
CREATE POLICY docp_write ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'documentos-prestadores');
