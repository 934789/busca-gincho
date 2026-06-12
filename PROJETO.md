# 🚛 Busca Guincho — Documentação do Projeto

> Última atualização: 2026-06-07. Este arquivo explica **tudo** do projeto pra você (ou o Claude) entender rápido.

---

## 1. O que é
Plataforma **mobile (web app)** estilo **Uber/99 para guincho/reboque** no Rio de Janeiro.
O cliente em emergência chama um guincho em 2 toques, acompanha no mapa ao vivo, paga pela
plataforma e avalia. Prestadores (guincheiros) recebem chamados por proximidade, navegam até
o cliente e geram comprovante. Tem painel admin completo e um **agente de IA de suporte (Bruna)**.

**Domínio no ar:** https://buscaguincho.com.br (HostGator).

---

## 2. Stack (100% sem build, sem npm install pra rodar)
- **Front:** HTML + CSS + JS puro (sem framework). Mobile-first.
- **Backend/Dados:** **Supabase** (Postgres + Realtime + Auth + Storage + Edge Functions).
- **Mapa:** Leaflet.js + **MapTiler** (tiles) + **OSRM** (rota real pelas ruas) + MapTiler Geocoding.
- **GPS:** `navigator.geolocation.watchPosition` (transmite a posição do guincho ao vivo).
- **PDF:** html2pdf.js · **Gráficos:** Chart.js · **Agente IA:** Google **Gemini 2.5-flash** via Edge Function.
- **Servidor local (só dev):** `node server.js` → serve os estáticos em http://localhost:5500.
  (Em produção NÃO tem Node — é estático no Apache da HostGator + Supabase.)

> ⚠️ O `README.md` antigo fala de "Node + SQLite" — **está desatualizado**. A verdade é o que está aqui.

---

## 3. Estrutura
```
index.html              → home do cliente (mapa, chamar guincho, ícone de conta)
rastreio.html           → cliente acompanha o guincho no mapa (+ PINs, SOS, avaliação)
rastreio-prestador.html → prestador navega até o cliente/destino (Cheguei→Iniciar→Finalizar)
conta.html              → perfil/conta do cliente (foto, dados, histórico)
perfil.html             → perfil público de um prestador
parceiro.html           → landing "Seja um parceiro"
prestador/login.html    → login do prestador
prestador/cadastro.html → cadastro de parceiro (docs + selfie → análise)
prestador/painel.html   → LOBBY do prestador (online, mapa, financeiro, carteira)
admin/login.html        → login admin
admin/painel.html       → painel admin (6 abas)
sobre/termos/privacidade/isencao/contato.html → institucionais

css/styles.css          → estilo principal (cache-bust ?v=N)
js/supabase-config.js   → cria o client `sb` + chaves + PREÇOS + helpers
js/main.js              → lógica da home (chamar, preço, conta, login Google)
js/suporte.js           → chat de suporte (agente Bruna), injeta o overlay
img/ audio/ favicon.svg → assets
supabase/*.sql          → migrações do banco (rodar na ordem)
supabase/functions/suporte-agente/ → Edge Function do agente de IA (Gemini)
_sim_*.mjs              → simuladores de teste (despacho, corrida longe)
.htaccess               → config Apache (HTTPS, CSP, cache, MIME) p/ HostGator
```

---

## 4. Funcionalidades

### 👤 Cliente (home + rastreio)
- Chamar guincho: escolhe serviço (guincho leve/pesado, pane de pneu c/ reboque, bateria),
  digita destino, informa **veículo + placa**, nome e celular. Vê o **preço antes** de confirmar.
- **Preço dinâmico:** cobra **deslocamento (guincho→cliente) + reboque (cliente→destino)**, rota
  real OSRM. 10 km grátis (franquia) + multiplicador noturno/chuva. Preço **trava** no pedido.
- Acompanha o guincho **no mapa ao vivo** (rastreio.html). **2 PINs**: retirada (chegada) e entrega
  (destino). Botões **SOS (190)** e **Compartilhar trajeto**. Chat com o prestador.
- Ao finalizar: tela de **avaliação estilo 99** (banner) → oferta de **criar conta**.
- **Conta:** ícone de usuário no header → login/cadastro (celular+senha **ou Google**) → `/conta.html`
  (foto, dados editáveis, histórico de corridas). 1ª corrida é sem cadastro; na 2ª exige conta.

### 👷 Prestador (parceiro)
- **Cadastro self-service** (docs CNH/CRLV/identidade + selfie) → entra "em análise" → admin aprova.
- **Lobby** (painel.html): toggle Online (transmite GPS), recebe **modal de despacho** (Aceitar/Recusar,
  som, timer 2min), aba **Financeiro** com **carteira + saque (PIX)** + comprovante por corrida.
- Navegação (rastreio-prestador): Cheguei (PIN retirada) → Iniciar (foto antes) → Finalizar (PIN entrega
  ou foto se cliente ausente) → comprovante PDF.

