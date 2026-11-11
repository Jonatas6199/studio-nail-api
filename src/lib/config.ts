export function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  const appUrl = process.env.APP_URL ?? (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3335" : undefined);
  if (!url || !key || !appUrl || url.includes("SEU-PROJETO") || key.includes("SUBSTITUA")) return null;
  try {
    const project = new URL(url); const app = new URL(appUrl);
    if (project.protocol !== "https:" || (process.env.NODE_ENV === "production" && app.protocol !== "https:")) return null;
    if (key.startsWith("sb_secret_")) return null;
    if (key.split(".").length === 3) {
      const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
      if (payload.role !== "anon") return null;
    } else if (!key.startsWith("sb_publishable_")) return null;
    return { url: project.origin, key, appUrl: app.origin };
  } catch { return null; }
}
