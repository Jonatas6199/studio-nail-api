import { AuthScreen } from "@/components/auth-screen";
import { getConfig } from "@/lib/config";
import { SetupScreen } from "@/components/setup-screen";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!getConfig()) return <SetupScreen />;
  const query = await searchParams;
  return <AuthScreen passwordUpdated={query.senha === "atualizada"} invalidLink={query.link === "invalido"} />;
}
