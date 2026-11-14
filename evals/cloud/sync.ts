/**
 * Cloud save merge rules (lib/cloud/sync.ts), on plain data — no network.
 *   npx tsx evals/cloud/sync.ts
 */
import { reconcile, emptyState, keyOf, type Row, type SyncState } from "../../lib/cloud/sync";
import { cleanMobile } from "../../lib/cloud/mobile";

const fails: string[] = [];
const expect = (ok: boolean, msg: string) => { if (!ok) fails.push(msg); };
const T = (s: string) => new Date(`2026-11-14T${s}Z`).getTime();
const row = (id: string, data: unknown, at: string, deleted = false): Row =>
  ({ kind: "project", id, data: deleted ? null : data, updated_at: new Date(T(at)).toISOString(), deleted_at: deleted ? new Date(T(at)).toISOString() : null });

// 1. First login on a phone with jobs: everything is uploaded, nothing applied
const A = { [keyOf("project", "j1")]: { title: "Sharma" }, [keyOf("system", "s1")]: { name: "Euro 29 mm" } };
const a = reconcile(A, emptyState(), [], T("10:00:00"));
expect(a.push.length === 2 && a.apply.length === 0, `first login should upload 2, got push ${a.push.length} apply ${a.apply.length}`);

// 2. A second, empty phone pulls them
const pulled = a.push.map((r) => ({ ...r }));
const b = reconcile({}, emptyState(), pulled, T("10:05:00"));
expect(b.apply.length === 2 && b.push.length === 0, `new phone should take 2, got apply ${b.apply.length} push ${b.push.length}`);

// 3. Nothing changed: a second sync sends nothing
const a2 = reconcile(A, a.state, [], T("10:10:00"));
expect(a2.push.length === 0 && a2.apply.length === 0, "no change → nothing to send");

// 4. Edit on phone A pushes only that record
const A3 = { ...A, [keyOf("project", "j1")]: { title: "Sharma ji" } };
const a3 = reconcile(A3, a.state, [], T("10:20:00"));
expect(a3.push.length === 1 && (a3.push[0].data as { title: string }).title === "Sharma ji", "an edit pushes that one record");

// 5. Delete on phone A is a tombstone; phone B removes it
const A4: Record<string, unknown> = { [keyOf("system", "s1")]: { name: "Euro 29 mm" } };
const a4 = reconcile(A4, a3.state, [], T("10:30:00"));
expect(a4.push.length === 1 && a4.push[0].deleted_at !== null && a4.push[0].data === null, "a delete pushes a tombstone");
const b4 = reconcile({ [keyOf("project", "j1")]: { title: "Sharma" }, [keyOf("system", "s1")]: { name: "Euro 29 mm" } }, b.state, a4.push, T("10:31:00"));
expect(b4.apply.length === 1 && b4.apply[0].deleted_at !== null && b4.push.length === 0, "the other phone deletes it too");

// 6. Both phones edit the same job: the newer edit wins on both
const base: SyncState = a.state;
const fromB = row("j1", { title: "B's edit" }, "11:00:00");
const aEditEarly = reconcile({ ...A, [keyOf("project", "j1")]: { title: "A's edit" } }, { ...base, dirty: { [keyOf("project", "j1")]: T("10:59:00") } }, [fromB], T("11:01:00"));
expect(aEditEarly.apply.length === 1 && aEditEarly.push.length === 0, "B edited later → A takes B's version and does not push its own");
const aEditLate = reconcile({ ...A, [keyOf("project", "j1")]: { title: "A's edit" } }, { ...base, dirty: { [keyOf("project", "j1")]: T("11:00:30") } }, [fromB], T("11:01:00"));
expect(aEditLate.apply.length === 0 && aEditLate.push.length === 1 && (aEditLate.push[0].data as { title: string }).title === "A's edit", "A edited later → A keeps and pushes its version");

// 7. Offline: changes made without net are pushed when the sync runs later
const off = reconcile({ ...A, [keyOf("project", "j9")]: { title: "made offline" } }, a.state, [], T("18:00:00"));
expect(off.push.some((r) => r.id === "j9"), "a job made offline is pushed later");

// 8. lastPull moves to the newest pulled row
expect(b.state.lastPull === pulled.map((r) => r.updated_at).sort().at(-1), "lastPull is the newest pulled time");

// 9. Mobile numbers as shops type them
for (const [raw, want] of [["98765 43210", "9876543210"], ["+91 98765-43210", "9876543210"], ["098765 43210", "9876543210"], ["12345 67890", null], ["98765", null]] as const)
  expect(cleanMobile(raw) === want, `mobile ${raw} → ${cleanMobile(raw)}, want ${want}`);

if (fails.length) { console.error(`\ncloud sync: ${fails.length} failed\n - ` + fails.join("\n - ")); process.exit(1); }
console.log("cloud sync: first login uploads, new phone pulls, edits/deletes travel, newer edit wins, offline changes go later, mobile numbers cleaned ✓");
