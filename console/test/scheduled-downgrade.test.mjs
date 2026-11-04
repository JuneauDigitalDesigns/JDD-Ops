/**
 * Plan changes from /manage follow contract v5.3 §15.4, and the console still never writes to
 * Stripe.
 *
 * On the code before this change these fail:
 *   - The downgrade flipped the portal record, env and site.ts at once, so the client lost Growth
 *     on the day it was asked for, and the billing sync after it credited the unused month. Now
 *     it is requested through the agency (which emails the client the Starter terms and schedules
 *     the change for the period end), and the env/site.ts step refuses until it has landed.
 *   - An upgrade wrote KV and left billing for a separate click. With the agency webhook now
 *     reading the plan from the Stripe price, the next subscription event would revert it.
 *   - The downgrade panel still described releasing the number and deleting the agent.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("a downgrade is requested through the agency, not applied from the console", () => {
  const route = read("app/api/manage/plan/downgrade/request/route.ts");
  assert.match(route, /callPortalOps<PlanChangeStatus>\('\/api\/ops\/plan-change'/);
  assert.doesNotMatch(route, /from ['"]stripe['"]/);
});

test("the env/site.ts step refuses until the portal record shows starter", () => {
  const route = read("app/api/manage/plan/downgrade/execute/route.ts");
  assert.match(route, /portalPlan && portalPlan !== 'starter'/);
  assert.ok(route.indexOf("portalPlanOf(") < route.indexOf("writePlanToSchema("));
});

test("an upgrade syncs billing in the same action", () => {
  const route = read("app/api/manage/plan/route.ts");
  assert.match(route, /callPortalOps<\{ ok\?: boolean; changed\?: boolean \}>\('\/api\/ops\/plan-sync'/);
});

test("the console holds no Stripe client", () => {
  const lib = read("lib/portalPlanChange.ts");
  assert.doesNotMatch(lib, /from ['"]stripe['"]/);
  assert.doesNotMatch(lib, /new Stripe\(/);
});

test("the downgrade panel no longer describes destroying the voice stack", () => {
  const panel = read("components/manage/PlanDowngradePanel.tsx");
  assert.doesNotMatch(panel, /cannot be re-acquired/);
  assert.doesNotMatch(panel, /Will be destroyed/);
  assert.doesNotMatch(panel, /Releases the voice agent/);
  const control = read("components/manage/PlanControl.tsx");
  assert.doesNotMatch(control, /Releases the number and agent/);
});
