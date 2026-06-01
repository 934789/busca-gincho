# 🗺️ Como ativar o Google Maps oficial — passo a passo

O mapa oficial do Google só funciona com uma **chave de API** (API key), e para gerá-la
o Google exige uma conta com **billing (cobrança) ativado** — mesmo no uso gratuito é
preciso ter um cartão cadastrado. Siga os passos abaixo (leva ~10 minutos).

> 💳 **É pago?** Tem uma cota **gratuita** generosa por mês. Você só paga se ultrapassar o
> volume gratuito. Para um app começando, normalmente fica **R$ 0**. Mesmo assim, vamos
> colocar **limite de orçamento + restrições na chave** pra você nunca tomar susto.

---

## 1) Criar conta no Google Cloud
1. Acesse **https://console.cloud.google.com**
2. Entre com sua conta Google (a mesma do Gmail serve).
3. Aceite os termos se aparecer.

## 2) Criar um projeto
1. No topo, clique no seletor de projeto → **"Novo projeto"**.
2. Nome: `Busca Guincho` → **Criar**.
3. Selecione esse projeto no seletor do topo.

## 3) Ativar o faturamento (billing)
1. Menu (☰) → **Faturamento** (Billing).
2. **"Vincular uma conta de faturamento"** → **"Criar conta de faturamento"**.
3. Preencha país, aceite os termos, e adicione um **cartão de crédito**.
   - O Google pode fazer uma cobrança simbólica de verificação (~R$ 1) e estornar.
4. Vincule essa conta de faturamento ao projeto **Busca Guincho**.

## 4) Ativar a API do mapa
1. Menu (☰) → **APIs e serviços** → **Biblioteca**.
2. Busque **"Maps JavaScript API"** → clique → **Ativar**.
   - (Opcional, p/ buscas de endereço futuras: ative também **Geocoding API**.)

## 5) Gerar a chave (API key)
1. Menu (☰) → **APIs e serviços** → **Credenciais**.
2. **"Criar credenciais"** → **"Chave de API"**.
3. Copie a chave gerada (algo como `AIzaSy...`).

## 6) Proteger a chave (MUITO importante)
Ainda na tela da chave, clique em **"Editar chave"**:
1. **Restrições de aplicativo** → **"Sites" (HTTP referrers)** → adicione:
   ```
   https://buscagincho.com.br/*
   https://*.buscagincho.com.br/*
   http://localhost:5500/*
   ```
2. **Restrições de API** → **"Restringir chave"** → marque **Maps JavaScript API** (e Geocoding, se ativou).
3. **Salvar**.

## 7) Colocar um limite de orçamento (segurança)
1. Menu (☰) → **Faturamento** → **Orçamentos e alertas** → **Criar orçamento**.
2. Defina um valor baixo (ex.: **R$ 50/mês**) e alertas em 50%, 90%, 100%.
   - Assim você é avisado e nunca gasta sem saber.

## 8) Me enviar a chave
Cole a chave em `js/supabase-config.js`:
```js
const GOOGLE_MAPS_KEY = 'AIzaSy...sua-chave...';
```
ou me mande aqui que eu coloco e **migro o mapa pra API oficial do Google** (com o ponto
"Seu local" pulsante, rota e ícones), testando tudo.

---

### Resumo do que você precisa fazer
✅ Conta Google Cloud → projeto → **ativar billing (cartão)** → ativar **Maps JavaScript API**
→ **criar a chave** → **restringir** a chave por site → **limite de orçamento** → me enviar a chave.

> Enquanto a chave não vier, o app continua com o mapa atual (Leaflet com tiles do Google),
> que já tem a aparência do Google — só não é a API oficial.
