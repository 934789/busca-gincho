// Simula um DESPACHO chegando pro prestador (pra ver o modal Aceitar/Recusar no painel).
// Coloca o prestador Online e cria um chamado Pendente perto dele -> o trigger despacha.
// Rode:  node _sim_despacho.mjs
import fs from 'node:fs';
const cfg = fs.readFileSync('./js/supabase-config.js', 'utf8');
const URL = cfg.match(/url:\s*'([^']+)'/)[1];
const KEY = cfg.match(/anonKey:\s*'([^']+)'/)[1];
const H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
const api = async (p, o = {}) => { const r = await fetch(URL + '/rest/v1/' + p, { ...o, headers: { ...H, ...(o.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error(p + ' -> ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const pr = await api('prestadores?select=id,nome,latitude,longitude&order=created_at.asc&limit=1');
  const P = pr[0];
  console.log('Prestador:', P.nome);

  // 1) deixa o prestador ONLINE e disponível, posicionado
  await api('prestadores?id=eq.' + P.id, { method: 'PATCH', body: JSON.stringify({
    online: true, status_disponibilidade: 'Online',
    latitude_atual: P.latitude, longitude_atual: P.longitude }) });

  // 2) cria um chamado PENDENTE pertinho dele -> o trigger 'despachar_chamado' notifica
  const PIN = '4321';
  const ch = await api('chamados', { method: 'POST', body: JSON.stringify({
    status: 'Pendente', servico_solicitado: 'Chamar Guincho',
    nome_cliente: 'Mariana Lopes', telefone_cliente: '21997766554', codigo_confirmacao: PIN,
    local_partida_lat: P.latitude + 0.002, local_partida_lng: P.longitude + 0.002,
    local_chegada_lat: -22.9240, local_chegada_lng: -43.2330,
    distancia_estimada_km: 3.1, endereco_destino: 'Oficina Central, Tijuca - RJ' }) });
  const id = ch[0].id;
  console.log('Chamado criado (Pendente). Aguardando o despacho...');

  // 3) confere se virou "Notificando" pro prestador
  for (let i = 0; i < 6; i++) {
    await sleep(1500);
    const c = await api('chamados?id=eq.' + id + '&select=status,prestador_notificado_id');
    if (c[0].status === 'Notificando') {
      console.log('\n✅ DESPACHADO! status=Notificando');
      console.log('   >>> Abra o PAINEL do prestador (logado): aparece o modal Aceitar/Recusar (2 min).');
      console.log('   >>> No "Cheguei ao cliente", digite o PIN do cliente: ' + PIN);
      console.log('   >>> Link do cliente (mostra o PIN ' + PIN + '): http://localhost:5500/rastreio.html?t=' + ch[0].link_token);
      return;
    }
    process.stdout.write('.');
  }
  console.log('\n⚠️ Não virou Notificando. Verifique se o trigger v4_dispatch está ativo e o prestador está Online.');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