### 🖥️ Admin (6 abas)
Início (KPIs + atividade tempo real) · Chamados (relatório, encerrar/cancelar) · Prestadores
(cadastrar + **aprovar cadastros em análise** com selfie/docs) · Clientes · Financeiro (comissão +
**aprovar/recusar saques**) · Suporte (fila de quem pediu humano).

### 🤖 Agente de IA "Bruna" (suporte)
Edge Function `supabase/functions/suporte-agente` (Gemini 2.5-flash) com **function calling**:
`verificar_status_chamado`, `verificar_extrato_prestador`, `acionar_suporte_humano` (transbordo).
Persona cliente×prestador. Front `js/suporte.js` (botão Ajuda na home e nas telas de rastreio).

---

## 5. Como rodar local
```bash
cd C:\Users\barro\rede-guinchos
node server.js            # sobe em http://localhost:5500
```
Simular um chamado pro prestador testar:
```bash
node _sim_despacho.mjs    # despacho perto (PIN retirada 4321 / entrega 8765)
node _sim_longe.mjs       # despacho longe (testa o preço deslocamento+reboque)
```

---

## 6. Banco (Supabase) — ordem das migrações
Projeto ref **`qnfjdvatrtgwxlaakawl`**. Anon key (pública) está em `js/supabase-config.js`.
Rodar no **SQL Editor** na ordem: `v2_schema` → `v2_admin_policy` → `v2_storage` → `v3_features` →
`v4_dispatch` → `v4_chat` → `v4_chat_leitura` → `v4_rotacao` → `v5_cliente_placa` → `v6_nota_fiscal`
→ `v7_evidencias` → `v8_precificacao` → `v9_pin2_suporte_carteira` → `v10_cadastros` →
`v11_suporte_agente` → `v12_conta_cliente` → `v13_rls_authenticated`.
> Tabelas principais: `prestadores`, `chamados`, `clientes`, `mensagens`, `avaliacoes`,
> `suporte_conversas`, `suporte_mensagens`, `saques`. RLS está **permissivo (protótipo)** — fechar
> com regras reais antes de escalar.

---

## 7. Login com Google (já configurado)
- **Supabase:** Authentication → Providers → **Google** ATIVADO (Client ID/Secret colados).
- **URL Configuration:** Site URL = `https://buscaguincho.com.br`; Redirect URLs = o domínio (com/sem
  barra) + `http://localhost:5500`.
- **Google Cloud:** OAuth client "Web" com redirect URI `https://qnfjdvatrtgwxlaakawl.supabase.co/auth/v1/callback`.
- **2 detalhes que faziam falhar (resolvidos):** `flowType:'implicit'` no createClient (site estático)
  e RLS liberando o papel `authenticated` (`v13`). Após login, abre "Complete seu cadastro" (celular/CPF).

---

## 8. Preços (em `js/supabase-config.js` → `PRECO_CATEGORIAS` + `calcularValoresChamado`)
| Categoria | Saída (inclui 10km) | KM excedente |
|---|---|---|
| Guincho Leve | R$ 180 | R$ 8/km |
| Guincho Pesado | R$ 300 | R$ 13/km |
| Pane de Pneu/Roda (c/ reboque) | R$ 170 | R$ 8/km |
| Carga de Bateria/Pane Elétrica | R$ 190 (fixo, no local) | — |

Split plataforma: **15% + R$ 5 fixo**. Multiplicador noturno (x1.2), chuva, zona. Distância cobrada =
**deslocamento + reboque** (rota real OSRM), menos 10 km de franquia.

---

## 9. Deploy (HostGator)
cPanel (user `borala66`) → Gerenciador de Arquivos → pasta `buscaguincho.com.br` → mostrar arquivos
ocultos → **Upload** o zip → **Extract** → **sobrescrever**. Garantir que `css/` e `js/` subiram.
> **Cache:** a cada deploy de css/js, **incrementar o `?v=N`** nos links (hoje em `v=11`) — senão o
> celular usa o CSS velho e os botões ficam "bugados". A Edge Function (agente) fica no Supabase (não sobe no zip).

---

## 10. Credenciais de teste
- **Prestador:** `alexandre@buscaguincho.com.br` / `alexandre2026`
- **Admin:** `admin` / `bg##1`
- **Cliente:** cria na hora (ou login Google).

---

## 11. Estado atual e próximos passos
✅ Pronto e testado: chamado, rastreio, 2 PINs, preço deslocamento+reboque, carteira/saque, admin em
abas, cadastro de parceiro, conta do cliente, **login Google**, agente Bruna.

⏭️ **PRÓXIMO: API de pagamento (PagBank)** — cobrança avulsa + **assinatura recorrente** para o
**Plano BLACK** (clube de assistência: 1 guincho/mês incluso até 20km, 20% off no excedente, suporte VIP,
despacho prioritário; ~R$34,90/mês; com **carência 15–30 dias** e teto anual pra evitar abuso; framing
"assistência", NÃO "seguro" por questão jurídica). Aproveitar pra reforçar bloqueio por IP/telefone no servidor.

> 💡 Histórico detalhado de decisões fica na memória do Claude Code (gatilho "gincho"). Os simuladores
> `_sim_*.mjs` ajudam a testar sem celular.
