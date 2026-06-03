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

/* ===================== PRECIFICAÇÃO + SPLIT =====================
   Tabelas baseadas em pesquisa de mercado (assistência 24h / reboque RJ).
   Franquia de 10 km inclusos na taxa de saída; KM excedente cobrado à parte.
   Plataforma: 15% de comissão + R$ 5,00 fixo por corrida. */
const PRECO_CATEGORIAS = {
  guincho_leve:   { label: 'Guincho Leve',     icon: 'fa-truck-pickup', taxaSaida: 150.00, kmExcedente: 7.00,  fixo: false },
  guincho_pesado: { label: 'Guincho Pesado',   icon: 'fa-truck-moving', taxaSaida: 250.00, kmExcedente: 12.00, fixo: false },
  troca_pneu:     { label: 'Troca de Pneu',    icon: 'fa-life-ring',    taxaSaida: 80.00,  kmExcedente: 0,     fixo: true  },
  carga_bateria:  { label: 'Carga de Bateria', icon: 'fa-car-battery',  taxaSaida: 140.00, kmExcedente: 0,     fixo: true  },
};
const FRANQUIA_KM = 10;
const PLATAFORMA_COMISSAO = 0.15;   // 15%
const PLATAFORMA_TAXA_FIXA = 5.00;  // R$ por corrida

function calcularValoresChamado(distanciaTotalKm, categoria, condicoes = {}) {
  const cat = PRECO_CATEGORIAS[categoria] || PRECO_CATEGORIAS.guincho_leve;
  // A) preço base por categoria
  let precoBase = cat.taxaSaida;
  if (!cat.fixo && distanciaTotalKm > FRANQUIA_KM) {
    precoBase += (distanciaTotalKm - FRANQUIA_KM) * cat.kmExcedente;
  }
  // B) precificação dinâmica (multiplicador)
  let multiplicador = 1.0;
  if (condicoes.ehHorarioNoturno) multiplicador += 0.2;  // 22h–06h
  if (condicoes.ehChuvaForte)     multiplicador += 0.3;  // alerta de chuva forte
  if (condicoes.ehZonaAlagamento) multiplicador += 0.5;  // zona crítica de alagamento
  // C) valor do cliente
  const valorCliente = parseFloat((precoBase * multiplicador).toFixed(2));
  // D) split plataforma x prestador (15% + R$5 fixo)
  const comissaoPlataforma = parseFloat(((valorCliente * PLATAFORMA_COMISSAO) + PLATAFORMA_TAXA_FIXA).toFixed(2));
  const ganhoPrestador = parseFloat((valorCliente - comissaoPlataforma).toFixed(2));
  return {
    valor_cliente: valorCliente,
    comissao_plataforma: comissaoPlataforma,
    ganho_prestador: ganhoPrestador,
    fator_multiplicador: parseFloat(multiplicador.toFixed(2)),
  };
}
// condições automáticas (horário). Clima/alagamento ficam como hooks (false por padrão).
function condicoesAtuais() {
  const h = new Date().getHours();
  return { ehHorarioNoturno: (h >= 22 || h < 6), ehChuvaForte: false, ehZonaAlagamento: false };
}
const fmtBRL = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

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
