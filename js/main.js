/* ============================================================
   HOME — Busca Guincho V4 (Supabase + mapa Leaflet)
   ============================================================ */

const feed    = document.getElementById('feed');
const loading = document.getElementById('loading');
const tpl     = document.getElementById('cardTemplate');
const locSub  = document.getElementById('locSub');

let userPos = null;
let filtroServico = null;

/* ---------- filtros rápidos ---------- */
(function montarFiltros() {
  const wrap = document.getElementById('quickFilters');
  FILTROS_RAPIDOS.forEach((f) => {
    const b = document.createElement('button');
    b.className = 'qf-btn';
    b.innerHTML = `<i class="fa-solid ${f.icon}"></i> ${f.label}`;
    b.addEventListener('click', () => {
      const ativando = filtroServico !== f.key;
      filtroServico = ativando ? f.key : null;
      wrap.querySelectorAll('.qf-btn').forEach((x) => x.classList.remove('on'));
      if (ativando) b.classList.add('on');
      render();
    });
    wrap.appendChild(b);
  });
})();

/* ---------- lista de prestadores ---------- */
function montarCard(p, i) {
  const node = tpl.content.cloneNode(true);
  node.querySelector('.pc-avatar').href = '/perfil/' + p.id;
  node.querySelector('.avatar').src = p.foto_url ||
    'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nome) + '&background=0A0A0A&color=ffdd00&size=200';
  const nome = node.querySelector('.provider-name');
  nome.textContent = p.nome; nome.href = '/perfil/' + p.id;
  node.querySelector('.m-rating').textContent = Number(p.avaliacao || 5).toFixed(1).replace('.', ',');
  const km = 3 + i, eta = 8 + i * 2;
  node.querySelector('.m-dist').textContent = km + ' km';
  node.querySelector('.eta strong').textContent = '~' + eta + ' min';
  node.querySelector('.m-bairro').textContent = p.bairro || ((p.atendimento_regioes || '').split(',')[0].trim() + ', RJ');
  node.querySelector('.btn-call').href = 'tel:+' + String(p.telefone || p.whatsapp).replace(/\D/g, '');
  const whats = node.querySelector('.btn-whats');
  whats.href = 'https://wa.me/' + String(p.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(WHATSAPP_MSG);
  whats.addEventListener('click', () => abrirChamado(p));
  return node;
}

async function abrirChamado(p) {
  if (!sb) return;
  try {
    const { data } = await sb.from('chamados')
      .insert({ prestador_id: p.id, status: 'Pendente', servico_solicitado: 'Contato WhatsApp' })
      .select('id, link_token').single();
    if (data) localStorage.setItem('bg_chamado', JSON.stringify({ id: data.id, token: data.link_token, prestador: p.nome, ts: Date.now() }));
  } catch (e) { console.error(e); }
}

let renderGen = 0;
async function render() {
  const gen = ++renderGen;
  loading.style.display = 'block';
  if (!sb) { loading.style.display = 'none'; limpar(); return; }
  const { data, error } = await sb.from('prestadores').select('*').eq('ativo', true);
  if (gen !== renderGen) return;
  loading.style.display = 'none';
  limpar();
  if (error) { mostrarVazio('Banco indisponível. Rode os SQLs no Supabase.'); console.error(error); return; }

  let lista = (data || []).filter((x) => x.online !== false);
  if (filtroServico) lista = lista.filter((x) => x[filtroServico]);
  if (userPos) {
    lista.forEach((x) => { x._dist = distanciaKm(userPos.lat, userPos.lng, +x.latitude, +x.longitude); });
    lista.sort((a, b) => a._dist - b._dist);
  }
  if (!lista.length) { mostrarVazio('Nenhum guincho disponível nesta região agora.'); return; }
  lista.forEach((p, i) => feed.appendChild(montarCard(p, i)));
}
function limpar() { feed.querySelectorAll('.provider-card, .empty').forEach((el) => el.remove()); }
function mostrarVazio(msg) { const d = document.createElement('div'); d.className = 'empty'; d.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><br>' + msg; feed.appendChild(d); }

/* ============================================================
   MAPA DA HOME (Leaflet) — você + guinchos ao redor (Acompanhamento)
   ============================================================ */
let mapa, cenaLayer = null;
const RJ = { lat: -22.9068, lng: -43.1729 };

function carIcon(deg, size = 40) {
  return L.divIcon({
    className: 'car-divicon',
    html: `<img src="/img/car.png" style="width:${size}px;height:${size}px;display:block;transform:rotate(${deg}deg);filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))">`,
    iconSize: [size, size], iconAnchor: [size/2, size/2],
  });
}
function meuLocalIcon() {
  return L.divIcon({
    className: 'voce-icon',
    html: `<span class="voce-pulse"></span><span class="voce-dot"></span><span class="voce-label">Seu local</span>`,
    iconSize: [0, 0], iconAnchor: [0, 0],
  });
}
function bearing(a, b) {
  const toR = (d)=>d*Math.PI/180, toD=(r)=>r*180/Math.PI;
  const dLon = toR(b.lng - a.lng);
  const y = Math.sin(dLon) * Math.cos(toR(b.lat));
  const x = Math.cos(toR(a.lat))*Math.sin(toR(b.lat)) - Math.sin(toR(a.lat))*Math.cos(toR(b.lat))*Math.cos(dLon);
  return (toD(Math.atan2(y, x)) + 360) % 360;
}

function initHomeMap(lat, lng, acc) {
  if (!mapa) {
    mapa = L.map('homeMap', { zoomControl: false, attributionControl: false }).setView([lat, lng], 16);
    // MapTiler streets-v2 — estilo bem parecido com o Google Maps (gratuito)
    L.tileLayer(`https://api.maptiler.com/maps/${MAPTILER_STYLE}/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`, {
      tileSize: 512, zoomOffset: -1, minZoom: 1, maxZoom: 20, crossOrigin: true,
    }).addTo(mapa);
  }
  desenharCena(lat, lng, acc);
}

function desenharCena(lat, lng, acc) {
  if (cenaLayer) mapa.removeLayer(cenaLayer);
  cenaLayer = L.layerGroup().addTo(mapa);

  // círculo de precisão + seu ponto pulsante
  if (acc) L.circle([lat, lng], { radius: Math.min(acc, 500), color: '#1a73e8', weight: 1, fillColor: '#1a73e8', fillOpacity: .12 }).addTo(cenaLayer);
  L.marker([lat, lng], { icon: meuLocalIcon() }).addTo(cenaLayer);

  // guinchos disponíveis ao redor (decorativo) — SEM rota (a rota só aparece no acompanhar)
  for (let i = 0; i < 6; i++) {
    const fl = lat + (Math.random()-.5)*0.022, fg = lng + (Math.random()-.5)*0.022;
    L.marker([fl, fg], { icon: carIcon(Math.random()*360, 30), interactive: false }).addTo(cenaLayer);
  }

  mapa.setView([lat, lng], 15);
  document.getElementById('etaCard').style.display = 'none';
}

/* ---------- geolocalização ---------- */
const locTitulo = document.getElementById('locTitulo');
async function reverseGeocode(lat, lng) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=pt-BR`);
    const d = await r.json(); const a = d.address || {};
    const cidade = a.city || a.town || a.municipality || a.village || a.suburb || '';
    const uf = (a['ISO3166-2-lvl4'] || '').split('-')[1] || '';
    if (cidade) locTitulo.textContent = cidade + (uf ? ' - ' + uf : '');
  } catch (e) { /* mantém o título padrão */ }
}
function autoLocalizar() {
  initHomeMap(RJ.lat, RJ.lng); // mostra Rio enquanto pede permissão
  if (!navigator.geolocation) { locSub.textContent = 'Selecione sua região'; return; }
  locSub.textContent = 'Localizando você...';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      locSub.textContent = 'Usando sua localização atual';
      initHomeMap(userPos.lat, userPos.lng, pos.coords.accuracy);
      reverseGeocode(userPos.lat, userPos.lng);
      render();
    },
    () => { locSub.textContent = 'Ative a localização para ver guinchos próximos'; },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

/* ---------- controles ---------- */
document.getElementById('btnRecenter').addEventListener('click', () => {
  const p = userPos || RJ; if (mapa) mapa.setView([p.lat, p.lng], 15);
});
document.getElementById('verTodos').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.section-head').scrollIntoView({ behavior: 'smooth' }); });
document.getElementById('bnLista').addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.section-head').scrollIntoView({ behavior: 'smooth' }); });
/* ============================================================
   CHAMAR GUINCHO (fluxo de despacho) — sem valores, só distância
   ============================================================ */
const chamarOverlay = document.getElementById('chamarOverlay');
let destinoSel = null, chamadoAtual = null, canalChamar = null, modoAcompanhar = false, tokenAcompanhar = null;

function abrirChamar() {
  if (!sb) return;
  if (!userPos) { alert('Precisamos da sua localização. Ative o GPS e recarregue a página.'); return; }
  destinoSel = null; chamadoAtual = null; modoAcompanhar = false;
  document.getElementById('chamarDestino').value = '';
  document.getElementById('chamarSugestoes').innerHTML = '';
  document.getElementById('chamarEstimativa').style.display = 'none';
  document.getElementById('btnConfirmarChamado').disabled = true;
  document.getElementById('stepDestino').style.display = 'block';
  document.getElementById('stepProcurando').style.display = 'none';
  document.getElementById('chamarDe').textContent = locTitulo.textContent || 'Sua localização atual';
  const bc = document.getElementById('btnCancelarChamado'); bc.textContent = 'Cancelar'; bc.classList.add('btn-cancelar');
  chamarOverlay.classList.add('open');
}
function fecharChamar() { chamarOverlay.classList.remove('open'); if (canalChamar) { canalChamar.unsubscribe(); canalChamar = null; } }
document.getElementById('bnChamar').addEventListener('click', abrirChamar);
document.getElementById('chamarClose').addEventListener('click', fecharChamar);

/* geocoding do destino (MapTiler) */
let geoTimer;
document.getElementById('chamarDestino').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  destinoSel = null; document.getElementById('chamarEstimativa').style.display = 'none'; document.getElementById('btnConfirmarChamado').disabled = true;
  clearTimeout(geoTimer);
  if (q.length < 3) { document.getElementById('chamarSugestoes').innerHTML = ''; return; }
  geoTimer = setTimeout(() => buscarDestino(q), 400);
});
async function buscarDestino(q) {
  const prox = userPos ? `&proximity=${userPos.lng},${userPos.lat}` : '';
  try {
    const r = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(q)}.json?key=${MAPTILER_KEY}&country=br&language=pt&limit=5${prox}`);
    const d = await r.json();
    const box = document.getElementById('chamarSugestoes');
    box.innerHTML = (d.features || []).map((f, i) => `<button data-i="${i}"><i class="fa-solid fa-location-dot"></i> ${f.place_name || f.text}</button>`).join('');
    box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const f = d.features[+b.dataset.i];
      destinoSel = { lng: f.center[0], lat: f.center[1], nome: f.place_name || f.text };
      document.getElementById('chamarDestino').value = destinoSel.nome;
      box.innerHTML = '';
      const dist = distanciaKm(userPos.lat, userPos.lng, destinoSel.lat, destinoSel.lng);
      document.getElementById('chamarDist').textContent = dist.toFixed(1).replace('.', ',') + ' km';
      document.getElementById('chamarEstimativa').style.display = 'flex';
      document.getElementById('btnConfirmarChamado').disabled = false;
    }));
  } catch (e) { console.error('geocoding:', e); }
}

