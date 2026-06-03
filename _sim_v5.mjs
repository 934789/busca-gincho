// Simulação V5 — anima um guincho até o cliente e depois até o destino,
// pra ver o rastreio novo (card branco "Indo até <nome>", barra, placa/veículo).
// Requer as colunas da v5_cliente_placa.sql. Rode:  node _sim_v5.mjs
import fs from 'node:fs';

const cfg = fs.readFileSync('./js/supabase-config.js', 'utf8');
const URL = cfg.match(/url:\s*'([^']+)'/)[1];
const KEY = cfg.match(/anonKey:\s*'([^']+)'/)[1];
const H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

const api = async (path, opts = {}) => {
  const r = await fetch(URL + '/rest/v1/' + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const txt = await r.text();
  if (!r.ok) throw new Error(path + ' -> ' + r.status + ' ' + txt);
  return txt ? JSON.parse(txt) : null;
};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Méier (cliente) -> destino (Tijuca). Guincho começa um pouco longe.
const CLIENTE = { lat: -22.9026, lng: -43.2785 };
const GUINCHO = { lat: -22.8890, lng: -43.2660 };
const DESTINO = { lat: -22.9240, lng: -43.2330 };

async function rota(a, b) {
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
  const d = await r.json();
  return d.routes?.[0]?.geometry.coordinates.map(p => ({ lat: p[1], lng: p[0] })) || [a, b];
}

async function mover(token, pts, passos = 18) {
  const step = Math.max(1, Math.floor(pts.length / passos));
  for (let i = 0; i < pts.length; i += step) {
    await api('chamados?link_token=eq.' + token, { method: 'PATCH',
      body: JSON.stringify({ latitude_atual_guincho: pts[i].lat, longitude_atual_guincho: pts[i].lng }) });
    process.stdout.write('.');
    await sleep(1500);
  }
  console.log('');
}

(async () => {
  // 1) primeiro prestador disponível, com placa/veículo, online e posicionado
  const pr = await api("prestadores?select=id,nome&order=created_at.asc&limit=1");
  if (!pr.length) throw new Error('Nenhum prestador cadastrado');
  const PID = pr[0].id;
  console.log('Prestador da simulação:', pr[0].nome);
  await api('prestadores?id=eq.' + PID, { method: 'PATCH', body: JSON.stringify({
    online: true, status_disponibilidade: 'Ocupado',
    placa: 'RIO2A45', veiculo: 'Ford Cargo (Munck)',
    latitude_atual: GUINCHO.lat, longitude_atual: GUINCHO.lng }) });

  // 2) cria o chamado JÁ atribuído ao Marcos (pula o despacho, vai direto pro mapa)
  const ch = await api('chamados', { method: 'POST', body: JSON.stringify({
    status: 'A Caminho', servico_solicitado: 'Chamar Guincho',
    nome_cliente: 'Lethícia Fernandes', telefone_cliente: '21998877665',
    prestador_id: PID,
    local_partida_lat: CLIENTE.lat, local_partida_lng: CLIENTE.lng,
    local_chegada_lat: DESTINO.lat, local_chegada_lng: DESTINO.lng,
    distancia_estimada_km: 4.2, endereco_destino: 'Oficina Tijuca, RJ',
    latitude_atual_guincho: GUINCHO.lat, longitude_atual_guincho: GUINCHO.lng }) });
  const token = ch[0].link_token;

  console.log('\n========================================================');
  console.log(' ABRA O RASTREIO:  http://localhost:5500/rastreio.html?t=' + token);
  console.log('========================================================\n');
  console.log('Abrindo em 6s o trajeto... (deixe a página aberta)');
  await sleep(6000);

  // 3) etapa 1: guincho -> cliente
  console.log('Indo até a cliente (Lethícia)...');
  await mover(token, await rota(GUINCHO, CLIENTE));

  // 4) chegou
  console.log('CHEGOU no cliente.');
  await api('chamados?link_token=eq.' + token, { method: 'PATCH', body: JSON.stringify({ status: 'Chegou' }) });
  await sleep(5000);

  // 5) etapa 2: cliente -> destino
  console.log('Iniciando trajeto ao DESTINO...');
  await api('chamados?link_token=eq.' + token, { method: 'PATCH', body: JSON.stringify({ status: 'Iniciado' }) });
  await sleep(1500);
  await mover(token, await rota(CLIENTE, DESTINO));

  console.log('\n✅ Simulação concluída (chamado deixado em "Iniciado" pra você ver). ');
  console.log('   Pra ver a tela de avaliação, finalize pelo painel do prestador ou rode com FINALIZAR=1.');
  if (process.env.FINALIZAR === '1') {
    await api('chamados?link_token=eq.' + token, { method: 'PATCH', body: JSON.stringify({ status: 'Finalizado' }) });
    console.log('   -> Finalizado.');
  }
  // libera o Marcos
  await api('prestadores?id=eq.' + PID, { method: 'PATCH', body: JSON.stringify({ status_disponibilidade: 'Online' }) });
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
