import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth-screen";
import { getConfig } from "@/lib/config";
import { createSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPage() {
  if (!getConfig()) redirect("/login");
  const supabase = await createSupabase();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login?link=invalido");
  return <AuthScreen reset />;
}
