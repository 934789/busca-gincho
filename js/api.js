/* ============================================================
   API CLIENT — Busca Guincho (front-end)
   Conversa com o backend Node (server.js). Sem dependências.
   ============================================================ */

const SERVICOS = [
  { key: 'reboque_leve',     label: 'Reboque Leve',          icon: 'fa-truck-pickup' },
  { key: 'reboque_pesado',   label: 'Reboque Pesado',        icon: 'fa-truck-moving' },
  { key: 'carga_bateria',    label: 'Carga de Bateria',      icon: 'fa-car-battery' },
  { key: 'troca_pneu',       label: 'Auxílio Troca de pneu', icon: 'fa-gear' },
  { key: 'resgate_veicular', label: 'Resgate Veicular',      icon: 'fa-triangle-exclamation' },
];

const API = {
  SERVICOS,

  // token helpers
  setToken(role, t) { sessionStorage.setItem(role + '_token', t); },
  token(role) { return sessionStorage.getItem(role + '_token') || ''; },
  authHeader(role) { return { Authorization: 'Bearer ' + this.token(role) }; },

  async _json(url, opts = {}) {
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  },

  // ---------- público ----------
  async listar({ lat, lng, regiao } = {}) {
    const q = new URLSearchParams();
    if (typeof lat === 'number') q.set('lat', lat);
    if (typeof lng === 'number') q.set('lng', lng);
    if (regiao) q.set('regiao', regiao);
    const r = await this._json('/api/prestadores?' + q.toString());
    return r.ok ? r.data : [];
  },
  async prestador(id) {
    const r = await this._json('/api/prestador/' + id);
    return r.ok ? r.data : null;
  },

  // ---------- prestador ----------
  async loginPrestador(email, senha) {
    const r = await this._json('/api/prestador/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (r.ok) { this.setToken('prestador', r.data.token); sessionStorage.setItem('prestador_id', r.data.id); }
    return r;
  },
  async salvarPerfil(id, patch) {
    return this._json('/api/prestador/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...this.authHeader('prestador') },
      body: JSON.stringify(patch),
    });
  },
  async statsPrestador(id) {
    const r = await this._json('/api/prestador/' + id + '/stats', { headers: this.authHeader('prestador') });
    return r.ok ? r.data : null;
  },

  // ---------- admin ----------
  async loginAdmin(user, pass) {
    const r = await this._json('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass }),
    });
    if (r.ok) this.setToken('admin', r.data.token);
    return r;
  },
  async adminListar() {
    const r = await this._json('/api/admin/prestadores', { headers: this.authHeader('admin') });
    return r.ok ? r.data : [];
  },
  async adminCriar(dados) {
    return this._json('/api/admin/prestadores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeader('admin') },
      body: JSON.stringify(dados),
    });
  },
  async adminEditar(id, patch) {
    return this._json('/api/admin/prestadores/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...this.authHeader('admin') },
      body: JSON.stringify(patch),
    });
  },
  async adminAtivo(id, ativo) {
    return this._json('/api/admin/prestadores/' + id + '/ativo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...this.authHeader('admin') },
      body: JSON.stringify({ ativo }),
    });
  },
  async adminExcluir(id) {
    return this._json('/api/admin/prestadores/' + id, {
      method: 'DELETE', headers: this.authHeader('admin'),
    });
  },
  async adminContatos(id, { de, ate, tipo } = {}) {
    const q = new URLSearchParams();
    if (de) q.set('de', de);
    if (ate) q.set('ate', ate);
    if (tipo) q.set('tipo', tipo);
    const r = await this._json('/api/admin/prestadores/' + id + '/contatos?' + q.toString(), { headers: this.authHeader('admin') });
    return r.ok ? r.data : null;
  },
};

// utilidades de formatação compartilhadas
function formatWhats(num) {
  const n = String(num).replace(/\D/g, '');
  const ddd = n.slice(2, 4), corpo = n.slice(4);
  if (corpo.length === 9) return `(${ddd}) ${corpo.slice(0,5)}-${corpo.slice(5)}`;
  return `(${ddd}) ${corpo.slice(0,4)}-${corpo.slice(4)}`;
}
function estrelasTxt(nota) {
  const c = Math.round(nota);
  return '★★★★★'.slice(0, c) + '☆☆☆☆☆'.slice(0, 5 - c);
}
