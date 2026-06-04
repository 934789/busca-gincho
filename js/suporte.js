/* ============================================================
   Chatbot de Suporte Híbrido (FAQ dinâmico + transbordo humano)
   Uso: incluir <script src="/js/suporte.js"> DEPOIS de supabase-config.js
   e chamar:  abrirSuporte({ userId, userNome, userTipo })
   userTipo: 'cliente' | 'prestador'  (userId opcional p/ cliente anônimo)
   ============================================================ */
(function () {
  const CSS = `
  .sup-ov{position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.45);display:none;align-items:flex-end;justify-content:center}
  .sup-ov.open{display:flex}
  .sup-sheet{background:#f4f5f7;width:100%;max-width:480px;height:86%;border-radius:24px 24px 0 0;display:flex;flex-direction:column;animation:supUp .3s ease;font-family:'Poppins',system-ui,sans-serif}
  @keyframes supUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}
  .sup-head{background:#0D0D0D;color:#fff;border-radius:24px 24px 0 0;padding:16px 18px;display:flex;align-items:center;gap:12px}
  .sup-head .av{width:42px;height:42px;border-radius:50%;background:#ffdd00;color:#0D0D0D;display:grid;place-items:center;font-size:18px;flex-shrink:0}
  .sup-head strong{font-size:15px;display:block} .sup-head small{font-size:11.5px;color:#9aa1ac}
  .sup-head .sup-x{margin-left:auto;width:36px;height:36px;border:none;background:#222;color:#fff;border-radius:50%;font-size:16px;cursor:pointer}
  .sup-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:9px}
  .sup-msg{max-width:82%;padding:11px 14px;border-radius:16px;font-size:14px;line-height:1.4;white-space:pre-wrap;word-break:break-word}
  .sup-msg.usuario{align-self:flex-end;background:#ffdd00;color:#0D0D0D;border-bottom-right-radius:5px}
  .sup-msg.bot{align-self:flex-start;background:#fff;color:#1a1a1a;border-bottom-left-radius:5px;box-shadow:0 2px 6px rgba(0,0,0,.06)}
  .sup-msg.atendente{align-self:flex-start;background:#0D0D0D;color:#fff;border-bottom-left-radius:5px}
  .sup-msg.atendente::before{content:'🎧 Atendente';display:block;font-size:10px;color:#ffdd00;font-weight:700;margin-bottom:3px}
  .sup-botoes{padding:0 16px 8px;display:flex;flex-direction:column;gap:7px}
  .sup-botoes button{text-align:left;border:1.5px solid #e3e5ea;background:#fff;border-radius:12px;padding:11px 13px;font-family:inherit;font-size:13.5px;font-weight:600;color:#15171c;cursor:pointer}
  .sup-botoes button:hover{border-color:#ffdd00}
  .sup-botoes .sup-humano{background:#fff3df;border-color:#ffd98a;color:#9a6b00;font-weight:700}
  .sup-input{background:#fff;padding:12px;display:flex;gap:10px;align-items:center;border-top:1px solid #eee}
  .sup-input input{flex:1;border:1.5px solid #ececf0;border-radius:999px;padding:12px 16px;font-family:inherit;font-size:14px;outline:none}
  .sup-input button{width:46px;height:46px;border-radius:50%;border:none;background:#ffdd00;color:#000;font-size:17px;cursor:pointer;flex-shrink:0}`;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  const ov = document.createElement('div'); ov.className = 'sup-ov'; ov.id = 'supOv';
  ov.innerHTML = `
    <div class="sup-sheet">
      <div class="sup-head">
        <div class="av"><i class="fa-solid fa-headset"></i></div>
        <div><strong>Suporte Busca Guincho</strong><small id="supStatus">Assistente virtual</small></div>
        <button class="sup-x" id="supX"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="sup-msgs" id="supMsgs"></div>
      <div class="sup-botoes" id="supBotoes"></div>
      <div class="sup-input"><input id="supInput" placeholder="Escreva sua mensagem..." autocomplete="off"><button id="supSend"><i class="fa-solid fa-paper-plane"></i></button></div>
    </div>`;
  document.body.appendChild(ov);

  const brl = (typeof fmtBRL === 'function') ? fmtBRL : (v) => 'R$ ' + Number(v||0).toFixed(2).replace('.', ',');
  function respostaPreco() {
    const c = (typeof PRECO_CATEGORIAS !== 'undefined') ? PRECO_CATEGORIAS : null;
    if (!c) return 'O valor final aparece na sua tela antes de você confirmar o chamado!';
    const km = (cat) => cat.fixo ? '(no local, valor fixo)' : `+ ${brl(cat.kmExcedente)}/km acima de 10km`;
    return 'Nosso cálculo é transparente! A Taxa de Saída já inclui os primeiros 10 km rodados:\n'
      + `• Guincho Leve: ${brl(c.guincho_leve.taxaSaida)} ${km(c.guincho_leve)}\n`
      + `• Guincho Pesado: ${brl(c.guincho_pesado.taxaSaida)} ${km(c.guincho_pesado)}\n`
      + `• Pane de Pneu/Roda (com reboque): ${brl(c.reboque_pneu_roda.taxaSaida)} ${km(c.reboque_pneu_roda)}\n`
      + `• Carga de Bateria/Pane Elétrica: ${brl(c.carga_bateria.taxaSaida)} ${km(c.carga_bateria)}\n`
      + 'O valor final aparece na sua tela antes de você confirmar! 😉';
  }
  const FAQ = [
    { q: 'Como funciona o preço do guincho?', a: respostaPreco },
    { q: 'Vocês trocam pneu furado no local?', a: () => 'Para garantir sua segurança na via, não fazemos a troca manual do pneu no local. O app envia um guincho que coloca o seu carro na plataforma e o leva com segurança até a borracharia mais próxima, pelo valor padrão de reboque.' },
    { q: 'Consigo reembolso no meu seguro?', a: () => 'Sim! Se o seu seguro tem a modalidade "Livre Escolha", basta solicitar o reembolso a eles. Ao final da corrida, geramos um PDF detalhado com o recibo do prestador e as fotos do atendimento, que serve como comprovação para a seguradora.' },
  ];

  let conversaId = null, canal = null, uTipo = 'cliente', uId = null, uNome = '';
  const som = new Audio('/audio/chat.mp3'); som.preload = 'auto';

  function addMsg(m) {
    const box = document.getElementById('supMsgs');
    const d = document.createElement('div'); d.className = 'sup-msg ' + (m.enviado_por || 'bot');
    d.textContent = m.texto || '';
    box.appendChild(d); box.scrollTop = box.scrollHeight;
  }
  function renderBotoes() {
    const box = document.getElementById('supBotoes');
    box.innerHTML = FAQ.map((f, i) => `<button data-faq="${i}">${f.q}</button>`).join('')
      + `<button class="sup-humano" data-humano="1">⚠️ Falar com atendente real</button>`;
    box.querySelectorAll('[data-faq]').forEach((b) => b.onclick = async () => {
      const f = FAQ[+b.dataset.faq];
      await enviar('usuario', f.q);
      await enviar('bot', typeof f.a === 'function' ? f.a() : f.a);
    });
    box.querySelector('[data-humano]').onclick = chamarAtendente;
  }
  async function enviar(por, texto) {
    addMsg({ enviado_por: por, texto });
    await sb.from('suporte_mensagens').insert({ conversa_id: conversaId, enviado_por: por, texto });
  }
  async function chamarAtendente() {
    await sb.from('suporte_conversas').update({ status: 'humano', updated_at: new Date().toISOString() }).eq('id', conversaId);
    document.getElementById('supStatus').textContent = 'Aguardando atendente humano...';
    document.getElementById('supBotoes').innerHTML = '';
    await enviar('bot', 'Entendi. Estou chamando um de nossos operadores. Por favor, aguarde um momento na tela... ⏳');
  }

  window.abrirSuporte = async function (opts) {
    opts = opts || {};
    if (typeof sb === 'undefined' || !sb) { alert('Suporte indisponível no momento.'); return; }
    uTipo = opts.userTipo || 'cliente';
    uNome = opts.userNome || (uTipo === 'prestador' ? 'Prestador' : 'Cliente');
    uId = opts.userId || localStorage.getItem('bg_suporte_uid') || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    if (uTipo === 'cliente') localStorage.setItem('bg_suporte_uid', uId);
    ov.classList.add('open');
    const box = document.getElementById('supMsgs'); box.innerHTML = '<div class="sup-msg bot">Carregando...</div>';

    // acha a conversa do usuário ou cria
    const { data: cs } = await sb.from('suporte_conversas').select('*').eq('user_id', uId).order('updated_at', { ascending: false }).limit(1);
    if (cs && cs.length) { conversaId = cs[0].id; document.getElementById('supStatus').textContent = cs[0].status === 'humano' ? 'Aguardando atendente humano...' : 'Assistente virtual'; }
    else {
      const { data: nv } = await sb.from('suporte_conversas').insert({ user_id: uId, user_nome: uNome, user_tipo: uTipo, status: 'bot' }).select('id').single();
      conversaId = nv.id; document.getElementById('supStatus').textContent = 'Assistente virtual';
    }
    // histórico
    const { data: msgs } = await sb.from('suporte_mensagens').select('*').eq('conversa_id', conversaId).order('created_at', { ascending: true });
    box.innerHTML = '';
    if (!msgs || !msgs.length) addMsg({ enviado_por: 'bot', texto: `Olá, ${uNome.split(' ')[0]}! 👋 Sou o assistente do Busca Guincho. Toque numa dúvida abaixo ou fale com um atendente.` });
    (msgs || []).forEach(addMsg);
    renderBotoes();

    if (canal) sb.removeChannel(canal);
    canal = sb.channel('sup-' + conversaId).on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'suporte_mensagens', filter: `conversa_id=eq.${conversaId}` }, (p) => {
        if (p.new.enviado_por === 'atendente') {
          addMsg(p.new); try { som.currentTime = 0; som.play().catch(()=>{}); } catch (e) {}
          document.getElementById('supStatus').textContent = 'Em atendimento com operador';
        }
      }).subscribe();
  };

  document.getElementById('supX').onclick = () => { ov.classList.remove('open'); if (canal) { sb.removeChannel(canal); canal = null; } };
  async function enviarTexto() {
    const inp = document.getElementById('supInput'); const t = inp.value.trim(); if (!t || !conversaId) return;
    inp.value = ''; await enviar('usuario', t);
    // se ainda no bot, dá um empurrão pras opções
    const { data } = await sb.from('suporte_conversas').select('status').eq('id', conversaId).single();
    if (data && data.status === 'bot') await enviar('bot', 'Posso ajudar com uma das opções acima 👆 ou, se preferir, toque em "Falar com atendente real".');
  }
  document.getElementById('supSend').onclick = enviarTexto;
  document.getElementById('supInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') enviarTexto(); });
})();
