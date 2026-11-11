import { NextResponse } from "next/server";
import { mutationSchema } from "@/lib/commands";
import { getConfig } from "@/lib/config";
import { AccessError, authenticatedSupabase, readWorkspace } from "@/lib/supabase/workspace";

const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  if (!getConfig()) return response({ message: "A conexão com o Supabase ainda não foi configurada." }, 503);
  try { return response(await readWorkspace()); }
  catch (error) { return response({ message: error instanceof AccessError ? error.message : "Não foi possível carregar seus dados." }, error instanceof AccessError ? error.status : 503); }
}

export async function POST(request: Request) {
  const config = getConfig();
  if (!config) return response({ message: "A conexão com o Supabase ainda não foi configurada." }, 503);
  if (request.headers.get("origin") !== config.appUrl) return response({ message: "Origem da solicitação não permitida." }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return response({ message: "Formato de solicitação inválido." }, 415);
  try {
    const supabase = await authenticatedSupabase();
    const body = await request.text();
    if (body.length > 256_000) return response({ message: "A solicitação é muito grande." }, 413);
    let json: unknown;
    try { json = JSON.parse(body); } catch { return response({ message: "Dados inválidos." }, 400); }
    const parsed = mutationSchema.safeParse(json);
    if (!parsed.success) return response({ message: "Confira os campos informados antes de salvar." }, 400);
    const { requestId, revision, command } = parsed.data;
    const { data, error } = await supabase.rpc("nail_apply_command", { p_request_id: requestId, p_revision: revision, p_command: command });
    if (error) {
      const messages: Record<string, [string, number]> = {
        STALE_REVISION: ["Seus dados mudaram em outra tela. Atualizamos a agenda; confira e salve novamente.", 409],
        OVERLAP: ["Este horário conflita com outro atendimento. Edite o agendamento e confirme a sobreposição.", 422],
        INVALID_PAYMENT: ["Este recebimento não foi encontrado. Atualize o atendimento.", 422],
        PAYMENT_EXCEEDS_TOTAL: ["O recebimento ultrapassa o saldo pendente.", 422],
        PRICE_BELOW_PAID: ["O valor do atendimento não pode ser menor que o total já recebido.", 422],
        INACTIVE_APPOINTMENT: ["Este atendimento foi cancelado ou marcado como não compareceu.", 422],
        PROCEDURE_UNAVAILABLE: ["Um procedimento foi arquivado ou não está disponível. Confira sua seleção.", 422],
        REQUEST_REUSED: ["Não foi possível repetir esta operação. Atualize a página.", 409],
        MESSAGE_CHANGED: ["Os dados deste atendimento mudaram. Atualize a mensagem antes de marcar o envio.", 409],
      };
      const match = messages[error.message];
      if (error.code === "42501") return response({ message: "Esta conta não tem acesso a este ateliê." }, 403);
      if (match) return response({ message: match[0], code: error.message }, match[1]);
      return response({ message: "Não foi possível salvar. Confira os dados e tente novamente." }, error.code?.startsWith("23") || error.code === "22023" ? 422 : 503);
    }
    return response(data);
  } catch (error) { return response({ message: error instanceof AccessError ? error.message : "Não foi possível salvar. Tente novamente." }, error instanceof AccessError ? error.status : 503); }
}
