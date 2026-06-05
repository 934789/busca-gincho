-- V11 — suporte do Agente de IA: referência do usuário (telefone) p/ o agente localizar o chamado
-- Rode no SQL Editor do Supabase.

ALTER TABLE suporte_conversas ADD COLUMN IF NOT EXISTS user_ref text;
-- user_ref guarda o telefone do cliente (quando o suporte é aberto na tela de rastreio)
-- ou a placa/identificador, para o agente consultar verificar_status_chamado.
