import { z } from "zod";
import { CATEGORIES, COLORS, METHODS, type Store } from "./model";

const id = z.uuid();
const text = (max: number) => z.string().trim().max(max);
const name = (max: number) => text(max).min(1);
const cents = z.number().int().min(0).max(100_000_000);
const duration = z.number().int().min(5).max(1440);
const date = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const client = z.object({ id, name: name(100), phone: text(24), notes: text(1000), color: z.enum(COLORS as [string, ...string[]]) }).strict();
const procedure = z.object({ id, name: name(100), description: text(200), price: cents, duration, active: z.boolean() }).strict();
const payment = z.object({ id, appointmentId: id, amount: cents.refine(n => n > 0), date, method: z.enum(METHODS as [string, ...string[]]), kind: z.enum(["deposit", "balance"]) }).strict();
const appointment = z.object({
  id, clientId: id, date, time, duration, price: cents, notes: text(1000), status: z.enum(["scheduled", "completed", "cancelled", "absent"]),
  procedures: z.array(z.object({ id, name: name(100), price: cents, duration }).strict()).min(1).max(20),
  overlapConfirmed: z.boolean().optional(),
}).strict().refine(a => { const [h, m] = a.time.split(":").map(Number); return h * 60 + m + a.duration <= 1440; }, "O atendimento precisa terminar no mesmo dia.");
const messageContext = z.object({ client: name(100), phone: text(24), date, time, procedures: z.array(name(100)).min(1).max(20), price: cents, paid: cents, deposit: cents, address: text(300), business: name(80) }).strict();

export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("client.save"), client }).strict(),
  z.object({ type: z.literal("procedure.save"), procedure }).strict(),
  z.object({ type: z.literal("appointment.save"), appointment, client: client.optional(), payment: payment.optional() }).strict(),
  z.object({ type: z.literal("appointment.status"), id, status: z.enum(["scheduled", "completed", "cancelled", "absent"]), overlapConfirmed: z.boolean().optional() }).strict(),
  z.object({ type: z.literal("payment.add"), payment }).strict(),
  z.object({ type: z.literal("expense.add"), expense: z.object({ id, description: name(160), amount: cents.refine(n => n > 0), date, category: z.enum(CATEGORIES as [string, ...string[]]), method: z.enum(METHODS as [string, ...string[]]) }).strict() }).strict(),
  z.object({ type: z.literal("availability.save"), days: z.array(z.object({ date, times: z.array(time).max(48).refine(t => new Set(t).size === t.length) }).strict()).min(1).max(366) }).strict(),
  z.object({ type: z.literal("business.save"), business: z.object({ name: name(80), professional: name(50), phone: text(24), address: text(300).optional() }).strict() }).strict(),
  z.object({ type: z.literal("message.sent"), appointmentId: id, kind: z.enum(["confirmation", "reminder"]), context: messageContext, sent: z.boolean() }).strict(),
]);

export const mutationSchema = z.object({ requestId: id, revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), command: commandSchema }).strict();
export type Command = z.infer<typeof commandSchema>;
export type Workspace = { data: Store; revision: number };

export function availabilityCommand(previous: Store["availability"], next: Store["availability"]): Command | null {
  const days = Object.keys({ ...previous, ...next }).filter(d => JSON.stringify(previous[d] ?? []) !== JSON.stringify(next[d] ?? [])).map(date => ({ date, times: next[date] ?? [] }));
  return days.length ? { type: "availability.save", days } : null;
}
