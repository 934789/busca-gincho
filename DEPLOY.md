# 🚀 Subir o Busca Guincho na HostGator — passo a passo

O site é **100% estático no servidor** (HTML/CSS/JS) e fala direto com o **Supabase** (banco na nuvem).
👉 **Você NÃO precisa de Node.js na HostGator.** É só subir os arquivos. O `server.js` era só pra rodar no seu PC.

---

## 📦 O que você recebeu

| Arquivo | Vai para | O que é |
|---|---|---|
| `busca-guincho-site.zip` | **domínio principal** (`public_html`) | Site do cliente + admin (+ prestador como reserva) |
| `painel-prestador.zip` | **subdomínio** (`painel.seudominio`) | Painel do prestador isolado |

> Dá pra rodar **tudo no mesmo domínio** (só o 1º zip) ou separar o painel do prestador num **subdomínio** (os dois zips). Veja os dois caminhos abaixo.

---

## ✅ PASSO 1 — Subir o site principal

1. Entre no **cPanel** da HostGator → **Gerenciador de Arquivos** (File Manager).
2. Abra a pasta **`public_html`**.
3. (Se já tiver algo de teste lá, apague.) Clique em **Upload** e envie o **`busca-guincho-site.zip`**.
4. Volte ao File Manager, clique com o botão direito no zip → **Extract** (Extrair) ali mesmo dentro de `public_html`.
5. Apague o `.zip` depois de extrair.
6. Confirme que ficou assim: `public_html/index.html`, `public_html/css/`, `public_html/js/`, `public_html/admin/`, etc. (os arquivos soltos, **não** dentro de uma subpasta).

Pronto: acesse **https://seudominio.com.br** 🎉

---

## ✅ PASSO 2 — Ativar o SSL (cadeado / HTTPS) — OBRIGATÓRIO

O mapa e a **localização (GPS)** só funcionam em **HTTPS**.

1. No cPanel → **SSL/TLS Status** (ou **AutoSSL**).
2. Marque o domínio e clique **Run AutoSSL** (grátis, leva alguns minutos).
3. Quando aparecer o cadeado verde, o `.htaccess` já força o HTTPS automaticamente.

---

## ✅ PASSO 3 (opcional) — Painel do prestador em subdomínio

Se quiser o painel separado tipo `painel.seudominio.com.br`:

1. cPanel → **Subdomínios** (Subdomains).
2. Em **Subdomínio**, digite `painel`. O **Document Root** preenche sozinho como `public_html/painel`. Crie.
3. **Antes de subir**, abra o `painel-prestador.zip`, edite o arquivo **`js/supabase-config.js`** e troque a linha:
   ```js
   window.SITE_CLIENTE = 'https://SEU-DOMINIO-PRINCIPAL.com.br';
   ```
   pela URL **real** do seu site principal (ex.: `https://buscaguincho.com.br`) — sem barra no final.
   *(Isso faz o link de rastreio que o prestador manda pro cliente abrir no site principal.)*
4. No File Manager, entre na pasta do subdomínio (`public_html/painel`), faça **Upload** do `painel-prestador.zip` e **Extract**.
5. Rode o **AutoSSL** também pro subdomínio (Passo 2).
6. Acesse **https://painel.seudominio.com.br** → cai no login do prestador.

> **Não quer subdomínio?** Ignore o Passo 3. O painel do prestador também já está dentro do site principal em `seudominio.com.br/prestador/login.html`.

---

## ✅ PASSO 4 — Liberar os domínios nas chaves externas

1. **MapTiler** (mapa): se você restringiu a chave por domínio, entre em maptiler.com → sua chave → adicione `seudominio.com.br` e `painel.seudominio.com.br` na lista de domínios permitidos.
2. **Supabase**: não precisa mexer (a chave `anon` é pública e funciona de qualquer domínio; a segurança fica nas regras RLS).

---

## ✅ PASSO 5 — Testar tudo

- [ ] Home abre, o mapa carrega e pede localização.
- [ ] "Chamar Guincho" cria o chamado.
- [ ] Login do prestador entra no painel (Online/Offline funciona).
- [ ] Fluxo: aceitar → **Cheguei ao cliente** → **Iniciar trajeto ao destino** → **Finalizar**.
- [ ] O cliente, no link de rastreio, vê o caminhão andar e a rota mudar pro destino.
- [ ] Admin (`/admin`) abre o relatório de chamados.
- [ ] Sons tocam (aceitar / chat).

---

## ❓ Problemas comuns

| Sintoma | Causa / solução |
|---|---|
| Mapa em branco | SSL não ativo, ou domínio não liberado no MapTiler (Passo 4). |
| GPS não pede permissão | Site sem HTTPS (Passo 2). |
| Som não toca | Navegador bloqueia áudio até o 1º clique — normal. Já tratamos com clique. |
| Link de rastreio abre no subdomínio errado | Faltou trocar o `SITE_CLIENTE` (Passo 3.3). |
| Arquivos extraíram dentro de subpasta | Mova o conteúdo pra dentro de `public_html` direto (sem pasta intermediária). |

---

## 🔒 Lembrete de segurança
A chave que está no front é a **anon** do Supabase (pública, pode ficar exposta). **Nunca** suba a `service_role`/`secret`. A proteção real são as políticas **RLS** no Supabase.
