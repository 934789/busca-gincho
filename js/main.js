/* ============================================================
   HOME — Busca Guincho V2 (Supabase)
   Lista prestadores do Supabase + cria chamado no clique do WhatsApp.
   ============================================================ */

const feed       = document.getElementById('feed');
const loading    = document.getElementById('loading');
const tpl        = document.getElementById('cardTemplate');
const regiaoSel  = document.getElementById('regiaoSelect');
const btnBuscar  = document.getElementById('btnBuscar');
const searchStatus = document.getElementById('searchStatus');

let userPos = null;
let filtroServico = null; // filtro rápido ativo (coluna de serviço)

/* ---------- filtros rápidos (tipo de pane) ---------- */
(function montarFiltros() {
  const wrap = document.getElementById('quickFilters');
  if (!wrap) return;
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

function montarCard(p, i) {
  const node = tpl.content.cloneNode(true);

  // avatar + nome -> perfil
  node.querySelector('.pc-avatar').href = '/perfil/' + p.id;
  node.querySelector('.avatar').src = p.foto_url ||
    'https://ui-avatars.com/api/?name=' + encodeURIComponent(p.nome) + '&background=0A0A0A&color=ffc600&size=200';
  const nome = node.querySelector('.provider-name');
  nome.textContent = p.nome;
  nome.href = '/perfil/' + p.id;

  // meta
  node.querySelector('.m-rating').textContent = Number(p.avaliacao).toFixed(1).replace('.', ',');
  const km = 3 + i, eta = 8 + i * 2;
  node.querySelector('.m-dist').textContent = km + ' km';
  node.querySelector('.eta strong').textContent = '~' + eta + ' min';
  node.querySelector('.m-bairro').textContent = p.bairro || ((p.atendimento_regioes || '').split(',')[0].trim() + ', RJ');

  // ação Ligar (tel direto)
  node.querySelector('.btn-call').href = 'tel:+' + String(p.telefone || p.whatsapp).replace(/\D/g, '');

  // ação WhatsApp: cria chamado 'Pendente' (silencioso) + abre wa.me
  const whats = node.querySelector('.btn-whats');
  whats.href = 'https://wa.me/' + String(p.whatsapp).replace(/\D/g, '') + '?text=' + encodeURIComponent(WHATSAPP_MSG);
  whats.addEventListener('click', () => abrirChamado(p)); // fire-and-forget; o link navega normalmente

  return node;
}

async function abrirChamado(p) {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('chamados')
      .insert({ prestador_id: p.id, status: 'Pendente', servico_solicitado: 'Contato WhatsApp' })
      .select('id, link_token').single();
    if (!error && data) {
      localStorage.setItem('bg_chamado', JSON.stringify({
        id: data.id, token: data.link_token, prestador: p.nome, ts: Date.now(),
      }));
    }
  } catch (e) { console.error('Erro ao abrir chamado:', e); }
}

let renderGen = 0; // evita duplicação quando 2 renders concorrem (init + geolocalização)
async function render() {
  const gen = ++renderGen;
  loading.style.display = 'block';

  if (!sb) {
    loading.style.display = 'none';
    limpar(); mostrarVazio('Supabase não configurado. Preencha js/supabase-config.js.');
    return;
  }

  const { data, error } = await sb.from('prestadores').select('*').eq('ativo', true);
  if (gen !== renderGen) return; // um render mais novo já assumiu — aborta este

  loading.style.display = 'none';
  limpar();

  if (error) { mostrarVazio('Banco ainda não configurado. Rode o SQL no Supabase.'); console.error(error); return; }

  let lista = data || [];
  lista = lista.filter((x) => x.online !== false);            // esconde quem está offline/ocupado
  if (filtroServico) lista = lista.filter((x) => x[filtroServico]); // filtro rápido por tipo de pane
  const regiao = regiaoSel.value;
  if (regiao) lista = lista.filter((x) => (x.atendimento_regioes || '').toLowerCase().includes(regiao.toLowerCase()));
  if (userPos) {
    lista.forEach((x) => { x._dist = distanciaKm(userPos.lat, userPos.lng, +x.latitude, +x.longitude); });
    lista.sort((a, b) => a._dist - b._dist);
  }

  if (!lista.length) { mostrarVazio('Nenhum guincho encontrado para esta região.'); return; }
  lista.forEach((p, i) => feed.appendChild(montarCard(p, i)));
}

function limpar() { feed.querySelectorAll('.provider-card, .empty').forEach((el) => el.remove()); }

function mostrarVazio(msg) {
  const div = document.createElement('div');
  div.className = 'empty';
  div.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><br>' + msg;
  feed.appendChild(div);
}

/* ---------- localização automática ---------- */
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

/* ---------- menu lateral ---------- */
const drawer = document.getElementById('drawer');
const drawerBg = document.getElementById('drawerBg');
document.getElementById('btnMenu').addEventListener('click', () => { drawer.classList.add('open'); drawerBg.classList.add('open'); document.body.style.overflow = 'hidden'; });
document.getElementById('drawerClose').addEventListener('click', fecharDrawer);
drawerBg.addEventListener('click', fecharDrawer);
function fecharDrawer() { drawer.classList.remove('open'); drawerBg.classList.remove('open'); document.body.style.overflow = ''; }

/* ---------- init ---------- */
render();
autoLocalizar();