/* confirmar -> cria chamado (dispara o despacho automático) */
document.getElementById('btnConfirmarChamado').addEventListener('click', async () => {
  if (!destinoSel || !userPos || !sb) return;
  const dist = distanciaKm(userPos.lat, userPos.lng, destinoSel.lat, destinoSel.lng);
  const { data, error } = await sb.from('chamados').insert({
    status: 'Pendente', servico_solicitado: 'Chamar Guincho',
    local_partida_lat: userPos.lat, local_partida_lng: userPos.lng,
    local_chegada_lat: destinoSel.lat, local_chegada_lng: destinoSel.lng,
    distancia_estimada_km: +dist.toFixed(2), endereco_destino: destinoSel.nome,
  }).select('id, link_token').single();
  if (error || !data) { alert('Erro ao criar chamado: ' + (error ? error.message : '')); return; }
  chamadoAtual = data;
  localStorage.setItem('bg_chamado', JSON.stringify({ id: data.id, token: data.link_token, ts: Date.now() }));
  document.getElementById('stepDestino').style.display = 'none';
  document.getElementById('stepProcurando').style.display = 'block';
  document.getElementById('procPrestador').style.display = 'none';
  document.querySelector('.proc-anim').innerHTML = '<i class="fa-solid fa-truck-pickup"></i>';
  document.querySelector('.proc-anim').style.animation = '';
  escutarChamado(data.id, data.link_token);
  setTimeout(() => checarSemPrestador(data.id), 3500);
});

