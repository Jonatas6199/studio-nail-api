self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
// No page/API cache: authenticated data must always come from the server.
self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  event.waitUntil(self.registration.showNotification(data.title || "Lembretes do ateliê", {
    body: data.body || "Abra o ateliê para conferir os lembretes pendentes.",
    icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "atelie-reminders",
    data: { url: "/#lembretes" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL("/#lembretes", self.location.origin).href;
    const tabs = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin) { await tab.navigate(url); return tab.focus(); }
    }
    return self.clients.openWindow(url);
  })());
});
