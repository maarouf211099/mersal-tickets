import { test } from "node:test";
import assert from "node:assert/strict";
import { canViewFeedbackResults, parseFeedback } from "./feedback.ts";

test("feedback results: managers + the configured user (username or email local part, case-insensitive)", () => {
  const a = "mahmoud.maarouf";
  const can = (username: string | null, role = "agent") => canViewFeedbackResults({ username, role }, a);
  assert.equal(can("admin", "manager"), true);
  assert.equal(can("anyone", "manager"), true);
  assert.equal(can("mahmoud.maarouf"), true);
  assert.equal(can("Mahmoud.Maarouf", "viewer"), true);
  assert.equal(can(`${a}@example.org`), true);
  assert.equal(can("admin"), false);
  assert.equal(can("sup1", "supervisor"), false);
  assert.equal(can("v1", "viewer"), false);
  assert.equal(can("mahmoud.maarouf2"), false);
  assert.equal(can("x.mahmoud.maarouf"), false);
  assert.equal(can(""), false);
  assert.equal(can(null), false);
  assert.equal(canViewFeedbackResults(null, a), false);
  assert.equal(canViewFeedbackResults({ username: "someone", role: "agent" }, "someone"), true);
});

test("feedback validation", () => {
  const ok = parseFeedback({ overall: 4, ease: null, speed: 5, value: "", problems: "  ", ideas: "x", department: " IT ", name: "" });
  assert.deepEqual(ok, { data: { overall: 4, ease: null, speed: 5, value: null, problems: null, ideas: "x", department: "IT", name: null } });

  for (const bad of [
    null, [], "x",
    { department: "IT" },
    { overall: 0, department: "IT" },
    { overall: 6, department: "IT" },
    { overall: 3.5, department: "IT" },
    { overall: 3, ease: 9, department: "IT" },
    { overall: 3 },
    { overall: 3, department: "   " },
    { overall: 3, department: "a".repeat(121) },
    { overall: 3, department: "IT", name: "a".repeat(121) },
    { overall: 3, department: "IT", problems: "a".repeat(2001) },
    { overall: 3, department: "IT", ideas: 5 },
  ]) {
    const r = parseFeedback(bad);
    assert.ok("error" in r && /[؀-ۿ]/.test(r.error), JSON.stringify(bad));
  }
  assert.ok("data" in parseFeedback({ overall: 5, department: "a".repeat(120), problems: "a".repeat(2000) }));
});
