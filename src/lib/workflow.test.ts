import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slaDeadlineFor, slaState, transferTargets, triageHolders, researchOutcome,
  identityError, normalizeDigits, parseMentions, TEAM, EGYPTIAN, type TeamLite,
} from "./workflow.ts";

const t0 = new Date("2026-01-01T10:00:00Z");
const mins = (n: number) => new Date(t0.getTime() + n * 60_000);

test("SLA durations: new case 48h, follow up 72h, emergency 30m", () => {
  assert.deepEqual(slaDeadlineFor("new_case", t0), mins(48 * 60));
  assert.deepEqual(slaDeadlineFor("follow_up", t0), mins(72 * 60));
  assert.deepEqual(slaDeadlineFor("emergency", t0), mins(30));
});

test("SLA state for open and closed tickets", () => {
  const t = { createdAt: t0, slaDeadline: mins(30) };
  assert.equal(slaState(t, mins(10)), "within");
  assert.equal(slaState(t, mins(25)), "warning");
  assert.equal(slaState(t, mins(31)), "breached");
  assert.equal(slaState({ ...t, closedAt: mins(20) }, mins(500)), "met");
  assert.equal(slaState({ ...t, closedAt: mins(40) }, mins(500)), "breached");
});

const team = (id: string, extra: Partial<TeamLite> = {}): TeamLite => ({
  id, code: id, isActive: true, isReceiver: false, transferOnlyFromId: null, ...extra,
});
const teams = [
  team("ALEX", { isReceiver: true }),
  team("EH", { isReceiver: true }),
  team("REG", { isReceiver: true }),
  team("HD", { transferOnlyFromId: "EH" }),
  team("RES", { transferOnlyFromId: "HD" }),
  team("CALL"),
  team("OLD", { isReceiver: true, isActive: false }),
];
const ids = (xs: TeamLite[]) => xs.map((x) => x.id);

test("hotline doctor is only offered to the emergency hotline team", () => {
  assert.deepEqual(ids(transferTargets(teams, ["CALL"], false)), ["ALEX", "EH", "REG"]);
  assert.deepEqual(ids(transferTargets(teams, ["EH"], false, ["EH"])), ["ALEX", "REG", "HD"]);
  assert.ok(ids(transferTargets(teams, [], true)).includes("HD"));
});

test("triage routing", () => {
  assert.deepEqual(triageHolders("emergency"), [TEAM.RESEARCH]);
  assert.deepEqual(triageHolders("urgent").sort(), [TEAM.FOLLOWUP_DOCTOR, TEAM.RESEARCH].sort());
});

test("research decision", () => {
  assert.deepEqual(researchOutcome("rejected"), { close: true, addHolders: [], requiresComment: true });
  assert.deepEqual(researchOutcome("accepted").addHolders, [TEAM.FOLLOWUP_DOCTOR]);
});

test("identity validation", () => {
  assert.equal(identityError(EGYPTIAN, "29001011234567", ""), null);
  assert.ok(identityError(EGYPTIAN, "123", ""));
  assert.ok(identityError("سوداني", "", ""));
  assert.equal(identityError("سوداني", "", "555-12C34567"), null);
  assert.equal(normalizeDigits("٢٩٠٠١٠١١٢٣٤٥٦٧"), "29001011234567");
});

test("mentions", () => {
  assert.deepEqual(parseMentions("@ahmed.atef شوف دي ومعاك @Sara_1."), ["ahmed.atef", "sara_1"]);
  assert.deepEqual(parseMentions("mail me at x@y.com"), []);
});
