/* ============================================================
   CONFIGURAÇÃO DO SUPABASE — Busca Guincho V2
   Cole aqui a URL e a chave pública (anon) do seu projeto Supabase.
   (Supabase → Settings → API)
   ============================================================ */

const SUPABASE_CONFIG = {
  url:     'COLE_AQUI_SUA_URL',       // ex.: https://abcdefgh.supabase.co
  anonKey: 'COLE_AQUI_SUA_ANON_KEY',  // chave pública (anon / public)
};

// Mensagem padrão do WhatsApp
const WHATSAPP_MSG = 'Olá, estou no Busca Guincho e preciso de suporte próximo à minha localização atual.';

// Cria o client global `sb` se já estiver configurado
let sb = null;
(function () {
  const ok = SUPABASE_CONFIG.url.startsWith('http') && SUPABASE_CONFIG.anonKey.length > 20;
  if (ok && window.supabase) {
    sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  } else {
    console.warn('[Busca Guincho] Supabase ainda não configurado em js/supabase-config.js');
  }
  window.sb = sb;
})();
