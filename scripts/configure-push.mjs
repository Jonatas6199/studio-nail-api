import { Client } from "pg";
import * as webpush from "web-push";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";

process.loadEnvFile(".env.local");
const action = process.argv[2] ?? "provision";
if (action === "deploy-env") {
  const values = Object.fromEntries(["PUSH_VAPID_PUBLIC_KEY","PUSH_VAPID_PRIVATE_KEY","PUSH_DATABASE_URL"].map(name => [name,process.env[name]]));
  if (Object.values(values).some(v => !v)) throw new Error("Configure as notificações primeiro.");
  // Only consume this output in-memory in the deployment tool; never print it to the conversation.
  process.stdout.write(JSON.stringify({...values,PUSH_WORKER_ENABLED:"true"}));
} else {
  const url = new URL(process.env.DIRECT_URL);
  const connection = {host:url.hostname,port:Number(url.port||5432),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:url.pathname.slice(1),ssl:{rejectUnauthorized:true,ca:await readFile(new URL("../supabase/prod-ca-2021.crt",import.meta.url),"utf8")},connectionTimeoutMillis:15000,statement_timeout:15000};
  const client = new Client(connection);
  try {
    await client.connect();
    const keys = process.env.PUSH_VAPID_PUBLIC_KEY && process.env.PUSH_VAPID_PRIVATE_KEY ? {publicKey:process.env.PUSH_VAPID_PUBLIC_KEY,privateKey:process.env.PUSH_VAPID_PRIVATE_KEY} : webpush.generateVAPIDKeys();
    const password = process.env.PUSH_DATABASE_URL ? decodeURIComponent(new URL(process.env.PUSH_DATABASE_URL).password) : randomBytes(32).toString("base64url");
    if (!/^[A-Za-z0-9_-]{40,64}$/.test(password)) throw new Error("Formato de credencial inválido.");
    await client.query(`alter role nail_push_worker login noinherit nocreatedb nocreaterole connection limit 3 password '${password}'`);
    await client.query("grant connect on database postgres to nail_push_worker");
    const permission=await client.query("select has_table_privilege('nail_push_worker','public.nail_clients','select') as reads_clients, has_function_privilege('nail_push_worker','public.nail_read_workspace()','execute') as reads_workspace");
    if (permission.rows[0].reads_clients || permission.rows[0].reads_workspace) throw new Error("O worker tem privilégios além do necessário.");
    const workerUrl=new URL(url);workerUrl.port="6543";workerUrl.username=`nail_push_worker.${url.username.split('.').slice(1).join('.')}`;workerUrl.password=password;workerUrl.search="";
    const worker = new Client({...connection,port:6543,user:decodeURIComponent(workerUrl.username),password});
    try { await worker.connect(); await worker.query("select public.nail_claim_push(1)"); }
    finally { await worker.end(); }
    const additions={PUSH_VAPID_PUBLIC_KEY:keys.publicKey,PUSH_VAPID_PRIVATE_KEY:keys.privateKey,PUSH_DATABASE_URL:workerUrl.toString(),PUSH_WORKER_ENABLED:"false"};
    let content=await readFile(".env.local","utf8");
    for (const [name,value] of Object.entries(additions)) { const line=`${name}=${value}`;const pattern=new RegExp(`^${name}=.*$`,"m"); content=pattern.test(content)?content.replace(pattern,()=>line):content.trimEnd()+"\n"+line+"\n"; }
    await writeFile(".env.local",content,{mode:0o600});await chmod(".env.local",0o600);
    console.log(JSON.stringify({configured:true,workerConnectionVerified:true,workerCannotReadClients:true,workerCannotReadWorkspace:true,localWorkerDisabled:true}));
  } catch (e) { console.error(e.code ? `Falha na configuração (${e.code}). Credenciais preservadas.` : e.message); process.exitCode=1; }
  finally { await client.end(); }
}
