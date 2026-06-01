/* ============================================================
   BuscaGincho — Backend (Node puro + node:sqlite)
   Sem dependências externas. Roda com:  node server.js
   ------------------------------------------------------------
   - Banco SQLite real (arquivo data.db) com tabelas de verdade
   - API para cliente / prestador / admin
   - Rastreamento: /perfil/:id (view), /chamar/:id (whats), /ligar/:id (call)
   - Dedupe de visualização por IP (30 min)
   ============================================================ */

const http = require('node:http');
const fs   = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 5500;
const ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data.db');
const VIEW_DEDUPE_MS = 30 * 60 * 1000; // 30 minutos

const WHATSAPP_MSG = 'Olá, estou no BuscaGincho e preciso de suporte próximo à minha localização atual.';

/* ===================== BANCO DE DADOS ===================== */
const db = new DatabaseSync(DB_FILE);
db.exec(`
  CREATE TABLE IF NOT EXISTS prestadores (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    nome TEXT NOT NULL,
    foto_url TEXT,
    banner_url TEXT,
    whatsapp TEXT NOT NULL,
    telefone TEXT,
    bairro TEXT,
    atendimento_regioes TEXT,
    cnh_verificada INTEGER DEFAULT 1,
    perfil_verificado INTEGER DEFAULT 1,
    avaliacao REAL DEFAULT 5.0,
    total_avaliacoes INTEGER DEFAULT 1,
    reboque_leve INTEGER DEFAULT 0,
    reboque_pesado INTEGER DEFAULT 0,
    carga_bateria INTEGER DEFAULT 0,
    troca_pneu INTEGER DEFAULT 0,
    resgate_veicular INTEGER DEFAULT 0,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    ativo INTEGER DEFAULT 1,
    email TEXT UNIQUE NOT NULL,
    senha_provisoria TEXT NOT NULL,
    views INTEGER DEFAULT 0,
    clicks_whatsapp INTEGER DEFAULT 0,
    clicks_ligar INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS contatos (
    id TEXT PRIMARY KEY,
    prestador_id TEXT NOT NULL,
    tipo TEXT NOT NULL,            -- view | whatsapp | ligar
    ip TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_contatos_prest ON contatos(prestador_id, tipo, created_at);
`);

const SERVICOS = ['reboque_leve','reboque_pesado','carga_bateria','troca_pneu','resgate_veicular'];
const BOOL_COLS = ['cnh_verificada','perfil_verificado','ativo', ...SERVICOS];