async function checarSemPrestador(id) {
  const { data } = await sb.from('chamados').select('status, prestador_notificado_id').eq('id', id).single();
  if (data && data.status === 'Pendente' && !data.prestador_notificado_id) {
    document.getElementById('procTitulo').textContent = 'Nenhum guincho online agora 😕';
    document.getElementById('procSub').textContent = 'Tente de novo em instantes, ou chame um guincho pela lista.';
    document.querySelector('.proc-anim').style.animation = 'none';
  }
}

function escutarChamado(id, token) {
  if (canalChamar) canalChamar.unsubscribe();
  canalChamar = sb.channel('chamar-' + id).on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'chamados', filter: `id=eq.${id}` },
    async (p) => {
      const st = p.new.status;
      if (st === 'Notificando') {
        document.getElementById('procTitulo').textContent = 'Guincho encontrado! Aguardando confirmação...';
        document.getElementById('procSub').textContent = 'O prestador tem até 2 minutos para aceitar.';
      } else if (st === 'Aceito' || st === 'A Caminho') {
        const pid = p.new.prestador_notificado_id || p.new.prestador_id;
        const { data: pr } = await sb.from('prestadores').select('nome, foto_url').eq('id', pid).single();
        mostrarPrestadorAceito(pr, token);
      } else if (st === 'Pendente') {
        document.getElementById('procTitulo').textContent = 'Procurando outro guincho...';
        document.getElementById('procSub').textContent = 'O anterior não respondeu, chamando o próximo mais próximo.';
      }
    }).subscribe();
}

