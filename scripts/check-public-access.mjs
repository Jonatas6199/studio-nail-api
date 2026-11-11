try { process.loadEnvFile(".env.local"); } catch {}
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Configure a URL e a chave pública do projeto.");
try {
  const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  const body = await settings.json();
  if (!settings.ok || !body.external?.email) throw new Error("A autenticação por e-mail não está disponível.");
  const rpc = await fetch(`${url}/rest/v1/rpc/nail_read_workspace`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: "{}" });
  if (rpc.status !== 401 && rpc.status !== 403) throw new Error("A consulta sem sessão não foi bloqueada.");
  console.log(JSON.stringify({ authAvailable: true, anonymousDataAccessDenied: true, anonymousStatus: rpc.status, publicSignupEnabled: !body.disable_signup }));
} catch (e) { console.error(e.cause?.code ? `Não foi possível verificar a conexão (${e.cause.code}).` : e.message); process.exitCode = 1; }
