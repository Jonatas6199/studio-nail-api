import "server-only";
import * as webpush from "web-push";
import { getConfig } from "./config";
import { trustedPushEndpoint } from "./push-schema";

export function pushConfig() {
  const publicKey = process.env.PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.PUSH_VAPID_PRIVATE_KEY;
  const app = getConfig();
  return publicKey && privateKey && app ? { publicKey, privateKey, subject: app.appUrl } : null;
}
export async function sendPush(subscription: webpush.PushSubscription, count?: number) {
  const config = pushConfig();
  if (!config || !trustedPushEndpoint(subscription.endpoint)) throw new Error("PUSH_UNAVAILABLE");
  const payload = JSON.stringify({ title: count ? "Lembretes do ateliê" : "Notificações ativadas ✨", body: count ? `Você tem ${count} lembrete${count === 1 ? "" : "s"} para enviar às clientes. Toque para preparar as mensagens.` : "Tudo pronto para avisar você dos lembretes. O envio às clientes continua manual.", url: "/#lembretes", tag: "atelie-reminders" });
  return webpush.sendNotification(subscription, payload, { vapidDetails: config, TTL: 3600, urgency: "normal", timeout: 10_000 });
}
