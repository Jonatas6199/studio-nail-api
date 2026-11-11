import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../src/lib/model";
import { appointmentMessage, messageContext, messageReceipt, pendingReminders, whatsappLink, whatsappNumber } from "../src/lib/whatsapp";
import { trustedPushEndpoint, pushRequest } from "../src/lib/push-schema";

test("Brazilian numbers with DDD are normalized without guessing a missing area code", () => {
  for (const input of ["(11) 99999-1234", "+55 11 99999-1234", "5511999991234", "005511999991234"]) assert.equal(whatsappNumber(input), "5511999991234");
  for (const input of ["99999-1234", "", "(11) 12345-1234", "55119999<script>", "00000000000"]) assert.equal(whatsappNumber(input), null);
  assert.equal(whatsappNumber("+1 (415) 555-1234"), "14155551234");
});
test("messages preserve the agreed appointment price, deposit and remaining balance", () => {
  const store = createDemo("2026-11-11"); store.business.address = "Rua das Flores, 10 · São Paulo";
  const appointment = store.appointments.find(a => a.id === "a1")!; appointment.price = 13500;
  const context = messageContext(store, appointment);
  const text = appointmentMessage(context, "confirmation");
  assert.match(text, /11\/11\/2026 às 13:00 horas/);
  assert.match(text, /Valor do atendimento: R\$ 135,00/);
  assert.match(text, /Sinal já recebido: R\$ 40,00/);
  assert.match(text, /Valor restante: R\$ 95,00/);
  assert.ok(text.includes(store.business.address));
  const link = new URL(whatsappLink(context.phone,text)!);
  assert.equal(link.origin,"https://wa.me"); assert.equal(link.searchParams.get("text"),text);
  assert.match(appointmentMessage({...context, paid:13500},"reminder"), /Pagamento integral já recebido/);
  assert.doesNotMatch(appointmentMessage({...context, paid:0, deposit:0},"reminder"), /Sinal já recebido/);
});
test("reminders become due at 09:00 in Sao Paulo and persist, except after manual send or cancellation", () => {
  const store = createDemo("2026-11-11"); store.appointments = [store.appointments.find(a => a.id === "a5")!];
  const a = store.appointments[0]; assert.equal(a.date,"2026-11-13");
  assert.equal(pendingReminders(store,new Date("2026-11-11T11:59:00Z")).length,0);
  assert.equal(pendingReminders(store,new Date("2026-11-11T12:00:00Z")).length,1);
  assert.equal(pendingReminders(store,new Date("2026-11-12T14:00:00Z")).length,1);
  store.messages = [{ appointmentId:a.id, kind:"reminder", context:messageContext(store,a), sentAt:new Date().toISOString() }];
  assert.equal(pendingReminders(store,new Date("2026-11-12T14:00:00Z")).length,0);
  a.time="14:00";
  assert.equal(messageReceipt(store,a,"reminder"),undefined);
  assert.equal(pendingReminders(store,new Date("2026-11-12T14:00:00Z")).length,1);
  a.status="cancelled"; assert.equal(pendingReminders(store,new Date("2026-11-12T14:00:00Z")).length,0);
  a.status="scheduled"; assert.equal(pendingReminders(store,new Date("2026-11-13T20:00:00Z")).length,0);
});
test("push subscription endpoints are restricted to trusted push providers", () => {
  for (const url of ["http://localhost/test", "https://127.0.0.1/test", "https://evil.example/push", "https://web.push.apple.com.evil.example/push", "https://user@web.push.apple.com/push", "https://fcm.googleapis.com:9000/path"]) assert.equal(trustedPushEndpoint(url),false);
  for (const url of ["https://web.push.apple.com/Q123", "https://fcm.googleapis.com/fcm/send/id", "https://updates.push.services.mozilla.com/wpush/v2/id"]) assert.equal(trustedPushEndpoint(url),true);
  assert.equal(pushRequest.safeParse({action:"save", subscription:{endpoint:"https://fcm.googleapis.com/fcm/send/id", keys:{p256dh:"bad",auth:"bad"}}}).success,false);
});
