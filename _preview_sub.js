// Preview LOCAL do subdomínio do prestador (serve a pasta painel-prestador/ como raiz)
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'painel-prestador');
const mt = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp',
  '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg', '.ico':'image/x-icon' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || p === '') p = '/index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(f, (e, d) => {
    if (e) { res.writeHead(404, {'Content-Type':'text/html'}); return res.end('404 — ' + p); }
    res.writeHead(200, { 'Content-Type': mt[path.extname(f)] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(5502, () => console.log('Preview subdomínio prestador → http://localhost:5502'));
