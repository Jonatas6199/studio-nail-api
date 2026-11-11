export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.PUSH_WORKER_ENABLED === "true") {
    const { startPushWorker } = await import("./lib/push-worker");
    try { await startPushWorker(); } catch { console.error("[reminders] Worker could not start. Check private configuration."); }
  }
}
