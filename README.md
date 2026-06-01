# 🚛 BuscaGincho

Plataforma **mobile** que conecta motoristas a prestadores de serviço de reboque e
assistência veicular no **Rio de Janeiro**. Foco: cliente em emergência → chamar guincho
rápido pelo WhatsApp. Prestadores pagam mensalidade para aparecerem verificados.

Backend próprio em **Node.js puro + SQLite** (sem dependências externas, sem `npm install`),
com rastreamento de visualizações/contatos e camada de segurança.

> ℹ️ **Sobre o Supabase:** o projeto **não** usa Supabase no momento — roda com um backend
> local Node + SQLite (`data.db`), que cobre tudo (auth, dados, métricas). O arquivo
> [`supabase/schema.sql`](supabase/schema.sql) traz o schema equivalente caso você queira
> migrar para Supabase no futuro.

## ▶️ Como rodar

```powershell
cd C:\Users\barro\rede-guinchos
node server.js
```

Acesse:
- **Cliente:** http://localhost:5500/
- **Prestador:** http://localhost:5500/prestador/login.html — ex.: `marcos@buscagincho.com` / `troque123`
- **Admin:** http://localhost:5500/admin/login.html — `admin` / `admin`

> Os links de Prestador/Admin **não** aparecem para o cliente — acesso só pela URL direta.

O banco `data.db` é criado e populado automaticamente na 1ª execução (5 prestadores demo).

### Variáveis de ambiente (produção)

| Variável | Padrão | Função |
|----------|--------|--------|
| `PORT` | `5500` | porta do servidor |
| `ADMIN_USER` | `admin` | usuário do admin |
| `ADMIN_PASS` | `admin` | senha do admin (armazenada como hash em memória) |

```powershell
$env:ADMIN_USER="meuadmin"; $env:ADMIN_PASS="senhaForte123"; node server.js
```

## 🔒 Segurança implementada

- **Senhas com hash scrypt + salt** (nunca em texto puro no banco); verificação em tempo constante (`timingSafeEqual`).
- **Dados sensíveis nunca expostos** na API pública (e-mail e senha removidos das respostas do cliente).
- **Tokens de sessão** aleatórios (24 bytes) com **expiração de 8h**.
- **Rate-limit** por IP nos endpoints de login (15 tentativas / 15 min → HTTP 429).
- **Cabeçalhos de segurança**: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- **SQL 100% parametrizado** (prepared statements) → sem injeção de SQL.
- **Proteção contra path traversal** no servidor de arquivos estáticos.
- **Limite de corpo de requisição** (100 KB) contra abuso/DoS.

## 📁 Estrutura

```
rede-guinchos/
├── server.js             # Backend Node + SQLite (API, tracking, segurança)
├── index.html            # Cliente (mobile) — hero, busca, lista, drawer
├── perfil.html           # Perfil detalhado do prestador
├── css/styles.css        # Tema preto · branco · amarelo (#ffc600)
├── js/
│   ├── api.js            # Cliente da API
│   └── main.js           # Geolocalização automática + render + menu
├── prestador/            # Login + painel (estatísticas, edição)
├── admin/                # Login + painel (CRUD, contatos por data, ativar/ocultar)
├── img/                  # logo3.png (logo) + banner.png (hero)
└── supabase/schema.sql   # Schema equivalente (caso migre p/ Supabase)
```

## 📊 Rastreamento (métricas, sem sistema de chamados)

| Rota | Ação |
|------|------|
| `GET /perfil/{id}` | registra **visualização** (dedupe por IP — 30 min) e abre o perfil |
| `GET /chamar/{id}` | registra **clique no WhatsApp** e redireciona p/ `wa.me` |
| `GET /ligar/{id}` | registra **clique em Ligar** e redireciona p/ `tel:` |

Prestador acompanha no painel: Visualizações, Cliques WhatsApp, Cliques Ligar, Avaliação,
Total de Contatos. Admin vê o mesmo + histórico de eventos com **filtro por data**.

## 🎨 Identidade

Preto `#0A0A0A` (estrutura) · Branco (leitura) · Amarelo `#ffc600` (ação).

## © 2026 Busca Guincho
Conectando motoristas aos melhores prestadores de serviços de reboque e assistência veicular.
