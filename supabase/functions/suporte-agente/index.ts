// ============================================================
// Agente de IA do Suporte — Busca Guincho (Supabase Edge Function + Gemini)
// Function Calling: status do chamado, extrato do prestador, transbordo humano.
// Deploy:  supabase functions deploy suporte-agente --no-verify-jwt
// Secret:  supabase secrets set GEMINI_API_KEY=xxxxx
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "gemini-2.5-flash";  // 2.0 está com cota 0 no projeto; 2.5-flash tem free tier

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (obj: unknown, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ---- Ferramentas expostas ao Gemini ----
const TOOLS = [{
  functionDeclarations: [
    {
      name: "verificar_status_chamado",
      description: "Consulta o atendimento/chamado mais recente do CLIENTE e diz onde o guincho está (status, serviço, destino).",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "verificar_extrato_prestador",
      description: "Lista as últimas corridas, o ganho líquido e os saques pendentes do PRESTADOR.",
      parameters: { type: "object", properties: {} },
    },
    {
      name: "acionar_suporte_humano",
      description: "Transfere a conversa para um atendente humano quando não conseguir resolver, o usuário pedir explicitamente, ou demonstrar forte irritação.",
      parameters: { type: "object", properties: { motivo: { type: "string", description: "Motivo do transbordo" } } },
    },
  ],
}];

const BASE =
  "Você é o assistente virtual do Busca Guincho, plataforma de guincho/reboque no Rio de Janeiro. " +
  "Responda em português do Brasil, de forma curta, gentil e objetiva (máx. 4 linhas). " +
  "Use as ferramentas quando precisar de dados reais. Se não resolver, se o usuário pedir um humano, " +
  "ou se demonstrar forte irritação, chame a função acionar_suporte_humano.";

function promptCliente(nome: string) {
  return `${BASE}\nVocê fala com um CLIENTE (${nome}). Foco: acalmar, explicar preços ` +
    `(Taxa de saída R$ 170 + R$ 8/km para guincho/pneu, já com os primeiros 10 km inclusos), prazo de chegada, ` +
    `pagamento via PagBank e o PDF com fotos para reembolso do seguro. Para saber onde está o guincho, use verificar_status_chamado.`;
}
function promptPrestador(nome: string) {
  return `${BASE}\nVocê fala com um PRESTADOR/parceiro (${nome}). Foco: dúvidas operacionais, o split da plataforma ` +
    `(15% + R$ 5 fixos por corrida), como vincular a conta PagBank e regras de segurança (PINs de retirada e entrega). ` +
    `Para saldo/repasses, use verificar_extrato_prestador.`;
}

async function chamarGemini(sys: string, contents: unknown[]) {
  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents,
    tools: TOOLS,
    generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
  };
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  return await res.json();
}

// deno-lint-ignore no-explicit-any
async function executarFuncao(sb: any, conversa: any, nome: string) {
  if (nome === "verificar_status_chamado") {
    let q = sb.from("chamados")
      .select("status,servico_solicitado,endereco_destino,created_at,ganho_prestador")
      .order("created_at", { ascending: false }).limit(1);
    if (conversa.user_ref) q = q.eq("telefone_cliente", conversa.user_ref);
    else q = q.eq("cliente_id", conversa.user_id);
    const { data } = await q;
    if (!data || !data.length) return { encontrado: false, msg: "Nenhum chamado recente encontrado para este cliente." };
    const c = data[0];
    const mapa: Record<string, string> = {
      Pendente: "procurando um guincho", Notificando: "aguardando um guincho aceitar",
      Aceito: "aceito pelo guincho", "A Caminho": "a caminho do seu local",
      Chegou: "no seu local", Iniciado: "levando o veículo ao destino", Finalizado: "concluído",
    };
    return { encontrado: true, status: c.status, situacao: mapa[c.status] || c.status, servico: c.servico_solicitado, destino: c.endereco_destino };
  }
  if (nome === "verificar_extrato_prestador") {
    const pid = conversa.user_id;
    const { data: fin } = await sb.from("chamados")
      .select("ganho_prestador,created_at").eq("prestador_id", pid).eq("status", "Finalizado")
      .order("created_at", { ascending: false }).limit(5);
    const total = (fin || []).reduce((s: number, c: any) => s + Number(c.ganho_prestador || 0), 0);
    const { data: sq } = await sb.from("saques").select("valor,status").eq("prestador_id", pid);
    const pend = (sq || []).filter((s: any) => s.status === "Pendente").reduce((s: number, x: any) => s + Number(x.valor || 0), 0);
    return { ultimas_corridas: (fin || []).length, ganho_ultimas: total.toFixed(2), saques_em_analise: pend.toFixed(2) };
  }
  if (nome === "acionar_suporte_humano") {
    await sb.from("suporte_conversas").update({ status: "humano", updated_at: new Date().toISOString() }).eq("id", conversa.id);
    return { ok: true };
  }
  return { erro: "função desconhecida" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { conversa_id } = await req.json();
    if (!conversa_id) return json({ erro: "conversa_id obrigatório" }, 400);
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: conversa } = await sb.from("suporte_conversas").select("*").eq("id", conversa_id).single();
    if (!conversa) return json({ erro: "conversa não encontrada" }, 404);
    if (conversa.status === "humano") return json({ reply: null, status: "humano" });

    // histórico (já inclui a última mensagem do usuário, inserida pelo front antes de chamar)
    const { data: msgs } = await sb.from("suporte_mensagens")
      .select("enviado_por,texto").eq("conversa_id", conversa_id)
      .order("created_at", { ascending: true }).limit(14);

    const contents: any[] = (msgs || [])
      .filter((m: any) => m.texto)
      .map((m: any) => ({ role: m.enviado_por === "usuario" ? "user" : "model", parts: [{ text: m.texto }] }));
    if (!contents.length) return json({ reply: "Olá! Como posso ajudar?", status: "bot" });

    const ehPrestador = conversa.user_tipo === "prestador";
    const sys = ehPrestador ? promptPrestador(conversa.user_nome || "parceiro") : promptCliente(conversa.user_nome || "cliente");

    let reply = "", status = "bot";
    for (let i = 0; i < 4; i++) {
      const r = await chamarGemini(sys, contents);
      const cand = r?.candidates?.[0];
      const parts = cand?.content?.parts || [];
      const fc = parts.find((p: any) => p.functionCall)?.functionCall;
      if (fc) {
        contents.push({ role: "model", parts: [{ functionCall: fc }] });
        const resultado = await executarFuncao(sb, conversa, fc.name);
        if (fc.name === "acionar_suporte_humano") status = "humano";
        contents.push({ role: "user", parts: [{ functionResponse: { name: fc.name, response: { resultado } } }] });
        continue;
      }
      reply = parts.map((p: any) => p.text).filter(Boolean).join("\n") || "Desculpe, pode reformular?";
      break;
    }
    if (!reply) reply = "Desculpe, tive um problema. Pode tentar de novo?";

    await sb.from("suporte_mensagens").insert({ conversa_id, enviado_por: "bot", texto: reply });
    await sb.from("suporte_conversas").update({
      updated_at: new Date().toISOString(),
      ...(status === "humano" ? { status: "humano" } : {}),
    }).eq("id", conversa_id);

    return json({ reply, status });
  } catch (e) {
    return json({ erro: String(e) }, 500);
  }
});
