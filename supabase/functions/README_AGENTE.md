# Agente de IA do Suporte (Gemini + Edge Function)

Atende cliente e prestador de forma autônoma, com **function calling** (lê o banco em tempo real)
e **transbordo humano**. Custo zero: usa a **API gratuita do Gemini** + Supabase Edge Functions.

## 1) Pegue a chave gratuita do Gemini
- Acesse **https://aistudio.google.com/app/apikey** → **Create API key** → copie a chave.

## 2) Rode o SQL
No SQL Editor do Supabase, rode **`supabase/v11_suporte_agente.sql`** (adiciona `user_ref`).

## 3) Instale o Supabase CLI (uma vez)
```bash
npm i -g supabase
supabase login
supabase link --project-ref qnfjdvatrtgwxlaakawl
```

## 4) Configure a chave como secret
```bash
supabase secrets set GEMINI_API_KEY=COLE_A_SUA_CHAVE_AQUI
```
> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente nas Edge Functions.

## 5) Deploy da função
```bash
supabase functions deploy suporte-agente --no-verify-jwt
```

## Pronto! Como funciona
- No chat de suporte (cliente/prestador), quando o usuário **digita uma mensagem livre**,
  o front chama `…/functions/v1/suporte-agente`.
- O agente identifica a **persona** (cliente x prestador), responde com o **Gemini** e pode:
  - `verificar_status_chamado` → diz onde o guincho está (usa o telefone salvo em `user_ref`)
  - `verificar_extrato_prestador` → ganhos recentes + saques em análise
  - `acionar_suporte_humano` → muda a conversa para **humano** (cai na fila do admin)
- Os **botões de FAQ** continuam funcionando como atalhos rápidos.
- **Sem deploy?** O chat continua funcionando no modo FAQ + transbordo humano (fallback automático).

## Testar local (opcional)
```bash
supabase functions serve suporte-agente --env-file supabase/.env.local --no-verify-jwt
# .env.local com: GEMINI_API_KEY=...  SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...
```
