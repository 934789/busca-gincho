# 🚀 Deploy do BuscaGincho numa VPS — Passo a Passo

Guia para colocar o projeto no ar numa VPS Linux (Ubuntu 22.04 / 24.04).
Stack: **Node.js + SQLite** (sem banco externo, sem `npm install`).

> ⚠️ **Importante:** a **localização automática** dos clientes (e o botão "usar minha
> localização") só funciona em **HTTPS**. O navegador bloqueia geolocalização em sites
> HTTP. Por isso o ideal é ter um **domínio + certificado SSL** (passos 7 e 8). Só com IP
> e HTTP o site funciona, mas sem geolocalização automática.

---

## ✅ Pré-requisitos
- Uma VPS com **Ubuntu** e acesso **SSH** (root ou usuário com `sudo`).
- (Recomendado) Um **domínio** apontando para o IP da VPS (ex.: `buscagincho.com.br`).
- O projeto no GitHub: `https://github.com/934789/busca-gincho`

---

## 1) Conectar na VPS por SSH

No seu PC (PowerShell ou terminal):

```bash
ssh root@SEU_IP_DA_VPS
```

---

## 2) Instalar o Node.js (versão 24 LTS)

O projeto usa o SQLite nativo do Node (`node:sqlite`), que funciona sem flags a partir
do **Node 23+**. Instale o **Node 24 LTS**:

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git
node -v          # deve mostrar v24.x
```

> Se por algum motivo você instalar o Node 22, rode o app com a flag:
> `node --experimental-sqlite server.js`

---

## 3) Baixar o projeto

```bash
cd /var/www            # ou a pasta que preferir
sudo git clone https://github.com/934789/busca-gincho.git
cd busca-gincho
sudo chown -R $USER:$USER /var/www/busca-gincho
```

---

## 4) Testar se sobe

```bash
node server.js
```

Deve aparecer `🚛 BuscaGincho rodando em http://localhost:5500`.
Pressione **Ctrl + C** para parar (no próximo passo deixamos rodando pra sempre).

---

## 5) Definir a senha do admin e manter rodando com PM2

O **PM2** mantém o app no ar 24h e reinicia sozinho se cair ou se a VPS reiniciar.

```bash
sudo npm install -g pm2

# inicie definindo usuário/senha do admin e a porta:
ADMIN_USER="seuadmin" ADMIN_PASS="UmaSenhaForte123" PORT=5500 pm2 start server.js --name buscagincho

pm2 save                 # salva a lista de apps
pm2 startup              # gera o comando p/ iniciar no boot — copie e rode o que ele mostrar
```

Comandos úteis do PM2:
```bash
pm2 status               # ver se está online
pm2 logs buscagincho     # ver logs em tempo real
pm2 restart buscagincho  # reiniciar
pm2 stop buscagincho     # parar
```

> A senha do admin **não fica salva em arquivo** — ela vira hash em memória ao iniciar.
> Para trocar depois: `pm2 delete buscagincho` e rode o `pm2 start ...` de novo com a nova `ADMIN_PASS`.

---

## 6) Configurar o Nginx (proxy reverso)

O app roda na porta 5500. O Nginx recebe o tráfego na porta 80 (e depois 443) e repassa.

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/buscagincho
```

Cole (troque `SEU_DOMINIO` pelo seu domínio ou pelo IP da VPS):

```nginx
server {
    listen 80;
    server_name SEU_DOMINIO www.SEU_DOMINIO;

    location / {
        proxy_pass http://127.0.0.1:5500;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> O `X-Forwarded-For` é importante: é por ele que o sistema registra o **IP real** dos
> contatos/visualizações nas métricas.

Ative e recarregue:
```bash
sudo ln -s /etc/nginx/sites-available/buscagincho /etc/nginx/sites-enabled/
sudo nginx -t            # testa a configuração
sudo systemctl reload nginx
```

Agora o site já abre em `http://SEU_DOMINIO` (ou `http://SEU_IP`).

---

## 7) HTTPS grátis com Let's Encrypt (necessário p/ geolocalização)

Precisa de um **domínio** apontando para a VPS.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO -d www.SEU_DOMINIO
```

Siga as perguntas (e-mail, aceitar termos, redirecionar HTTP→HTTPS = **sim**).
O Certbot renova sozinho. Pronto: `https://SEU_DOMINIO` no ar com cadeado 🔒.

---

## 8) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

> Não é preciso abrir a porta 5500 pra internet — só o Nginx fala com ela internamente.

---

## 9) Colocar logo e banner

As imagens já vêm no repositório (`img/logo3.png` e `img/banner.png`). Se quiser trocar:

```bash
cd /var/www/busca-gincho/img
# envie os novos arquivos com os MESMOS nomes (logo3.png / banner.png)
pm2 restart buscagincho
```

---

## 10) Acessos

| Tela | URL |
|------|-----|
| Cliente | `https://SEU_DOMINIO/` |
| Prestador | `https://SEU_DOMINIO/prestador/login.html` |
| Admin | `https://SEU_DOMINIO/admin/login.html` |

Os links de Prestador/Admin **não** aparecem para o cliente — acesso só pela URL direta.

---

## 🔄 Atualizar o site (quando houver mudanças no GitHub)

```bash
cd /var/www/busca-gincho
git pull
pm2 restart buscagincho
```

---

## 💾 Backup do banco de dados

Todos os dados (prestadores, métricas, contatos) ficam no arquivo `data.db`.
Faça backup periódico:

```bash
cp /var/www/busca-gincho/data.db ~/backup-buscagincho-$(date +%F).db
```

> O `data.db` **não** está no GitHub (fica só na VPS). Ao rodar pela 1ª vez ele é criado
> e populado com os prestadores de exemplo. Em produção, use o painel Admin para cadastrar
> os prestadores reais e remover os de demonstração.

---

## 🧯 Problemas comuns

| Sintoma | Causa / Solução |
|---------|-----------------|
| Localização não ativa | Site está em HTTP. Configure o HTTPS (passo 7). |
| `node:sqlite` dá erro | Node antigo. Use Node 24 (passo 2) ou rode com `--experimental-sqlite`. |
| Site não abre | `pm2 status` (app online?) e `sudo nginx -t` (config ok?). |
| 502 Bad Gateway | O app caiu — veja `pm2 logs buscagincho`. |
| IP errado nas métricas | Confirme o `proxy_set_header X-Forwarded-For` no Nginx. |

---

© 2026 Busca Guincho — Conectando motoristas aos melhores prestadores de reboque e assistência veicular.
