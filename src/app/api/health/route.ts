import { getConfig } from "@/lib/config";

export async function GET() {
  const ready = !!getConfig();
  return Response.json({ status: ready ? "ok" : "not_configured" }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
