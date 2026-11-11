import "server-only";
import { createSupabase } from "./server";
import type { Workspace } from "../commands";

export class AccessError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function authenticatedSupabase() {
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) throw new AccessError(401, "Sua sessão expirou. Entre novamente.");
  return supabase;
}

export async function readWorkspace(): Promise<Workspace> {
  const supabase = await authenticatedSupabase();
  const { data, error } = await supabase.rpc("nail_read_workspace");
  if (error) {
    if (error.code === "42501") throw new AccessError(403, "Esta conta não tem acesso a este ateliê.");
    throw new AccessError(503, "Não foi possível carregar seus dados. Tente novamente.");
  }
  return data as Workspace;
}
