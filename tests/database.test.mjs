import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner = randomUUID(), other = randomUUID(), disabled = randomUUID();
const customer = randomUUID(), procedure = randomUUID(), appointment = randomUUID();
const db = new PGlite();
let revision = 0;
before(async () => {
  await db.exec("create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;");
  await db.exec(await readFile(new URL("../supabase/migrations/202611110001_nail_workspace.sql", import.meta.url), "utf8"));
  for (const id of [owner, other, disabled]) {
    await db.query("insert into auth.users(id) values($1)", [id]);
    await db.query("insert into public.nail_accounts(owner_id,active) values($1,$2)", [id, id !== disabled]);
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  await db.exec("set role authenticated");
});
after(async () => { await db.close(); });
async function as(id) { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); }
async function apply(command, request = randomUUID(), expected = revision) {
  const result = await db.query("select public.nail_apply_command($1,$2,$3::jsonb) as result", [request, expected, JSON.stringify(command)]);
  revision = Number(result.rows[0].result.revision);
  return result.rows[0].result.data;
}
const base = () => ({ id: appointment, clientId: customer, date: "2026-11-11", time: "09:00", duration: 90, procedures: [{ id: procedure, name: "Tentativa de alterar o nome", price: 1, duration: 5 }], price: 13500, notes: "", status: "scheduled", overlapConfirmed: false });

test("owner can save a client and procedure, while foreign users and anonymous requests are isolated", async () => {
  await apply({ type: "client.save", client: { id: customer, name: "Cliente de teste", phone: "", notes: "", color: "sand" } });
  await apply({ type: "procedure.save", procedure: { id: procedure, name: "Manutenção em gel", description: "", price: 12000, duration: 90, active: true } });
  await as(other);
  assert.equal((await db.query("select * from public.nail_clients")).rows.length, 0);
  assert.equal((await db.query("select public.nail_read_workspace() as result")).rows[0].result.data.clients.length, 0);
  await assert.rejects(db.query("insert into public.nail_clients(owner_id,id,name) values($1,$2,'Não permitido')", [owner, randomUUID()]), /permission denied/);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select public.nail_read_workspace()"), /permission denied/);
  await as(disabled);
  await assert.rejects(db.query("select public.nail_read_workspace()"), /ACCOUNT_NOT_ALLOWED/);
  await as(owner);
});

test("appointment snapshots come from the database and a deposit plus retry is recorded only once", async () => {
  const request = randomUUID(); const expected = revision;
  const command = { type: "appointment.save", appointment: base(), payment: { id: randomUUID(), appointmentId: appointment, amount: 3000, date: "2026-11-11", method: "Pix", kind: "deposit" } };
  const data = await apply(command, request);
  assert.equal(data.appointments[0].price, 13500);
  assert.deepEqual(data.appointments[0].procedures[0], { id: procedure, name: "Manutenção em gel", price: 12000, duration: 90 });
  const retried = await apply(command, request, expected);
  assert.equal(retried.payments.length, 1);
  assert.equal(retried.payments[0].amount, 3000);
  await assert.rejects(apply({ ...command, payment: { ...command.payment, amount: 4000 } }, request), /REQUEST_REUSED/);
});

test("overlap needs confirmation, while adjacent time ranges are permitted", async () => {
  const adjacent = { ...base(), id: randomUUID(), time: "10:30" };
  await apply({ type: "appointment.save", appointment: adjacent });
  const overlapping = { ...base(), id: randomUUID(), time: "10:00" };
  await assert.rejects(apply({ type: "appointment.save", appointment: overlapping }), /OVERLAP/);
  const data = await apply({ type: "appointment.save", appointment: { ...overlapping, overlapConfirmed: true } });
  assert.equal(data.appointments.length, 3);
});

test("stale revisions cannot overwrite a change made by another tab", async () => {
  await assert.rejects(apply({ type: "business.save", business: { name: "Sobrescrita", professional: "Teste", phone: "" } }, randomUUID(), revision - 1), /STALE_REVISION/);
});

