// Simulação PARA LONGE: Alexandre ONLINE em São Paulo, cliente no Rio.
// Testa o preço NOVO (deslocamento guincho->cliente + reboque cliente->destino).
// Rode:  node _sim_longe.mjs
import fs from 'node:fs';
const cfg = fs.readFileSync('./js/supabase-config.js', 'utf8');
const URL = cfg.match(/url:\s*'([^']+)'/)[1];
const KEY = cfg.match(/anonKey:\s*'([^']+)'/)[1];
const H = { 'apikey': KEY, 'Authorization': 'Bearer ' + KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
const api = async (p, o = {}) => { const r = await fetch(URL + '/rest/v1/' + p, { ...o, headers: { ...H, ...(o.headers || {}) } }); const t = await r.text(); if (!r.ok) throw new Error(p + ' -> ' + r.status + ' ' + t); return t ? JSON.parse(t) : null; };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// rota real OSRM (km)
async function rota(a, b) {
  try { const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`); const d = await r.json(); if (d.routes && d.routes[0]) return d.routes[0].distance / 1000; } catch (e) {}
  return null;
}
// preço (igual supabase-config.js): Guincho Leve R$180 saída (10km) + R$8/km
function calc(km, noturno) {
  const taxaSaida = 180, kmExc = 8, franquia = 10;
  let base = taxaSaida; if (km > franquia) base += (km - franquia) * kmExc;
  const mult = noturno ? 1.2 : 1.0;
  const vc = +(base * mult).toFixed(2);
  const co = +((vc * 0.15) + 5).toFixed(2);
  return { vc, co, gan: +(vc - co).toFixed(2), mult };
}

(async () => {
  const pr = await api('prestadores?select=id,nome&order=created_at.asc&limit=1');
  const P = pr[0];
  // 1) Alexandre ONLINE em SÃO PAULO (longe do cliente)
  const SP = { lat: -23.5505, lng: -46.6333 };
  await api('prestadores?id=eq.' + P.id, { method: 'PATCH', body: JSON.stringify({
    online: true, status_disponibilidade: 'Online', ativo: true,
    latitude: SP.lat, longitude: SP.lng, latitude_atual: SP.lat, longitude_atual: SP.lng }) });

  // 2) cliente em Copacabana (RJ), destino na Tijuca (RJ)
  const CLIENTE = { lat: -22.9711, lng: -43.1822 };  // Copacabana
  const DESTINO = { lat: -22.9240, lng: -43.2330 };  // Tijuca

  const desloc = await rota(SP, CLIENTE);   // guincho SP -> cliente RJ (~430 km)
  const reboque = await rota(CLIENTE, DESTINO); // cliente -> destino (~10 km)
  const total = desloc + reboque;
  const h = new Date().getHours(); const noturno = (h >= 22 || h < 6);
  const v = calc(total, noturno);

  console.log('Prestador:', P.nome, '(ONLINE em São Paulo)');
  console.log(`Deslocamento (SP->Copacabana): ${desloc.toFixed(1)} km`);
  console.log(`Reboque (Copacabana->Tijuca):  ${reboque.toFixed(1)} km`);
  console.log(`TOTAL cobrado: ${total.toFixed(1)} km${noturno ? ' (noturno x1.2)' : ''}`);
  console.log(`>>> Cliente paga R$ ${v.vc}  |  comissão R$ ${v.co}  |  prestador ganha R$ ${v.gan}`);
  console.log('   (compare: no modelo antigo seria só o reboque ~10km = R$ 244)');

  const PIN = '4321', PIN_ENTREGA = '8765';
  const ch = await api('chamados', { method: 'POST', body: JSON.stringify({
    status: 'Pendente', servico_solicitado: 'Guincho Leve', categoria_servico: 'guincho_leve',
    nome_cliente: 'Lucas de Barros', telefone_cliente: '21997766554', codigo_confirmacao: PIN, codigo_entrega: PIN_ENTREGA,
    modelo_veiculo: 'Chevrolet Onix prata', placa_veiculo: 'RIO2A45',
    local_partida_lat: CLIENTE.lat, local_partida_lng: CLIENTE.lng,
    local_chegada_lat: DESTINO.lat, local_chegada_lng: DESTINO.lng,
    distancia_estimada_km: +total.toFixed(2), endereco_destino: 'Tijuca, Rio de Janeiro - RJ',
    valor_cliente: v.vc, comissao_plataforma: v.co, ganho_prestador: v.gan, fator_multiplicador: v.mult }) });
  const id = ch[0].id;

  for (let i = 0; i < 6; i++) {
    await sleep(1500);
    const c = await api('chamados?id=eq.' + id + '&select=status');
    if (c[0].status === 'Notificando') {
      console.log('\n✅ DESPACHADO! Abra o painel do Alexandre (logado) p/ Aceitar.');
      console.log('   Link do cliente: http://localhost:5500/rastreio.html?t=' + ch[0].link_token);
      console.log('   PIN retirada: ' + PIN + ' | PIN entrega: ' + PIN_ENTREGA);
      return;
    }
    process.stdout.write('.');
  }
  console.log('\n⚠️ Não virou Notificando (verifique trigger/online).');
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