function mostrarPrestadorAceito(pr, token) {
  modoAcompanhar = true; tokenAcompanhar = token;
  document.getElementById('procTitulo').textContent = 'Guincho a caminho! 🚚';
  document.getElementById('procSub').textContent = 'Acompanhe a chegada em tempo real.';
  document.querySelector('.proc-anim').innerHTML = '<i class="fa-solid fa-circle-check"></i>';
  document.querySelector('.proc-anim').style.animation = 'none';
  const box = document.getElementById('procPrestador');
  box.style.display = 'flex';
  box.innerHTML = `<img src="${(pr && pr.foto_url) || 'https://ui-avatars.com/api/?name=Guincho&background=0A0A0A&color=ffdd00'}">
    <div style="flex:1"><strong>${pr ? pr.nome : 'Prestador'}</strong><small>Aceitou seu chamado</small></div>`;
  const bc = document.getElementById('btnCancelarChamado'); bc.textContent = 'Acompanhar no mapa'; bc.classList.remove('btn-cancelar');
}

document.getElementById('btnCancelarChamado').addEventListener('click', () => {
  if (modoAcompanhar && tokenAcompanhar) { location.href = '/rastreio.html?t=' + tokenAcompanhar; return; }
  if (chamadoAtual && sb) sb.from('chamados').update({ status: 'Recusado' }).eq('id', chamadoAtual.id).then(() => {});
  fecharChamar();
});

/* ---------- menu lateral ---------- */
const drawer = document.getElementById('drawer'), drawerBg = document.getElementById('drawerBg');
document.getElementById('btnMenu').addEventListener('click', () => { drawer.classList.add('open'); drawerBg.classList.add('open'); document.body.style.overflow = 'hidden'; });
document.getElementById('drawerClose').addEventListener('click', fecharDrawer);
drawerBg.addEventListener('click', fecharDrawer);
function fecharDrawer() { drawer.classList.remove('open'); drawerBg.classList.remove('open'); document.body.style.overflow = ''; }

/* ---------- A/B do botão central: padrão B (só ícone); ?fab=a => com texto ---------- */
if (new URLSearchParams(location.search).get('fab') === 'a') document.body.classList.remove('fab-icon-only');

/* ---------- init ---------- */
render();
autoLocalizar();
