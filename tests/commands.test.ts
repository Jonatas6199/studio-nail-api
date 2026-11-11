import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mutationSchema, availabilityCommand } from "../src/lib/commands";

test("rejects fractional cents, impossible dates, malformed times and forged owner fields", () => {
  const client = { id: randomUUID(), name: "Cliente", phone: "", notes: "", color: "sand" };
  const request = { requestId: randomUUID(), revision: 0, command: { type: "client.save", client } };
  assert.equal(mutationSchema.safeParse(request).success, true);
  assert.equal(mutationSchema.safeParse({ ...request, command: { ...request.command, ownerId: randomUUID() } }).success, false);
  for (const [date, times] of [["2026-02-30", ["09:00"]], ["2026-11-11", ["24:00"]], ["2026-11-11", ["09:00", "09:00"]]]) {
    assert.equal(mutationSchema.safeParse({ ...request, command: { type: "availability.save", days: [{ date, times }] } }).success, false);
  }
  const expense = { id: randomUUID(), description: "Insumos", amount: 25.5, date: "2026-11-11", method: "Pix", category: "Insumos" };
  assert.equal(mutationSchema.safeParse({ ...request, command: { type: "expense.add", expense } }).success, false);
});

test("availability updates send only changed dates", () => {
  assert.deepEqual(availabilityCommand({ "2026-11-11": ["09:00"], "2026-11-18": ["11:00"] }, { "2026-11-11": [], "2026-11-18": ["11:00"] }), { type: "availability.save", days: [{ date: "2026-11-11", times: [] }] });
});
