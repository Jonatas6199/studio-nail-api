import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { createSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const config = getConfig();
  const origin = config?.appUrl ?? new URL(request.url).origin;
  const code = new URL(request.url).searchParams.get("code");
  if (config && code) {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/redefinir-senha`);
  }
  return NextResponse.redirect(`${origin}/login?link=invalido`);
}
