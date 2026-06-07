-- V12 — foto de perfil do cliente (página Minha Conta)
-- Rode no SQL Editor do Supabase.
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS foto_url text;
