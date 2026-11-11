import { z } from "zod";

export function trustedPushEndpoint(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && (u.hostname === "fcm.googleapis.com" || /^(?:[a-z0-9-]+\.)*push\.apple\.com$/.test(u.hostname) || /^(?:[a-z0-9-]+\.)*push\.services\.mozilla\.com$/.test(u.hostname));
  } catch { return false; }
}
const endpoint = z.string().max(2048).refine(trustedPushEndpoint);
export const pushRequest = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), subscription: z.object({ endpoint, expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/), auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/) }).strict() }).strict() }).strict(),
  z.object({ action: z.enum(["remove", "status", "test"]), endpoint }).strict(),
]);
