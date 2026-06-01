/* ============================================================
   PÁGINA PRINCIPAL — BuscaGincho (cliente) — versão premium
   Localização automática + lista simplificada + tracking.
   ============================================================ */

const feed       = document.getElementById('feed');
const loading    = document.getElementById('loading');
const tpl        = document.getElementById('cardTemplate');
const regiaoSel  = document.getElementById('regiaoSelect');
const btnBuscar  = document.getElementById('btnBuscar');
const searchStatus = document.getElementById('searchStatus');

let userPos = null;

function montarCard(p, i) {
  const node = tpl.content.cloneNode(true);

  // avatar + nome -> abre o perfil detalhado do prestador
  node.querySelector('.pc-avatar').href = '/perfil/' + p.id;
  node.querySelector('.avatar').src = p.foto_url ||
    'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nome) + '&background=0A0A0A&color=ffc600&size=200';
  const nome = node.querySelector('.provider-name');
  nome.textContent = p.nome;
  nome.href = '/perfil/' + p.id;

  // meta: avaliação • distância • online
  node.querySelector('.m-rating').textContent = Number(p.avaliacao).toFixed(1).replace('.', ',');
  // distância/ETA amigáveis (demo): mais próximo primeiro
  const km = 3 + i;
  const eta = 8 + i * 2;
  node.querySelector('.m-dist').textContent = km + ' km';
  node.querySelector('.eta strong').textContent = '~' + eta + ' min';

  // bairro
  const bairro = p.bairro || ((p.atendimento_regioes || '').split(',')[0].trim() + ', RJ');
  node.querySelector('.m-bairro').textContent = bairro;

  // ações (tracking via backend)
  node.querySelector('.btn-whats').href = '/chamar/' + p.id;
  node.querySelector('.btn-call').href = '/ligar/' + p.id;

  return node;
}

async function render() {
  loading.style.display = 'block';
  feed.querySelectorAll('.provider-card, .empty').forEach((el) => el.remove());

  const lista = await API.listar({
    lat: userPos?.lat, lng: userPos?.lng, regiao: regiaoSel.value || null,
  });

  loading.style.display = 'none';
  if (!lista.length) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><br>Nenhum guincho encontrado para esta região.';
    feed.appendChild(div);
    return;
  }
  lista.forEach((p, i) => feed.appendChild(montarCard(p, i)));
}

/* ---------- localização automática (sem botão) ---------- */
function autoLocalizar() {
  if (!navigator.geolocation) { searchStatus.innerHTML = '<i class="fa-solid fa-location-dot"></i> Selecione sua região'; return; }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      searchStatus.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Usando sua localização atual';
      render();
    },
    () => { searchStatus.innerHTML = '<i class="fa-solid fa-location-dot"></i> Mostrando todos · selecione sua região'; },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

btnBuscar.addEventListener('click', render);
regiaoSel.addEventListener('change', () => {
  if (regiaoSel.value) searchStatus.innerHTML = '<i class="fa-solid fa-location-dot"></i> ' + regiaoSel.options[regiaoSel.selectedIndex].text;
  render();
});
document.getElementById('verTodos')?.addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('feed').scrollIntoView({ behavior: 'smooth' });
});

/* ---------- menu lateral (hambúrguer) ---------- */
const drawer = document.getElementById('drawer');
const drawerBg = document.getElementById('drawerBg');
function abrirDrawer() { drawer.classList.add('open'); drawerBg.classList.add('open'); document.body.style.overflow = 'hidden'; }
function fecharDrawer() { drawer.classList.remove('open'); drawerBg.classList.remove('open'); document.body.style.overflow = ''; }
document.getElementById('btnMenu').addEventListener('click', abrirDrawer);
document.getElementById('drawerClose').addEventListener('click', fecharDrawer);
drawerBg.addEventListener('click', fecharDrawer);

/* ---------- init ---------- */
render();          // mostra a lista de imediato
autoLocalizar();   // tenta ordenar por proximidade automaticamente