test("historical snapshots survive price changes and received amounts cannot be reduced away", async () => {
  await apply({ type: "procedure.save", procedure: { id: procedure, name: "Novo nome", description: "", price: 20000, duration: 120, active: true } });
  const data = await apply({ type: "appointment.save", appointment: { ...base(), notes: "Histórico preservado", overlapConfirmed: true } });
  const saved = data.appointments.find(a => a.id === appointment);
  assert.equal(saved.procedures[0].name, "Manutenção em gel");
  assert.equal(saved.procedures[0].price, 12000);
  await assert.rejects(apply({ type: "appointment.save", appointment: { ...base(), price: 2999, overlapConfirmed: true } }), /PRICE_BELOW_PAID/);
});

test("payments above the balance are rejected and cancellation preserves previous receipts", async () => {
  await assert.rejects(apply({ type: "payment.add", payment: { id: randomUUID(), appointmentId: appointment, amount: 10501, date: "2026-11-11", method: "Pix", kind: "balance" } }), /PAYMENT_EXCEEDS_TOTAL/);
  const request = randomUUID(); const expected = revision;
  const command = { type: "payment.add", payment: { id: randomUUID(), appointmentId: appointment, amount: 10500, date: "2026-11-11", method: "Dinheiro", kind: "balance" } };
  await apply(command, request);
  const retried = await apply(command, request, expected);
  assert.equal(retried.payments.reduce((s,p) => s + p.amount, 0), 13500);
  const cancelled = await apply({ type: "appointment.status", id: appointment, status: "cancelled" });
  assert.equal(cancelled.payments.length, 2);
  await assert.rejects(apply({ type: "payment.add", payment: { id: randomUUID(), appointmentId: appointment, amount: 1, date: "2026-11-11", method: "Pix", kind: "balance" } }), /INACTIVE_APPOINTMENT/);
  await assert.rejects(apply({ type: "appointment.status", id: appointment, status: "scheduled" }), /OVERLAP/);
});

test("availability changes only selected days and never remove booked appointments", async () => {
  await apply({ type: "availability.save", days: [{ date: "2026-11-11", times: ["09:00", "13:00", "16:00"] }, { date: "2026-11-18", times: ["11:00", "16:00"] }] });
  const data = await apply({ type: "availability.save", days: [{ date: "2026-11-11", times: [] }] });
  assert.deepEqual(data.availability["2026-11-18"], ["11:00", "16:00"]);
  assert.deepEqual(data.availability["2026-11-11"], []);
  assert.equal(data.appointments.length, 3);
  await assert.rejects(apply({ type: "availability.save", days: [{ date: "2026-11-18", times: ["99:00"] }] }), /INVALID_TIMES/);
});

test("an inline client and appointment are rolled back together when the deposit is invalid", async () => {
  const inline = randomUUID(); const a = { ...base(), id: randomUUID(), clientId: inline, time: "18:00" };
  await assert.rejects(apply({ type: "appointment.save", appointment: a, client: { id: inline, name: "Não deve persistir", phone: "", notes: "", color: "sand" }, payment: { id: randomUUID(), appointmentId: a.id, amount: 99999, date: "2026-11-11", method: "Pix", kind: "deposit" } }), /PAYMENT_EXCEEDS_TOTAL/);
  assert.equal((await db.query("select * from public.nail_clients where id = $1", [inline])).rows.length, 0);
});

test("foreign procedure and appointment references cannot cross owner boundaries", async () => {
  await as(other);
  await assert.rejects(apply({ type: "payment.add", payment: { id: randomUUID(), appointmentId: appointment, amount: 1, date: "2026-11-11", method: "Pix", kind: "balance" } }, randomUUID(), 0), /INVALID_APPOINTMENT/);
  await assert.rejects(apply({ type: "appointment.save", appointment: { ...base(), id: randomUUID() } }, randomUUID(), 0), /PROCEDURE_UNAVAILABLE/);
  await as(owner);
});
