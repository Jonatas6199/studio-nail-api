import "server-only";
import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PushSubscription } from "web-push";
import { sendPush, pushConfig } from "./push-server";

type Job = { id: string; subscription: PushSubscription; items: { appointmentId: string; fingerprint: string }[] };
export async function startPushWorker() {
  if (!process.env.PUSH_DATABASE_URL || !pushConfig()) return;
  const url = new URL(process.env.PUSH_DATABASE_URL);
  const pool = new Pool({ host: url.hostname, port: Number(url.port || 6543), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: url.pathname.slice(1), max: 1, idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000, statement_timeout: 10_000, ssl: { rejectUnauthorized: true, ca: await readFile(path.join(process.cwd(), "supabase/prod-ca-2021.crt"), "utf8") } });
  pool.on("error", () => console.error("[reminders] Database connection interrupted; will retry."));
  let running = false;
  async function tick() {
    if (running) return;
    running = true;
    try {
      const result = await pool.query<{ jobs: Job[] }>("select public.nail_claim_push(20) as jobs");
      for (const job of result.rows[0].jobs) {
        let outcome = "delivered";
        try { await sendPush(job.subscription, job.items.length); }
        catch (error) { const status = (error as { statusCode?: number }).statusCode; outcome = status === 404 || status === 410 ? "expired" : "retry"; }
        await pool.query("select public.nail_complete_push($1,$2::jsonb,$3)", [job.id, JSON.stringify(job.items), outcome]);
        console.info(`[reminders] Notification ${outcome}; ${job.items.length} pending.`);
      }
    } catch { console.error("[reminders] Check failed; will retry. No customer data logged."); }
    finally { running = false; }
  }
  void tick();
  setInterval(() => void tick(), 60_000).unref();
}
