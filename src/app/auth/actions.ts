"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getConfig } from "@/lib/config";
import { createSupabase } from "@/lib/supabase/server";

export type AuthState = { message: string; success?: boolean };
const emailSchema = z.email().max(254);

export async function signIn(_previous: AuthState, form: FormData): Promise<AuthState> {
  if (!getConfig()) return { message: "A conexão de acesso ainda não foi configurada." };
  const email = emailSchema.safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  const password = String(form.get("password") ?? "");
  if (!email.success || !password || password.length > 256) return { message: "Informe um e-mail válido e sua senha." };
  try {
    const supabase = await createSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.data, password });
    if (error || !data.user) return { message: "Não foi possível entrar. Confira seu e-mail e senha." };
    const { data: account, error: accessError } = await supabase.from("nail_accounts").select("owner_id").eq("owner_id", data.user.id).eq("active", true).maybeSingle();
    if (accessError || !account) { await supabase.auth.signOut({ scope: "local" }); return { message: "Esta conta ainda não tem acesso liberado ao ateliê." }; }
  } catch { return { message: "Não foi possível conectar. Tente novamente em alguns instantes." }; }
  redirect("/");
}

export async function signOut() {
  if (getConfig()) { const supabase = await createSupabase(); await supabase.auth.signOut({ scope: "local" }); }
  redirect("/login");
}

export async function requestRecovery(_previous: AuthState, form: FormData): Promise<AuthState> {
  const config = getConfig();
  if (!config) return { message: "A conexão de acesso ainda não foi configurada." };
  const email = emailSchema.safeParse(String(form.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { message: "Informe um e-mail válido." };
  const generic = { message: "Se este e-mail estiver autorizado, você receberá um link para redefinir sua senha. Confira também a caixa de spam.", success: true };
  if (email.data !== process.env.SUPABASE_OWNER_EMAIL?.trim().toLowerCase()) return generic;
  try {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${config.appUrl}/auth/callback` });
    if (error) return { message: "Não foi possível solicitar o link agora. Aguarde e tente novamente. Se o problema continuar, verifique o envio de e-mails da conta." };
    return generic;
  } catch { return { message: "Não foi possível conectar. Tente novamente em alguns instantes." }; }
}

export async function updatePassword(_previous: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 12 || password.length > 128) return { message: "Use uma senha entre 12 e 128 caracteres." };
  if (password !== String(form.get("confirm") ?? "")) return { message: "As senhas precisam ser iguais." };
  try {
    const supabase = await createSupabase();
    const { data: claims, error } = await supabase.auth.getClaims();
    if (error || !claims?.claims?.sub) return { message: "Seu link expirou. Solicite outro link para redefinir a senha." };
    const { data: account } = await supabase.from("nail_accounts").select("owner_id").eq("owner_id", claims.claims.sub).eq("active", true).maybeSingle();
    if (!account) return { message: "Esta conta ainda não tem acesso liberado ao ateliê." };
    const { error: saveError } = await supabase.auth.updateUser({ password });
    if (saveError) return { message: "Não foi possível atualizar. Use uma senha diferente e tente novamente." };
    await supabase.auth.signOut({ scope: "local" });
  } catch { return { message: "Não foi possível conectar. Tente novamente." }; }
  redirect("/login?senha=atualizada");
}