/* ---------- seed (somente na 1ª execução) ---------- */
function seed() {
  const count = db.prepare('SELECT COUNT(*) c FROM prestadores').get().c;
  if (count > 0) return;
  const base = [
    ['Marcos Pereira','5521991112233','552127778888',-23.0045,-43.3650,'Zona Oeste, Barra, Recreio e Jacarepaguá',5.0,48,[1,0,1,1,0],'marcos@buscagincho.com','Barra da Tijuca, RJ'],
    ['Alexandre Silva','5521983456789','552133334444',-22.9068,-43.2096,'Zona Norte, Méier, Tijuca e Madureira',4.9,32,[1,1,1,1,1],'alexandre@buscagincho.com','Méier, RJ'],
    ['Rodrigo Costa','5521974561122','552122220000',-22.9519,-43.1822,'Centro, Lapa, Glória e Flamengo',5.0,56,[1,1,1,1,1],'rodrigo@buscagincho.com','Centro, RJ'],
    ['Felipe Andrade','5521967893344','552121110000',-22.9711,-43.1822,'Zona Sul, Botafogo, Copacabana e Ipanema',4.8,27,[1,0,1,0,1],'felipe@buscagincho.com','Copacabana, RJ'],
    ['João Batista','5521995556677','552122223333',-22.8833,-43.1036,'Niterói, São Gonçalo e Região',4.7,76,[1,1,0,0,1],'joao@buscagincho.com','Niterói, RJ'],
  ];
  const fotos = [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=300&h=300&fit=crop&crop=faces',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=faces',
  ];
  const ins = db.prepare(`INSERT INTO prestadores
    (id,created_at,nome,foto_url,whatsapp,telefone,latitude,longitude,atendimento_regioes,bairro,
     avaliacao,total_avaliacoes,reboque_leve,reboque_pesado,carga_bateria,troca_pneu,resgate_veicular,
     email,senha_provisoria,ativo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
  base.forEach((b, i) => {
    const [nome,wpp,tel,lat,lng,reg,av,tot,serv,email,bairro] = b;
    ins.run(crypto.randomUUID(), Date.now(), nome, fotos[i], wpp, tel, lat, lng, reg, bairro, av, tot,
            serv[0],serv[1],serv[2],serv[3],serv[4], email, hashSenha('troque123'));
  });
  console.log('🌱 Banco populado com', base.length, 'prestadores de exemplo (senha: troque123).');
}
seed();

/* ===================== SEGURANÇA — HASH DE SENHA (scrypt) ===================== */
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(senha), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verificarSenha(senha, armazenado) {
  if (!armazenado) return false;
  if (!armazenado.startsWith('scrypt$')) return armazenado === senha; // legado (não deve ocorrer após reseed)
  const [, salt, hash] = armazenado.split('$');
  const calc = crypto.scryptSync(String(senha), salt, 64);
  const a = Buffer.from(hash, 'hex');
  return a.length === calc.length && crypto.timingSafeEqual(a, calc);
}

/* credenciais do admin (env > padrão), armazenadas como HASH */
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_HASH = hashSenha(process.env.ADMIN_PASS || 'admin');

/* ===================== HELPERS ===================== */
const TOKEN_TTL = 8 * 60 * 60 * 1000;       // 8 horas
const sessions = new Map();                  // token -> { role, id, exp }

function novoToken(role, id) {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.set(t, { role, id, exp: Date.now() + TOKEN_TTL });
  return t;
}
function auth(req, role) {
  const h = req.headers['authorization'] || '';
  const t = h.replace(/^Bearer\s+/i, '');
  const s = sessions.get(t);
  if (!s) return null;
  if (Date.now() > s.exp) { sessions.delete(t); return null; }   // expirado
  if (role && s.role !== role) return null;
  return s;
}

/* rate-limit simples por IP (protege os endpoints de login) */
const tentativas = new Map(); // ip -> { count, ts }
function rateLimitOk(ip, max = 15, janelaMs = 15 * 60 * 1000) {
  const now = Date.now();
  const e = tentativas.get(ip) || { count: 0, ts: now };
  if (now - e.ts > janelaMs) { e.count = 0; e.ts = now; }
  e.count++; tentativas.set(ip, e);
  return e.count <= max;
}

function getIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket.remoteAddress || 'desconhecido';
}

/* remove campos sensíveis das respostas */
function publico(p) { const o = normalizar(p); delete o.email; delete o.senha_provisoria; return o; }
function adminView(p) { const o = normalizar(p); delete o.senha_provisoria; return o; }
function distanciaKm(lat1, lon1, lat2, lon2) {
  const R = 6371, rad = (d) => d * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function normalizar(p) {
  const o = { ...p };
  BOOL_COLS.forEach((c) => { o[c] = !!p[c]; });
  return o;
}
function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = ''; let abortado = false;
    req.on('data', (c) => {
      if (abortado) return;
      data += c;
      if (data.length > 100_000) { abortado = true; req.destroy(); resolve({}); } // máx 100 KB
    });
    req.on('end', () => { if (abortado) return; try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

/* ---------- registro de eventos ---------- */
function registrarEvento(prestadorId, tipo, ip) {
  db.prepare('INSERT INTO contatos(id,prestador_id,tipo,ip,created_at) VALUES(?,?,?,?,?)')
    .run(crypto.randomUUID(), prestadorId, tipo, ip, Date.now());
}
function registrarView(prestadorId, ip) {
  const last = db.prepare(
    "SELECT created_at FROM contatos WHERE prestador_id=? AND tipo='view' AND ip=? ORDER BY created_at DESC LIMIT 1"
  ).get(prestadorId, ip);
  if (last && Date.now() - last.created_at < VIEW_DEDUPE_MS) return false; // dedupe 30 min
  registrarEvento(prestadorId, 'view', ip);
  db.prepare('UPDATE prestadores SET views = views + 1 WHERE id=?').run(prestadorId);
  return true;
}
function statsDe(id) {
  const p = db.prepare('SELECT views,clicks_whatsapp,clicks_ligar,avaliacao,total_avaliacoes FROM prestadores WHERE id=?').get(id);
  if (!p) return null;
  return {
    views: p.views,
    clicks_whatsapp: p.clicks_whatsapp,
    clicks_ligar: p.clicks_ligar,
    total_contatos: p.clicks_whatsapp + p.clicks_ligar,
    avaliacao: p.avaliacao,
    total_avaliacoes: p.total_avaliacoes,
  };
}

/* ===================== STATIC FILES ===================== */
const MIME = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon' };

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const filePath = path.join(ROOT, path.normalize(rel));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, {'Content-Type':'text/html'}); return res.end('<h1>404</h1>'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

/* ===================== ROTAS ===================== */
const server = http.createServer(async (req, res) => {
  // ---- cabeçalhos de segurança ----
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "img-src 'self' data: https:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'");

  const u = new URL(req.url, `http://${req.headers.host}`);
  const p = u.pathname;
  const m = req.method;

  /* ---------- RASTREAMENTO + REDIRECT ---------- */
  // /chamar/:id  -> registra clique whatsapp e redireciona
  let mt;
  if ((mt = p.match(/^\/chamar\/([^/]+)$/)) && m === 'GET') {
    const id = mt[1];
    const pr = db.prepare('SELECT whatsapp FROM prestadores WHERE id=? AND ativo=1').get(id);
    if (!pr) { res.writeHead(404); return res.end('Prestador não encontrado'); }
    registrarEvento(id, 'whatsapp', getIp(req));
    db.prepare('UPDATE prestadores SET clicks_whatsapp = clicks_whatsapp + 1 WHERE id=?').run(id);
    const dest = `https://wa.me/${String(pr.whatsapp).replace(/\D/g,'')}?text=${encodeURIComponent(WHATSAPP_MSG)}`;
    res.writeHead(302, { Location: dest }); return res.end();
  }
  // /ligar/:id  -> registra clique ligar e redireciona
  if ((mt = p.match(/^\/ligar\/([^/]+)$/)) && m === 'GET') {
    const id = mt[1];
    const pr = db.prepare('SELECT telefone, whatsapp FROM prestadores WHERE id=? AND ativo=1').get(id);
    if (!pr) { res.writeHead(404); return res.end('Prestador não encontrado'); }
    registrarEvento(id, 'ligar', getIp(req));
    db.prepare('UPDATE prestadores SET clicks_ligar = clicks_ligar + 1 WHERE id=?').run(id);
    const num = String(pr.telefone || pr.whatsapp).replace(/\D/g,'');
    res.writeHead(302, { Location: `tel:+${num}` }); return res.end();
  }
  // /perfil/:id  -> registra visualização (dedupe IP 30min) e serve a página de detalhe
  if ((mt = p.match(/^\/perfil\/([^/]+)$/)) && m === 'GET') {
    const id = mt[1];
    const pr = db.prepare('SELECT id FROM prestadores WHERE id=? AND ativo=1').get(id);
    if (pr) registrarView(id, getIp(req));
    return serveStatic(req, res, '/perfil.html');
  }

  /* ---------- API ---------- */
  if (p.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');

    // lista pública (clientes) — só ativos, SEM dados sensíveis
    if (p === '/api/prestadores' && m === 'GET') {
      let lista = db.prepare('SELECT * FROM prestadores WHERE ativo=1').all().map(publico);
      const lat = parseFloat(u.searchParams.get('lat'));
      const lng = parseFloat(u.searchParams.get('lng'));
      const regiao = u.searchParams.get('regiao');
      if (regiao) lista = lista.filter((x) => (x.atendimento_regioes||'').toLowerCase().includes(regiao.toLowerCase()));
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        lista.forEach((x) => { x._dist = distanciaKm(lat, lng, x.latitude, x.longitude); });
        lista.sort((a, b) => a._dist - b._dist);
      }
      return sendJSON(res, 200, lista);
    }

    // detalhe público — SEM dados sensíveis, só ativos
    if ((mt = p.match(/^\/api\/prestador\/([^/]+)$/)) && m === 'GET') {
      const pr = db.prepare('SELECT * FROM prestadores WHERE id=? AND ativo=1').get(mt[1]);
      if (!pr) return sendJSON(res, 404, { error: 'não encontrado' });
      return sendJSON(res, 200, publico(pr));
    }

    /* ----- LOGIN PRESTADOR (hash + rate-limit) ----- */
    if (p === '/api/prestador/login' && m === 'POST') {
      if (!rateLimitOk(getIp(req))) return sendJSON(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
      const { email, senha } = await readBody(req);
      const pr = db.prepare('SELECT id,senha_provisoria FROM prestadores WHERE email=?').get(String(email||'').trim().toLowerCase());
      if (!pr || !verificarSenha(senha, pr.senha_provisoria)) return sendJSON(res, 401, { error: 'Credenciais inválidas' });
      return sendJSON(res, 200, { token: novoToken('prestador', pr.id), id: pr.id });
    }

    /* ----- PRESTADOR (autenticado) ----- */
    if ((mt = p.match(/^\/api\/prestador\/([^/]+)\/stats$/)) && m === 'GET') {
      const s = auth(req, 'prestador');
      if (!s || s.id !== mt[1]) return sendJSON(res, 401, { error: 'não autorizado' });
      return sendJSON(res, 200, statsDe(mt[1]));
    }
    if ((mt = p.match(/^\/api\/prestador\/([^/]+)$/)) && m === 'PUT') {
      const s = auth(req, 'prestador');
      if (!s || s.id !== mt[1]) return sendJSON(res, 401, { error: 'não autorizado' });
      const b = await readBody(req);
      const campos = ['nome','whatsapp','telefone','foto_url','atendimento_regioes', ...SERVICOS];
      const sets = [], vals = [];
      campos.forEach((c) => { if (c in b) { sets.push(`${c}=?`); vals.push(SERVICOS.includes(c) ? (b[c]?1:0) : b[c]); } });
      if (sets.length) { vals.push(mt[1]); db.prepare(`UPDATE prestadores SET ${sets.join(',')} WHERE id=?`).run(...vals); }
      return sendJSON(res, 200, { ok: true });
    }

    /* ----- LOGIN ADMIN (hash + rate-limit) ----- */
    if (p === '/api/admin/login' && m === 'POST') {
      if (!rateLimitOk(getIp(req))) return sendJSON(res, 429, { error: 'Muitas tentativas. Aguarde alguns minutos.' });
      const { user, pass } = await readBody(req);
      if (String(user) === ADMIN_USER && verificarSenha(pass, ADMIN_HASH)) {
        return sendJSON(res, 200, { token: novoToken('admin', 'admin') });
      }
      return sendJSON(res, 401, { error: 'Credenciais inválidas' });
    }

    /* ----- ADMIN (autenticado) ----- */
    if (p.startsWith('/api/admin/') && p !== '/api/admin/login') {
      if (!auth(req, 'admin')) return sendJSON(res, 401, { error: 'não autorizado' });

      // listar todos (com stats) — sem hash de senha
      if (p === '/api/admin/prestadores' && m === 'GET') {
        const todos = db.prepare('SELECT * FROM prestadores ORDER BY created_at DESC').all().map((x) => {
          const o = adminView(x);
          o.total_contatos = x.clicks_whatsapp + x.clicks_ligar;
          return o;
        });
        return sendJSON(res, 200, todos);
      }
      // criar
      if (p === '/api/admin/prestadores' && m === 'POST') {
        const b = await readBody(req);
        const id = crypto.randomUUID();
        try {
          db.prepare(`INSERT INTO prestadores
            (id,created_at,nome,foto_url,banner_url,whatsapp,telefone,atendimento_regioes,
             latitude,longitude,email,senha_provisoria,ativo,
             reboque_leve,reboque_pesado,carga_bateria,troca_pneu,resgate_veicular,avaliacao,total_avaliacoes)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?)`).run(
            id, Date.now(), b.nome, b.foto_url||'', b.banner_url||'', String(b.whatsapp||'').replace(/\D/g,''),
            String(b.telefone||'').replace(/\D/g,''), b.atendimento_regioes||'',
            parseFloat(b.latitude), parseFloat(b.longitude), String(b.email||'').trim().toLowerCase(), hashSenha(b.senha_provisoria||'troque123'),
            b.reboque_leve?1:0, b.reboque_pesado?1:0, b.carga_bateria?1:0, b.troca_pneu?1:0, b.resgate_veicular?1:0,
            b.avaliacao||5.0, b.total_avaliacoes||1);
          return sendJSON(res, 201, { id });
        } catch (e) { return sendJSON(res, 400, { error: e.message }); }
      }
      // editar
      if ((mt = p.match(/^\/api\/admin\/prestadores\/([^/]+)$/)) && m === 'PUT') {
        const b = await readBody(req);
        const campos = ['nome','foto_url','banner_url','whatsapp','telefone','bairro','atendimento_regioes',
                        'latitude','longitude','email','avaliacao','total_avaliacoes', ...SERVICOS];
        const sets = [], vals = [];
        campos.forEach((c) => {
          if (!(c in b)) return;
          let v = b[c];
          if (SERVICOS.includes(c)) v = b[c] ? 1 : 0;
          else if (c === 'email') v = String(b[c]).trim().toLowerCase();
          sets.push(`${c}=?`); vals.push(v);
        });
        // senha: só atualiza se vier preenchida (armazena HASH, nunca texto puro)
        if (b.senha_provisoria) { sets.push('senha_provisoria=?'); vals.push(hashSenha(b.senha_provisoria)); }
        if (sets.length) { vals.push(mt[1]); db.prepare(`UPDATE prestadores SET ${sets.join(',')} WHERE id=?`).run(...vals); }
        return sendJSON(res, 200, { ok: true });
      }
      // ativar/ocultar
      if ((mt = p.match(/^\/api\/admin\/prestadores\/([^/]+)\/ativo$/)) && m === 'PATCH') {
        const b = await readBody(req);
        db.prepare('UPDATE prestadores SET ativo=? WHERE id=?').run(b.ativo?1:0, mt[1]);
        return sendJSON(res, 200, { ok: true });
      }
      // excluir
      if ((mt = p.match(/^\/api\/admin\/prestadores\/([^/]+)$/)) && m === 'DELETE') {
        db.prepare('DELETE FROM contatos WHERE prestador_id=?').run(mt[1]);
        db.prepare('DELETE FROM prestadores WHERE id=?').run(mt[1]);
        return sendJSON(res, 200, { ok: true });
      }
      // contatos detalhados de um prestador (com filtro por data e tipo)
      if ((mt = p.match(/^\/api\/admin\/prestadores\/([^/]+)\/contatos$/)) && m === 'GET') {
        const id = mt[1];
        const tipo = u.searchParams.get('tipo') || '';            // '' = todos
        const deStr = u.searchParams.get('de');                    // yyyy-mm-dd
        const ateStr = u.searchParams.get('ate');
        const cond = ['prestador_id=?']; const args = [id];
        if (tipo) { cond.push('tipo=?'); args.push(tipo); }
        if (deStr)  { cond.push('created_at>=?'); args.push(new Date(deStr + 'T00:00:00').getTime()); }
        if (ateStr) { cond.push('created_at<=?'); args.push(new Date(ateStr + 'T23:59:59').getTime()); }
        const where = cond.join(' AND ');
        const eventos = db.prepare(`SELECT tipo,ip,created_at FROM contatos WHERE ${where} ORDER BY created_at DESC LIMIT 200`).all(...args);
        // contagem por tipo dentro do mesmo período (ignora o filtro de tipo)
        const condP = ['prestador_id=?']; const argsP = [id];
        if (deStr)  { condP.push('created_at>=?'); argsP.push(new Date(deStr + 'T00:00:00').getTime()); }
        if (ateStr) { condP.push('created_at<=?'); argsP.push(new Date(ateStr + 'T23:59:59').getTime()); }
        const linhas = db.prepare(`SELECT tipo, COUNT(*) n FROM contatos WHERE ${condP.join(' AND ')} GROUP BY tipo`).all(...argsP);
        const contagem = { view: 0, whatsapp: 0, ligar: 0 };
        linhas.forEach((l) => { contagem[l.tipo] = l.n; });
        contagem.total = contagem.whatsapp + contagem.ligar;
        return sendJSON(res, 200, { stats: statsDe(id), periodo: { de: deStr, ate: ateStr, tipo }, contagem, eventos });
      }
    }

    return sendJSON(res, 404, { error: 'rota não encontrada' });
  }

  /* ---------- arquivos estáticos ---------- */
  serveStatic(req, res, p);
});

server.listen(PORT, () => {
  console.log(`\n🚛 BuscaGincho rodando em  http://localhost:${PORT}`);
  console.log(`   Cliente   ->  http://localhost:${PORT}/`);
  console.log(`   Prestador ->  http://localhost:${PORT}/prestador/login.html  (ex: marcos@buscagincho.com / troque123)`);
  console.log(`   Admin     ->  http://localhost:${PORT}/admin/login.html       (admin / admin)\n`);
});
