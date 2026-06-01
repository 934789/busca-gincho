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
    // CARTO Voyager — mapa gratuito, legal e limpo (sem chave/cartão), visual estilo Google
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
      subdomains: 'abcd', maxZoom: 20,
    }).addTo(mapa);
  }
  desenharCena(lat, lng, acc);
}

function desenharCena(lat, lng, acc) {
  if (cenaLayer) mapa.removeLayer(cenaLayer);
  cenaLayer = L.layerGroup().addTo(mapa);

  const voce = { lat, lng };
  // círculo de precisão (estilo Google)
  if (acc) L.circle([lat, lng], { radius: Math.min(acc, 500), color: '#1a73e8', weight: 1, fillColor: '#1a73e8', fillOpacity: .12 }).addTo(cenaLayer);
  L.marker([voce.lat, voce.lng], { icon: meuLocalIcon() }).addTo(cenaLayer);

  // guincho "a caminho" (demo) + rota preta até você
  const guincho = { lat: lat + 0.012, lng: lng - 0.015 };
  const meio = { lat: (voce.lat + guincho.lat)/2 + 0.0018, lng: (voce.lng + guincho.lng)/2 - 0.001 };
  const pts = [[guincho.lat, guincho.lng], [meio.lat, meio.lng], [voce.lat, voce.lng]];
  L.polyline(pts, { color: '#fff', weight: 8, opacity: .9, lineCap: 'round', lineJoin: 'round' }).addTo(cenaLayer);
  L.polyline(pts, { color: '#000', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }).addTo(cenaLayer);
  L.marker([guincho.lat, guincho.lng], { icon: carIcon(bearing(guincho, voce), 46) }).addTo(cenaLayer);

  // carrinhos "fake" ao redor pra encher o mapa
  for (let i = 0; i < 6; i++) {
    const fl = lat + (Math.random()-.5)*0.025, fg = lng + (Math.random()-.5)*0.025;
    L.marker([fl, fg], { icon: carIcon(Math.random()*360, 30), interactive: false }).addTo(cenaLayer);
  }

  mapa.fitBounds(L.latLngBounds([[voce.lat, voce.lng], [guincho.lat, guincho.lng]]), { padding: [70, 70], maxZoom: 16 });

  const dist = distanciaKm(voce.lat, voce.lng, guincho.lat, guincho.lng);
  const etaMin = Math.max(2, Math.round(dist * 2.3));
  document.getElementById('etaCard').style.display = 'flex';
  document.getElementById('etaTempo').textContent = etaMin + ' min';
  document.getElementById('etaDist').textContent = dist.toFixed(1).replace('.', ',') + ' km';
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
document.getElementById('bnChamar').addEventListener('click', () => { feed.scrollIntoView({ behavior: 'smooth', block: 'start' }); });

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
