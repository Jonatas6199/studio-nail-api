import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const config = getConfig();
  const origin = config?.appUrl ?? new URL(request.url).origin;
  const query = new URL(request.url).searchParams;
  const token = query.get("token_hash"); const type = query.get("type");
  if (config && token && (type === "recovery" || type === "invite")) {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.verifyOtp({ token_hash: token, type });
    if (!error) return NextResponse.redirect(`${origin}/redefinir-senha`);
  }
  return NextResponse.redirect(`${origin}/login?link=invalido`);
}
