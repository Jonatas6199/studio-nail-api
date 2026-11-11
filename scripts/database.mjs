import { Client } from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";

try { process.loadEnvFile(".env.local"); } catch {}
const action = process.argv[2] ?? "inspect";
if (!process.env.DIRECT_URL) throw new Error("Configure DIRECT_URL em .env.local.");
let address;
try { address = new URL(process.env.DIRECT_URL); }
catch { console.error("DIRECT_URL inválida. Confira a configuração local."); process.exit(1); }
const client = new Client({
  host: address.hostname, port: Number(address.port || 5432), database: address.pathname.slice(1),
  user: decodeURIComponent(address.username), password: decodeURIComponent(address.password),
  ssl: { rejectUnauthorized: true, ca: await readFile(new URL('../supabase/prod-ca-2021.crt', import.meta.url), 'utf8') }, connectionTimeoutMillis: 15_000, statement_timeout: 30_000,
});
try {
  await client.connect();
  if (action === "inspect") {
    const tables = await client.query("select tablename from pg_tables where schemaname = 'public' order by tablename");
    const account = await client.query("select id from auth.users where lower(email) = lower($1)", [process.env.SUPABASE_OWNER_EMAIL]);
    console.log(JSON.stringify({ connected: true, publicTables: tables.rows.map(r => r.tablename), accountExists: account.rowCount > 0 }));
  } else if (action === "migrate") {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(1207112026)");
    await client.query("create schema if not exists nail_private");
    await client.query("revoke all on schema nail_private from public, anon, authenticated");
    await client.query("create table if not exists nail_private.migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())");
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const files = (await readdir(directory)).filter(f => /^\d+_[a-z_]+\.sql$/.test(f)).sort();
    for (const file of files) {
      const migration = file.slice(0,-4);
      const sql = await readFile(new URL(file,directory), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await client.query("select checksum from nail_private.migrations where name=$1", [migration]);
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum) throw new Error("A migração aplicada tem outro conteúdo. Crie uma nova migração.");
        continue;
      }
      const statements = sql.replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, "");
      await client.query(statements);
      await client.query("insert into nail_private.migrations(name,checksum) values($1,$2)", [migration,checksum]);
      console.log(`Migração aplicada: ${migration}`);
    }
    await client.query("commit");
  } else if (action === "provision") {
    const user = await client.query("select id from auth.users where lower(email) = lower($1) and email_confirmed_at is not null", [process.env.SUPABASE_OWNER_EMAIL]);
    if (user.rowCount !== 1) throw new Error("Crie ou convide a conta autorizada em Supabase > Authentication > Users e confirme o e-mail antes de liberar o acesso.");
    await client.query("insert into public.nail_accounts(owner_id) values($1) on conflict(owner_id) do nothing", [user.rows[0].id]);
    console.log("Conta autorizada vinculada ao ateliê, sem importar dados de exemplo.");
  } else if (action === "verify") {
    const rows = await client.query("select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'nail_%' order by tablename");
    const protectedTables = rows.rows.length === 11 && rows.rows.every(r => r.rowsecurity);
    if (!protectedTables) throw new Error("As tabelas não passaram na verificação de RLS.");
    const account = await client.query("select a.owner_id from public.nail_accounts a join auth.users u on u.id=a.owner_id where lower(u.email)=lower($1) and a.active", [process.env.SUPABASE_OWNER_EMAIL]);
    if (account.rowCount !== 1) throw new Error("A conta autorizada não foi vinculada.");
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [account.rows[0].owner_id]);
    await client.query("set local role authenticated");
    const current = (await client.query("select public.nail_read_workspace() as workspace")).rows[0].workspace;
    const before = current.revision;
    const expenseId = randomUUID(), receipt = randomUUID();
    const command = { type: "expense.add", expense: { id: expenseId, description: "Verificação transacional (revertida)", amount: 2550, date: "2026-11-11", category: "Insumos", method: "Pix" } };
    const saved = (await client.query("select public.nail_apply_command($1,$2,$3::jsonb) as workspace", [receipt, before, JSON.stringify(command)])).rows[0].workspace;
    const repeated = (await client.query("select public.nail_apply_command($1,$2,$3::jsonb) as workspace", [receipt, before, JSON.stringify(command)])).rows[0].workspace;
    if (saved.revision !== before + 1 || repeated.data.expenses.filter(e => e.id === expenseId).length !== 1) throw new Error("Falha no controle de versão ou repetição.");
    await client.query("savepoint foreign_account");
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [randomUUID()]);
    let denied = false;
    try { await client.query("select public.nail_read_workspace()"); } catch (e) { denied = e.code === "42501"; }
    await client.query("rollback to savepoint foreign_account");
    if (!denied) throw new Error("Uma conta não autorizada conseguiu acessar o ateliê.");
    await client.query("rollback");
    console.log(JSON.stringify({ protectedTables: 11, ownerAccess: true, otherAccountsDenied: true, idempotency: true, temporaryWriteRolledBack: true }));
  } else throw new Error("Ação desconhecida.");
} catch (error) {
  try { await client.query("rollback"); } catch {}
  // Do not print connection strings, query parameters, or nested connection errors.
  console.error(error.code ? `Falha de conexão/operação (${error.code}). Nenhuma credencial foi exibida.` : error.message);
  process.exitCode = 1;
} finally { await client.end(); }
