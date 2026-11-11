import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getConfig } from "../config";

export async function createSupabase() {
  const config = getConfig();
  if (!config) throw new Error("SUPABASE_NOT_CONFIGURED");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => {
        try { values.forEach(({ name, value, options }) => jar.set(name, value, options)); }
        catch { /* Server Components read cookies; Proxy performs token refresh. */ }
      },
    },
  });
}
