/* ============================================================
   CONFIGURAÇÃO DO SUPABASE — Busca Guincho V2
   Apenas a chave PÚBLICA (anon) — segura para o front-end.
   NUNCA coloque aqui a service_role nem a secret key.
   ============================================================ */

const SUPABASE_CONFIG = {
  url:     'https://qnfjdvatrtgwxlaakawl.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFuZmpkdmF0cnRnd3hsYWFrYXdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNzYzOTQsImV4cCI6MjA5NTg1MjM5NH0.CiQdEoYhH190Iat8gzrNBcsgOkzh8YUVkf-buxtcv-Y',
};

// Mensagem padrão do WhatsApp
const WHATSAPP_MSG = 'Olá, estou no Busca Guincho e preciso de suporte próximo à minha localização atual.';

// WhatsApp do SUPORTE BuscaGuincho (botão "Ajuda" na tela de acompanhamento).
// >>> TROQUE pelo número real do suporte (formato 55 + DDD + número, só dígitos) <<<
window.SUPORTE_WHATSAPP = '5521964338046';
const SUPORTE_MSG = 'Olá, suporte BuscaGuincho! Preciso de ajuda com meu atendimento.';

// Chave do MapTiler (mapa estilo Google, gratuito). Restrinja por domínio no painel do MapTiler.
const MAPTILER_KEY = 'yxBCmp6NSGE3ej2Ylqix';
const MAPTILER_STYLE = 'dataviz'; // clarinho/minimalista estilo Uber (alterne p/ 'positron' se quiser)

// URL pública do SITE DO CLIENTE (onde fica o rastreio.html).
// Deixe '' quando o painel do prestador está no MESMO domínio do site.
// Quando o painel do prestador estiver num SUBDOMÍNIO separado, coloque aqui
// a URL do site principal, ex.: 'https://buscaguincho.com.br'
window.SITE_CLIENTE = '';

// Cria o client global `sb`
let sb = null;
(function () {
  const ok = SUPABASE_CONFIG.url.startsWith('http') && SUPABASE_CONFIG.anonKey.length > 20;
  if (ok && window.supabase) {
    sb = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  } else {
    console.warn('[Busca Guincho] Supabase não carregado.');
  }
  window.sb = sb;
})();

/* ---------- catálogo de serviços (compartilhado) ---------- */
const SERVICOS = [
  { key: 'reboque_leve',     label: 'Reboque Leve',          icon: 'fa-truck-pickup' },
  { key: 'reboque_pesado',   label: 'Reboque Pesado',        icon: 'fa-truck-moving' },
  { key: 'carga_bateria',    label: 'Carga de Bateria',      icon: 'fa-car-battery' },
  { key: 'troca_pneu',       label: 'Auxílio Troca de pneu', icon: 'fa-gear' },
  { key: 'resgate_veicular', label: 'Resgate Veicular',      icon: 'fa-triangle-exclamation' },
  { key: 'chaveiro',         label: 'Chaveiro',              icon: 'fa-key' },
];

// filtros rápidos da home (pane do cliente -> coluna de serviço)
const FILTROS_RAPIDOS = [
  { key: 'carga_bateria', label: 'Bateria acabou', icon: 'fa-car-battery' },
  { key: 'reboque_leve',  label: 'Carro quebrou',  icon: 'fa-car-burst' },
  { key: 'troca_pneu',    label: 'Pneu furou',     icon: 'fa-life-ring' },
  { key: 'chaveiro',      label: 'Chave trancada', icon: 'fa-key' },
];

/* ---------- utilidades compartilhadas ---------- */
function formatWhats(num) {
  const n = String(num).replace(/\D/g, '');
  const ddd = n.slice(2, 4), corpo = n.slice(4);
  if (corpo.length === 9) return `(${ddd}) ${corpo.slice(0,5)}-${corpo.slice(5)}`;
  return `(${ddd}) ${corpo.slice(0,4)}-${corpo.slice(4)}`;
}
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = (d) => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
