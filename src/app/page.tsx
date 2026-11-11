import { Studio } from "@/components/studio";
import { redirect } from "next/navigation";
import { getConfig } from "@/lib/config";
import { AccessError, readWorkspace } from "@/lib/supabase/workspace";
import { SetupScreen } from "@/components/setup-screen";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!getConfig()) return <SetupScreen />;
  let workspace;
  try { workspace = await readWorkspace(); }
  catch (error) {
    if (error instanceof AccessError && error.status === 401) redirect("/login");
    return <SetupScreen message={error instanceof AccessError ? error.message : "Não foi possível conectar ao seu ateliê."} />;
  }
  return <Studio initialWorkspace={workspace} />;
}
