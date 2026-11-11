import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { pushRequest } from "@/lib/push-schema";
import { pushConfig, sendPush } from "@/lib/push-server";
import { AccessError, authenticatedSupabase } from "@/lib/supabase/workspace";
import type { PushSubscription } from "web-push";

const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
let lastTestAt = 0;
export async function GET() {
  try {
    const supabase = await authenticatedSupabase();
    const { error } = await supabase.rpc("nail_push_subscription", { p_action: "status", p_subscription: { endpoint: "" } });
    if (error) return response({ message: "Notificações indisponíveis." }, 403);
    const config = pushConfig();
    return response({ available: !!config && process.env.PUSH_WORKER_ENABLED === "true", publicKey: config?.publicKey ?? null });
  } catch (e) { return response({ message: "Entre na sua conta para configurar os avisos." }, e instanceof AccessError ? e.status : 503); }
}
export async function POST(request: Request) {
  const config = getConfig();
  if (!config) return response({ message: "Configuração indisponível." }, 503);
  if (request.headers.get("origin") !== config.appUrl) return response({ message: "Origem não permitida." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return response({ message: "Formato inválido." }, 415);
  try {
    const supabase = await authenticatedSupabase();
    const body = await request.text();
    if (body.length > 8000) return response({ message: "Solicitação muito grande." }, 413);
    let parsed;
    try { parsed = pushRequest.safeParse(JSON.parse(body)); } catch { return response({ message: "Dados inválidos." }, 400); }
    if (!parsed.success) return response({ message: "Não foi possível validar este aparelho." }, 400);
    const input = parsed.data;
    const subscription = input.action === "save" ? input.subscription : { endpoint: input.endpoint };
    const { data, error } = await supabase.rpc("nail_push_subscription", { p_action: input.action, p_subscription: subscription });
    if (error) return response({ message: error.message === "TOO_MANY_DEVICES" ? "O limite é de cinco aparelhos. Desative um deles antes de adicionar outro." : "Não foi possível atualizar as notificações." }, error.code === "42501" ? 403 : 422);
    if (input.action === "test") {
      if (!data) return response({ message: "Ative as notificações neste aparelho primeiro." }, 422);
      if (Date.now() - lastTestAt < 30_000) return response({ message: "Aguarde 30 segundos para enviar outro teste." }, 429);
      lastTestAt = Date.now();
      try { await sendPush(data as PushSubscription); }
      catch { return response({ message: "Não foi possível entregar o teste. Desative e ative as notificações para tentar novamente." }, 503); }
      return response({ sent: true });
    }
    return response(data);
  } catch (e) { return response({ message: "Não foi possível configurar os avisos. Tente novamente." }, e instanceof AccessError ? e.status : 503); }
}
