import { addDays, paidFor, type Appointment, type MessageContext, type MessageKind, type Store } from "./model";

export function whatsappNumber(raw: string): string | null {
  const input = raw.trim();
  if (!input || /[^\d\s()+.\-]/.test(input)) return null;
  let digits = input.replace(/\D/g, "");
  const explicit = input.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!explicit && [10, 11].includes(digits.length)) digits = `55${digits}`;
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  if (digits.startsWith("55") && !/^55[1-9]\d[2-9]\d{7,8}$/.test(digits)) return null;
  if (!explicit && !digits.startsWith("55")) return null;
  return digits;
}

export function messageContext(store: Store, appointment: Appointment): MessageContext {
  const client = store.clients.find(c => c.id === appointment.clientId);
  return { client: client?.name ?? "Cliente", phone: client?.phone ?? "", date: appointment.date, time: appointment.time,
    procedures: appointment.procedures.map(p => p.name), price: appointment.price, paid: paidFor(store, appointment.id),
    deposit: store.payments.filter(p => p.appointmentId === appointment.id && p.kind === "deposit").reduce((sum, p) => sum + p.amount, 0),
    address: store.business.address ?? "", business: store.business.name, ...(appointment.pricePending ? { pricePending: true } : {}), ...(appointment.timeUnknown ? { timeUnknown: true } : {}) };
}
export function contextKey(c: MessageContext): string {
  return JSON.stringify([c.client, c.phone, c.date, c.time, c.procedures, c.price, c.paid, c.deposit, c.address, c.business, c.pricePending ?? false, c.timeUnknown ?? false]);
}
export function messageReceipt(store: Store, a: Appointment, kind: MessageKind) {
  const context = contextKey(messageContext(store, a));
  return store.messages?.find(m => m.appointmentId === a.id && m.kind === kind && contextKey(m.context) === context);
}
const amount = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
export function appointmentMessage(context: MessageContext, kind: MessageKind): string {
  const c = context; const date = c.date.split("-").reverse().join("/");
  const greeting = `Olá, ${c.client}!`;
  const intro = kind === "confirmation" ? `Agendamento confirmado para o dia ${date} às ${c.time} horas.` : `Passando para lembrar do seu agendamento no dia ${date} às ${c.time} horas.`;
  const lines = [greeting, "", intro, "", `Procedimento${c.procedures.length > 1 ? "s" : ""}: ${c.procedures.join(" + ")}`, `Endereço: ${c.address || "[informe o endereço]"}`, `Valor do atendimento: ${c.pricePending ? "a definir" : amount(c.price)}`];
  if (c.deposit > 0) lines.push(`Sinal já recebido: ${amount(c.deposit)}`);
  if (c.paid > c.deposit && c.paid < c.price) lines.push(`Total já recebido: ${amount(c.paid)}`);
  if (c.pricePending) { /* The amount is still unknown, not a free appointment. */ }
  else if (c.paid >= c.price) lines.push(c.price ? "Pagamento integral já recebido." : "Atendimento sem cobrança.");
  else lines.push(`Valor restante: ${amount(Math.max(0, c.price - c.paid))}`);
  lines.push("", kind === "confirmation" ? "Te espero! ✨" : "Te espero! Se precisar de algo, me avise. ✨", c.business);
  return lines.join("\n");
}
export function whatsappLink(phone: string, text: string): string | null {
  const number = whatsappNumber(phone);
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}
export function saoPauloNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}
export function pendingReminders(store: Store, now = new Date()) {
  const current = saoPauloNow(now);
  return store.appointments.filter(a => a.status === "scheduled" && !a.timeUnknown && `${a.date}T${a.time}` >= `${current.date}T${current.time}` && `${addDays(a.date, -2)}T09:00` <= `${current.date}T${current.time}` && !messageReceipt(store, a, "reminder")).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}
