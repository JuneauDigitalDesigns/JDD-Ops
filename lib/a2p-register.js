// @ts-check
/**
 * The per-client A2P 10DLC registration chain — runbook phases 2–5, one function per step.
 *
 * `PLAN-console-a2p-registration.md` is the design; `~/Desktop/JDD-a2p-isv-runbook.html` and the
 * policies recorded under `test/fixtures/trusthub/` are the vendor facts. Read the plan's §2
 * before changing anything here: every write is click-gated (decision 3), so **no step calls
 * another** — the console sequences them, because the console is where the clicks are.
 *
 * ── The three guarantees this module carries ─────────────────────────────────────────────────
 *
 * 1. **Phase 0 gates every write.** `runStep` calls `assertA2pReady` before any write step, and
 *    every write step also refuses unless it is handed a passing readiness report. A profile
 *    filed without JDD's primary profile attached "evaluates as a direct business and the whole
 *    ISV posture collapses" — and that surfaces days later, as a rejection.
 *
 * 2. **A noncompliant profile is never submitted.** `submitProfile` / `submitTrustProduct`
 *    refuse unless the newest evaluation is `compliant` AND postdates the last change to the
 *    bundle. Evaluation is free and field-level; submitting anyway costs days.
 *
 * 3. **Sensitive input is consumed, never kept.** The EIN reaches exactly one request
 *    (`createBusinessEndUser`), the rep's details exactly one (`createRepEndUser`), the sole
 *    proprietor's mobile exactly one (`createTrustProduct`). Step functions return SIDs and
 *    statuses; their `save` patches go through `writeRegistration`, which refuses unknown keys
 *    and tax-ID-shaped values. Vendor errors are scrubbed at construction (`A2pVendorError`).
 *
 * ── Resumability ─────────────────────────────────────────────────────────────────────────────
 * A step that makes more than one vendor call (`createAddressAndDocument`, `attachEntities`,
 * `createTrustProduct`, `attachNumberToService`) calls `save` after EACH create, and skips any
 * object the record already holds. TrustHub has no "find my half-built bundle" query, so a SID
 * that is not written the moment it exists is an orphan nobody can find.
 *
 * Plain ESM, `@ts-check`, injectable `fetchImpl`, like the rest of `lib/`.
 */

import { assertA2pReady } from "./a2p-readiness.js";
import {
  buildAddressParams,
  buildBusinessEndUserAttributes,
  buildRepEndUserAttributes,
  buildTrustEndUser,
  repEndUserType,
  summarizeEvaluation,
  validateAddressInput,
  validateBusinessInput,
  validateRepInput,
  validateTrustProductInput,
  A2P_BUSINESS_INDUSTRIES,
  A2P_BUSINESS_TYPES,
  A2P_JOB_POSITIONS,
} from "./a2p-identity.js";
import { A2pVendorError, MESSAGING, TRUSTHUB, TWILIO_API, deleteEndUsers, twilioRequest } from "./a2p-trusthub.js";

// ── Constants ────────────────────────────────────────────────────────────────────────────────

/**
 * Where Twilio sends review outcomes. JDD's, never the client's: Twilio corresponds with the
 * ISV, and routing it to the client guarantees a dropped rejection notice (runbook 2.1).
 */
export const DEFAULT_OPS_EMAIL = "ops@juneaudigitaldesigns.com";

/** Runbook 4.1. The agency routes exist (`app/api/webhooks/twilio-{sms,status}`). */
export const DEFAULT_INBOUND_URL = "https://juneaudigitaldesigns.com/api/webhooks/twilio-sms";
export const DEFAULT_STATUS_CALLBACK = "https://juneaudigitaldesigns.com/api/webhooks/twilio-status";

/**
 * The sole-proprietor chain's two policies — resolved by SID and verified by name, exactly as
 * `KNOWN_POLICIES` in `a2p-readiness.js` does for the standard chain, and for the same reason:
 * do not trust a hardcoded SID blindly, and do not "discover" one from a listing that, on this
 * account, does not contain the chain's policies at all. Both read live 2026-11-02 and recorded
 * by `scripts/record-a2p-fixtures.js`.
 */
export const SOLE_PROP_POLICIES = Object.freeze([
  {
    key: "starterCustomerProfilePolicySid",
    sid: "RN806dd6cd175f314e1f96a9727ee271f4",
    label: "Starter Customer Profile of type Business",
    expect: ["starter", "customer profile"],
  },
  {
    key: "soleProprietorTrustProductPolicySid",
    sid: "RN670d5d2e282a6130ae063b234b6019c8",
    label: "Sole Proprietor TrustProduct",
    expect: ["sole proprietor"],
  },
]);

/** Plans that register at all. Starter and web-only never send customer-facing messages. */
export const REGISTERING_PLANS = Object.freeze(["growth", "enterprise"]);

/** Bundle statuses that count as "filed": Twilio has it, and it has not been rejected. */
const FILED = new Set(["pending-review", "in-review", "twilio-approved"]);
/** Statuses the sole-prop guide says to proceed on ("once in-review… do not wait for approved"). */
const UNDER_REVIEW = new Set(["in-review", "twilio-approved"]);

/** Use cases offered for a standard brand. The runbook's choice is CUSTOMER_CARE. */
export const STANDARD_USECASES = Object.freeze(["CUSTOMER_CARE", "MIXED", "LOW_VOLUME"]);

/**
 * @typedef {import("./a2p-registration-store.js").A2pRegistrationRecord} A2pRegistrationRecord
 * @typedef {import("./a2p-identity.js").A2pRegistrationPath} A2pRegistrationPath
 * @typedef {import("./a2p-trusthub.js").A2pTwilioAuth} A2pTwilioAuth
 */

/**
 * What every step receives. `ready` is the readiness report `runStep` obtained; a write step
 * given anything but `ready.ok === true` refuses before its first request.
 *
 * @typedef {object} StepContext
 * @property {string} slug
 * @property {string} plan
 * @property {A2pRegistrationRecord | null} record
 * @property {Record<string, any>} input The operator's typed values for THIS step only.
 * @property {{ ok: true | false | null, policies: Record<string, string | undefined> }} ready
 * @property {A2pTwilioAuth} auth
 * @property {string} primaryProfileSid
 * @property {Record<string, string | undefined>} env
 * @property {typeof fetch} fetchImpl
 * @property {(patch: Partial<A2pRegistrationRecord>) => Promise<A2pRegistrationRecord>} save
 * @property {() => Date} now
 */

/**
 * @typedef {object} StepResult
 * @property {A2pRegistrationRecord} record The record after the step's last save.
 * @property {string} summary One line for the audit feed and the UI. SIDs and statuses only.
 */

export class A2pStepRefused extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "A2pStepRefused";
  }
}

// ── Small helpers ────────────────────────────────────────────────────────────────────────────

/** @param {StepContext} ctx */
function requireReady(ctx) {
  if (ctx.ready?.ok !== true) {
    throw new A2pStepRefused("A2P Phase 0 readiness has not passed — refusing to touch Twilio.");
  }
  if (!ctx.primaryProfileSid?.startsWith("BU")) {
    throw new A2pStepRefused("TWILIO_PRIMARY_PROFILE_SID is not a BU… SID — the ISV link cannot be made.");
  }
}

/** @param {StepContext} ctx */
const pathOf = (ctx) => /** @type {A2pRegistrationPath} */ (ctx.record?.registrationPath ?? "standard");

/** @param {StepContext} ctx */
const iso = (ctx) => ctx.now().toISOString();

/** @param {string} label @param {{ ok: true } | { ok: false, fields: string[] }} check */
function requireFields(label, check) {
  if (!check.ok) throw new A2pStepRefused(`${label}: missing or invalid — ${check.fields.join(", ")}.`);
}

/** @param {StepContext} ctx */
const opsEmail = (ctx) => (ctx.env.A2P_OPS_EMAIL ?? "").trim() || DEFAULT_OPS_EMAIL;

/**
 * Resolve the two policies this path files against.
 *
 * Standard: the readiness report already resolved and verified both. Sole-prop: fetch each by
 * SID and verify its friendly name, refusing on a mismatch rather than filing against a policy
 * that is no longer the one we mean.
 *
 * @param {StepContext} ctx
 * @returns {Promise<{ profile: string, trust: string }>}
 */
export async function chainPolicies(ctx) {
  if (pathOf(ctx) === "standard") {
    const profile = ctx.ready.policies.secondaryCustomerProfilePolicySid;
    const trust = ctx.ready.policies.a2pMessagingPolicySid;
    if (!profile || !trust) throw new A2pStepRefused("Readiness did not resolve the standard chain's policies.");
    return { profile, trust };
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const known of SOLE_PROP_POLICIES) {
    const body = await twilioRequest({ method: "GET", url: `${TRUSTHUB}/Policies/${known.sid}`, auth: ctx.auth, fetchImpl: ctx.fetchImpl });
    const name = String(body.friendly_name ?? "").toLowerCase();
    if (!known.expect.every((f) => name.includes(f))) {
      throw new A2pStepRefused(`${known.sid} no longer reads as "${known.label}" — refusing to file against it.`);
    }
    out[known.key] = known.sid;
  }
  return { profile: out.starterCustomerProfilePolicySid, trust: out.soleProprietorTrustProductPolicySid };
}

/**
 * Existing assignments on a bundle, keyed by object SID — so attach steps are idempotent.
 *
 * @param {StepContext} ctx
 * @param {"CustomerProfiles" | "TrustProducts"} kind
 * @param {string} bundleSid
 * @returns {Promise<Record<string, string>>}
 */
async function listAssignments(ctx, kind, bundleSid) {
  const body = await twilioRequest({
    method: "GET",
    url: `${TRUSTHUB}/${kind}/${encodeURIComponent(bundleSid)}/EntityAssignments?PageSize=50`,
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  /** @type {Record<string, string>} */
  const out = {};
  for (const a of Array.isArray(body.results) ? body.results : []) {
    if (a?.object_sid) out[String(a.object_sid)] = String(a.sid ?? "");
  }
  return out;
}

/**
 * Assign each object not already on the bundle, saving after each one.
 *
 * @param {StepContext} ctx
 * @param {"CustomerProfiles" | "TrustProducts"} kind
 * @param {string} bundleSid
 * @param {string[]} objectSids
 * @param {"profileAssignments" | "trustAssignments"} field
 * @param {"profileChangedAt" | "trustChangedAt"} changed
 */
async function assignAll(ctx, kind, bundleSid, objectSids, field, changed) {
  const existing = await listAssignments(ctx, kind, bundleSid);
  let record = /** @type {A2pRegistrationRecord} */ (ctx.record);
  let added = 0;
  if (Object.keys(existing).length) {
    record = await ctx.save({ [field]: existing });
  }
  for (const objectSid of objectSids) {
    if (existing[objectSid]) continue;
    const body = await twilioRequest({
      method: "POST",
      url: `${TRUSTHUB}/${kind}/${encodeURIComponent(bundleSid)}/EntityAssignments`,
      params: { ObjectSid: objectSid },
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
    });
    added++;
    record = await ctx.save({ [field]: { [objectSid]: String(body.sid ?? "") }, [changed]: iso(ctx) });
  }
  return { record, added };
}

/**
 * Is this evaluation a pass that still describes the bundle as it is now?
 *
 * @param {import("./a2p-registration-store.js").StoredEvaluation | undefined} evaluation
 * @param {string | undefined} changedAt
 */
export function evaluationIsCurrent(evaluation, changedAt) {
  if (!evaluation || evaluation.status !== "compliant") return false;
  if (!changedAt) return true;
  return Date.parse(evaluation.at) >= Date.parse(changedAt);
}

// ── Phase 2 — the customer profile ───────────────────────────────────────────────────────────

/**
 * 2.1 — create the secondary (standard) or starter (sole-prop) customer profile.
 * The path is chosen here and is fixed for the life of the record.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function createSecondaryProfile(ctx) {
  requireReady(ctx);
  if (ctx.record?.profileSid) throw new A2pStepRefused(`A profile already exists (${ctx.record.profileSid}).`);
  const path = /** @type {A2pRegistrationPath} */ (ctx.input.registrationPath);
  if (path !== "standard" && path !== "sole-proprietor") {
    throw new A2pStepRefused("registrationPath must be standard or sole-proprietor.");
  }
  if (path === "sole-proprietor" && ctx.plan === "enterprise") {
    // Runbook §3: a sole-prop campaign takes exactly one number, and Enterprise runs 2–3.
    throw new A2pStepRefused("Enterprise cannot register as a sole proprietor — a sole-prop campaign allows one number.");
  }
  const scoped = { ...ctx, record: /** @type {any} */ ({ ...(ctx.record ?? {}), registrationPath: path }) };
  const { profile } = await chainPolicies(scoped);
  const body = await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/CustomerProfiles`,
    params: { PolicySid: profile, FriendlyName: ctx.slug, Email: opsEmail(ctx) },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  const record = await ctx.save({
    registrationPath: path,
    profileSid: String(body.sid ?? ""),
    statuses: { profile: String(body.status ?? "draft") },
    profileChangedAt: iso(ctx),
  });
  return { record, summary: `Created ${path} customer profile ${record.profileSid}.` };
}

/**
 * 2.2 — the business EndUser. **The only consumer of the EIN.** Standard path only.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function createBusinessEndUser(ctx) {
  requireReady(ctx);
  if (pathOf(ctx) !== "standard") throw new A2pStepRefused("The sole-proprietor path has no business EndUser.");
  if (!ctx.record?.profileSid) throw new A2pStepRefused("Create the customer profile first.");
  if (ctx.record.businessEndUserSid) throw new A2pStepRefused(`Business EndUser exists (${ctx.record.businessEndUserSid}) — use the correction step.`);
  const input = /** @type {import("./a2p-identity.js").BusinessEndUserInput} */ (ctx.input);
  requireFields("Business details", validateBusinessInput(input));

  const body = await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/EndUsers`,
    params: {
      Type: "customer_profile_business_information",
      FriendlyName: `${ctx.slug}-business`,
      Attributes: JSON.stringify(buildBusinessEndUserAttributes(input)),
    },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
    submitted: [input.ein],
  });
  const record = await ctx.save({ businessEndUserSid: String(body.sid ?? ""), profileChangedAt: iso(ctx) });
  return { record, summary: `Created business EndUser ${record.businessEndUserSid}. EIN consumed, not stored.` };
}

/**
 * 2.2 correction — change business fields on the existing EndUser WITHOUT the EIN.
 *
 * Verified live 2026-11-02: `POST /v1/EndUsers/{sid}` MERGES `Attributes` — an update naming
 * only `business_name` changed that key and left the other five intact. So a typo in the legal
 * name never requires the EIN to be retyped. Only the keys the operator changed are sent.
 * Refused once the profile is filed: a filed bundle is Twilio's to review, not ours to edit.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function updateBusinessEndUser(ctx) {
  requireReady(ctx);
  const sid = ctx.record?.businessEndUserSid;
  if (!sid) throw new A2pStepRefused("No business EndUser to correct.");
  if (FILED.has(String(ctx.record?.statuses?.profile ?? ""))) throw new A2pStepRefused("The profile is already filed.");
  /** @type {Record<string, string>} */
  const attributes = {};
  const i = ctx.input;
  if (typeof i.legalBusinessName === "string" && i.legalBusinessName.trim()) attributes.business_name = i.legalBusinessName.trim();
  if (A2P_BUSINESS_TYPES.some((t) => t.value === i.businessType)) attributes.business_type = i.businessType;
  if (A2P_BUSINESS_INDUSTRIES.some((t) => t.value === i.businessIndustry)) attributes.business_industry = i.businessIndustry;
  if (typeof i.websiteUrl === "string" && /^https?:\/\//.test(i.websiteUrl.trim())) attributes.website_url = i.websiteUrl.trim();
  if (!Object.keys(attributes).length) throw new A2pStepRefused("Nothing to correct.");
  await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/EndUsers/${encodeURIComponent(sid)}`,
    params: { Attributes: JSON.stringify(attributes) },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  const record = await ctx.save({ profileChangedAt: iso(ctx) });
  return { record, summary: `Corrected ${Object.keys(attributes).join(", ")} on ${sid}.` };
}

/**
 * 2.3 — the person. `authorized_representative_1` (standard) or
 * `starter_customer_profile_information` (sole-prop). **The only consumer of their details.**
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function createRepEndUser(ctx) {
  requireReady(ctx);
  if (!ctx.record?.profileSid) throw new A2pStepRefused("Create the customer profile first.");
  if (ctx.record.repEndUserSid) throw new A2pStepRefused(`Representative EndUser exists (${ctx.record.repEndUserSid}).`);
  const path = pathOf(ctx);
  const input = /** @type {import("./a2p-identity.js").RepInput} */ (ctx.input);
  requireFields("Representative", validateRepInput(input, path));
  const body = await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/EndUsers`,
    params: {
      Type: repEndUserType(path),
      FriendlyName: `${ctx.slug}-rep`,
      Attributes: JSON.stringify(buildRepEndUserAttributes(input, path)),
    },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
    submitted: [input.email, input.phone, input.firstName, input.lastName],
  });
  const record = await ctx.save({ repEndUserSid: String(body.sid ?? ""), profileChangedAt: iso(ctx) });
  return { record, summary: `Created representative EndUser ${record.repEndUserSid}. Personal details not stored.` };
}

/**
 * 2.3 correction — change the representative's `job_position` / `business_title` WITHOUT
 * resending their name, email or phone. `POST /v1/EndUsers/{sid}` merges attributes (verified
 * live), so only the changed keys go out. Exists because the first live evaluation failed on
 * `job_position` alone, and recreating the EndUser would have meant retyping personal details
 * for a one-word fix. Refused once the profile is filed.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function updateRepEndUser(ctx) {
  requireReady(ctx);
  const sid = ctx.record?.repEndUserSid;
  if (!sid) throw new A2pStepRefused("No representative EndUser to correct.");
  if (pathOf(ctx) !== "standard") throw new A2pStepRefused("The starter profile's person has no title fields.");
  if (FILED.has(String(ctx.record?.statuses?.profile ?? ""))) throw new A2pStepRefused("The profile is already filed.");
  /** @type {Record<string, string>} */
  const attributes = {};
  if (A2P_JOB_POSITIONS.includes(String(ctx.input.jobPosition ?? ""))) attributes.job_position = String(ctx.input.jobPosition);
  if (typeof ctx.input.businessTitle === "string" && ctx.input.businessTitle.trim()) attributes.business_title = ctx.input.businessTitle.trim();
  if (!Object.keys(attributes).length) throw new A2pStepRefused("Nothing to correct (job position must be one of the allowed values).");
  await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/EndUsers/${encodeURIComponent(sid)}`,
    params: { Attributes: JSON.stringify(attributes) },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  const record = await ctx.save({ profileChangedAt: iso(ctx) });
  return { record, summary: `Corrected ${Object.keys(attributes).join(", ")} on ${sid}.` };
}

/**
 * 2.4 — the Address, then the supporting document wrapping it. Two calls; the address SID is
 * saved before the second, so a failure there resumes rather than duplicating the address.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function createAddressAndDocument(ctx) {
  requireReady(ctx);
  if (!ctx.record?.profileSid) throw new A2pStepRefused("Create the customer profile first.");
  if (ctx.record.addressDocSid) throw new A2pStepRefused(`Address document exists (${ctx.record.addressDocSid}).`);
  let record = ctx.record;
  let addressSid = record.addressSid;
  if (!addressSid) {
    const input = /** @type {import("./a2p-identity.js").AddressInput} */ (ctx.input);
    requireFields("Address", validateAddressInput(input));
    const address = await twilioRequest({
      method: "POST",
      url: `${TWILIO_API}/Accounts/${encodeURIComponent(ctx.auth.accountSid)}/Addresses.json`,
      params: { ...buildAddressParams(input), FriendlyName: `${ctx.slug}-address` },
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
    });
    addressSid = String(address.sid ?? "");
    record = await ctx.save({ addressSid });
  }
  const doc = await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/SupportingDocuments`,
    // `customer_profile_address` on BOTH paths: the starter policy accepts it too (recorded).
    params: { Type: "customer_profile_address", FriendlyName: `${ctx.slug}-address`, Attributes: JSON.stringify({ address_sids: addressSid }) },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  record = await ctx.save({ addressDocSid: String(doc.sid ?? ""), profileChangedAt: iso(ctx) });
  return { record, summary: `Created address ${addressSid} and document ${record.addressDocSid}.` };
}

/**
 * The objects a profile must carry before it can be evaluated, in attach order. The LAST one is
 * JDD's primary profile — the assignment that declares the reseller relationship.
 *
 * @param {A2pRegistrationRecord | null} record
 * @param {string} primaryProfileSid
 */
export function profileObjects(record, primaryProfileSid) {
  const path = record?.registrationPath ?? "standard";
  return [
    ...(path === "standard" ? [record?.businessEndUserSid] : []),
    record?.repEndUserSid,
    record?.addressDocSid,
    primaryProfileSid,
  ];
}

/**
 * 2.5 — attach everything to the profile, primary profile included. Idempotent.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function attachEntities(ctx) {
  requireReady(ctx);
  const profileSid = ctx.record?.profileSid;
  if (!profileSid) throw new A2pStepRefused("Create the customer profile first.");
  const objects = profileObjects(ctx.record, ctx.primaryProfileSid);
  if (objects.some((s) => !s)) throw new A2pStepRefused("Create every identity object before attaching.");
  const { record, added } = await assignAll(ctx, "CustomerProfiles", profileSid, /** @type {string[]} */ (objects), "profileAssignments", "profileChangedAt");
  return { record, summary: `Attached ${added} object(s) to ${profileSid} (${objects.length} required, primary profile included).` };
}

/**
 * Run a free compliance evaluation and store the summary.
 *
 * @param {StepContext} ctx
 * @param {"CustomerProfiles" | "TrustProducts"} kind
 * @param {string} bundleSid
 * @param {string} policySid
 * @param {"lastEvaluation" | "lastTrustEvaluation"} field
 */
async function evaluate(ctx, kind, bundleSid, policySid, field) {
  const body = await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/${kind}/${encodeURIComponent(bundleSid)}/Evaluations`,
    params: { PolicySid: policySid },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  const summary = summarizeEvaluation(body);
  const record = await ctx.save({ [field]: { ...summary, at: iso(ctx) } });
  return { record, summary };
}

/**
 * 2.6 — evaluate the profile. Free, repeatable, the answer to "a wrong field costs days".
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function evaluateProfile(ctx) {
  requireReady(ctx);
  const profileSid = ctx.record?.profileSid;
  if (!profileSid) throw new A2pStepRefused("Create the customer profile first.");
  const { profile } = await chainPolicies(ctx);
  const { record, summary } = await evaluate(ctx, "CustomerProfiles", profileSid, profile, "lastEvaluation");
  return { record, summary: `Profile evaluated: ${summary.status}${summary.failures.length ? ` — ${summary.failures.length} field(s) failing` : ""}.` };
}

/**
 * Submit a bundle for review, gated on a current, compliant evaluation.
 *
 * @param {StepContext} ctx
 * @param {"CustomerProfiles" | "TrustProducts"} kind
 * @param {string | undefined} bundleSid
 * @param {import("./a2p-registration-store.js").StoredEvaluation | undefined} evaluation
 * @param {string | undefined} changedAt
 * @param {"profile" | "trustProduct"} statusKey
 */
async function submit(ctx, kind, bundleSid, evaluation, changedAt, statusKey) {
  requireReady(ctx);
  if (!bundleSid) throw new A2pStepRefused("Nothing to submit.");
  if (FILED.has(String(ctx.record?.statuses?.[statusKey] ?? ""))) throw new A2pStepRefused("Already submitted.");
  if (!evaluation) throw new A2pStepRefused("Evaluate before submitting — there is no evaluation on record.");
  if (evaluation.status !== "compliant") {
    throw new A2pStepRefused(`The last evaluation was ${evaluation.status} — fix the failing fields and evaluate again.`);
  }
  if (!evaluationIsCurrent(evaluation, changedAt)) {
    throw new A2pStepRefused("The bundle changed after its last evaluation — evaluate again before submitting.");
  }
  const body = await twilioRequest({
    method: "POST",
    url: `${TRUSTHUB}/${kind}/${encodeURIComponent(bundleSid)}`,
    params: { Status: "pending-review" },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  const status = String(body.status ?? "pending-review");
  const record = await ctx.save({ statuses: { [statusKey]: status } });
  return { record, summary: `Submitted ${bundleSid} for review (${status}).` };
}

/**
 * 2.7 — submit the profile. **Blocked unless the last evaluation is compliant and current.**
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function submitProfile(ctx) {
  return submit(ctx, "CustomerProfiles", ctx.record?.profileSid, ctx.record?.lastEvaluation, ctx.record?.profileChangedAt, "profile");
}

// ── Phase 3 — trust product and brand ────────────────────────────────────────────────────────

/**
 * 3.1 — the trust product: the bundle, its EndUser, and two assignments (the EndUser and the
 * client's customer profile). Recorded on JDD's own approved A2P trust product: its
 * assignments are exactly one `IT…` and one `BU…`.
 *
 * Sole-prop: the EndUser carries the owner's MOBILE, where the carrier's OTP lands — consumed by
 * this call, never stored. If anything after that EndUser's create fails before its SID is
 * saved, the EndUser is deleted rather than orphaned holding the number.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function createTrustProduct(ctx) {
  requireReady(ctx);
  const profileStatus = String(ctx.record?.statuses?.profile ?? "");
  if (!ctx.record?.profileSid || !FILED.has(profileStatus)) throw new A2pStepRefused("Submit the customer profile first.");
  const path = pathOf(ctx);
  const { trust } = await chainPolicies(ctx);
  let record = ctx.record;

  let trustProductSid = record.trustProductSid;
  if (!trustProductSid) {
    const body = await twilioRequest({
      method: "POST",
      url: `${TRUSTHUB}/TrustProducts`,
      params: { PolicySid: trust, FriendlyName: `${ctx.slug}-a2p`, Email: opsEmail(ctx) },
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
    });
    trustProductSid = String(body.sid ?? "");
    record = await ctx.save({ trustProductSid, statuses: { trustProduct: String(body.status ?? "draft") }, trustChangedAt: iso(ctx) });
  }

  let trustEndUserSid = record.trustEndUserSid;
  if (!trustEndUserSid) {
    const input = /** @type {import("./a2p-identity.js").TrustProductInput} */ (ctx.input);
    requireFields("Trust product", validateTrustProductInput(input, path));
    const { type, attributes } = buildTrustEndUser(input, path);
    const body = await twilioRequest({
      method: "POST",
      url: `${TRUSTHUB}/EndUsers`,
      params: { Type: type, FriendlyName: `${ctx.slug}-a2p-profile`, Attributes: JSON.stringify(attributes) },
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
      submitted: [String(input.mobile ?? ""), String(input.brandContactEmail ?? "")],
    });
    trustEndUserSid = String(body.sid ?? "");
    try {
      record = await ctx.save({ trustEndUserSid, trustChangedAt: iso(ctx) });
    } catch (error) {
      await deleteEndUsers({ endUserSids: [trustEndUserSid], auth: ctx.auth, fetchImpl: ctx.fetchImpl });
      throw error;
    }
  }

  const { record: after, added } = await assignAll(
    { ...ctx, record },
    "TrustProducts",
    trustProductSid,
    [trustEndUserSid, /** @type {string} */ (record.profileSid)],
    "trustAssignments",
    "trustChangedAt",
  );
  return { record: after, summary: `Trust product ${trustProductSid} ready (${added} assignment(s) made).` };
}

/**
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function evaluateTrustProduct(ctx) {
  requireReady(ctx);
  const sid = ctx.record?.trustProductSid;
  if (!sid) throw new A2pStepRefused("Create the trust product first.");
  const { trust } = await chainPolicies(ctx);
  const { record, summary } = await evaluate(ctx, "TrustProducts", sid, trust, "lastTrustEvaluation");
  return { record, summary: `Trust product evaluated: ${summary.status}${summary.failures.length ? ` — ${summary.failures.length} field(s) failing` : ""}.` };
}

/**
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function submitTrustProduct(ctx) {
  return submit(ctx, "TrustProducts", ctx.record?.trustProductSid, ctx.record?.lastTrustEvaluation, ctx.record?.trustChangedAt, "trustProduct");
}

/**
 * 3.2 — register the brand. Low-Volume Standard is `BrandType=STANDARD` +
 * `SkipAutomaticSecVet=true` (Twilio: skip-vet "is only for registering a Low Volume Standard
 * Brand"); there is no separate brand type. `Mock=true` registers a brand that moves through
 * real status transitions and can never send.
 *
 * Gated on both bundles being at least `in-review` — the sole-prop guide's explicit rule
 * ("proceed once in-review… do not wait for twilio-approved"), applied to both paths because
 * filing a brand against a bundle still sitting in `pending-review` or rejected is a fee for a
 * likely failure.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function registerBrand(ctx) {
  requireReady(ctx);
  const r = ctx.record;
  if (r?.brandSid) throw new A2pStepRefused(`Brand already registered (${r.brandSid}).`);
  if (!r?.profileSid || !r.trustProductSid) throw new A2pStepRefused("Both bundles must exist first.");
  if (!UNDER_REVIEW.has(String(r.statuses?.profile ?? "")) || !UNDER_REVIEW.has(String(r.statuses?.trustProduct ?? ""))) {
    throw new A2pStepRefused("Both bundles must be in-review or approved — refresh status first.");
  }
  const mock = ctx.input.mock === true;
  const path = pathOf(ctx);
  /** @type {Record<string, string>} */
  const params = {
    CustomerProfileBundleSid: r.profileSid,
    A2PProfileBundleSid: r.trustProductSid,
    BrandType: path === "sole-proprietor" ? "SOLE_PROPRIETOR" : "STANDARD",
  };
  if (path === "standard") params.SkipAutomaticSecVet = "true";
  if (mock) params.Mock = "true";
  const body = await twilioRequest({ method: "POST", url: `${MESSAGING}/a2p/BrandRegistrations`, params, auth: ctx.auth, fetchImpl: ctx.fetchImpl });
  const record = await ctx.save({
    brandSid: String(body.sid ?? ""),
    brandType: String(body.brand_type ?? params.BrandType),
    mock: body.mock === true || mock,
    statuses: { brand: String(body.status ?? "PENDING"), brandIdentity: String(body.identity_status ?? "") },
  });
  return { record, summary: `Registered ${mock ? "MOCK " : ""}${params.BrandType} brand ${record.brandSid}.` };
}

/**
 * Sole-prop only — resend the carrier OTP. It fires automatically when the brand reaches
 * APPROVED and is valid 24 hours; TCR may expire a brand whose OTP stays unanswered for 30 days.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function resendBrandOtp(ctx) {
  requireReady(ctx);
  const r = ctx.record;
  if (pathOf(ctx) !== "sole-proprietor") throw new A2pStepRefused("Only sole-proprietor brands have an OTP.");
  if (!r?.brandSid || r.statuses?.brand !== "APPROVED") throw new A2pStepRefused("The OTP is sent once the brand is APPROVED.");
  if (r.statuses?.brandIdentity === "VERIFIED") throw new A2pStepRefused("The owner already confirmed the OTP.");
  await twilioRequest({ method: "POST", url: `${MESSAGING}/a2p/BrandRegistrations/${encodeURIComponent(r.brandSid)}/SmsOtp`, auth: ctx.auth, fetchImpl: ctx.fetchImpl });
  const record = await ctx.save({ gates: { "brand.otp.sent": iso(ctx) } });
  return { record, summary: `Resent the OTP for ${r.brandSid}.` };
}

// ── Phase 4 — Messaging Service, campaign, number ────────────────────────────────────────────

/**
 * 4.1 — the client's own Messaging Service. `UseInboundWebhookOnNumber=false` is what wires
 * inbound SMS to the agency webhook, which resolves the client from the `To` number.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function createClientMessagingService(ctx) {
  requireReady(ctx);
  const r = ctx.record;
  if (r?.messagingServiceSid) throw new A2pStepRefused(`Service exists (${r.messagingServiceSid}).`);
  if (!r?.brandSid) throw new A2pStepRefused("Register the brand first.");
  const friendlyName = String(ctx.input.friendlyName ?? "").trim();
  if (!friendlyName) throw new A2pStepRefused("A friendly name is required.");
  const body = await twilioRequest({
    method: "POST",
    url: `${MESSAGING}/Services`,
    params: {
      FriendlyName: friendlyName.slice(0, 64),
      InboundRequestUrl: (ctx.env.A2P_INBOUND_URL ?? "").trim() || DEFAULT_INBOUND_URL,
      UseInboundWebhookOnNumber: "false",
      StatusCallback: (ctx.env.A2P_STATUS_CALLBACK ?? "").trim() || DEFAULT_STATUS_CALLBACK,
    },
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  const record = await ctx.save({ messagingServiceSid: String(body.sid ?? "") });
  return { record, summary: `Created Messaging Service ${record.messagingServiceSid}.` };
}

/**
 * Validate campaign content against the limits on Twilio's Usa2p reference.
 *
 * @param {Record<string, any>} input
 * @param {A2pRegistrationPath} path
 * @returns {{ ok: true } | { ok: false, fields: string[] }}
 */
export function validateCampaignInput(input, path) {
  /** @type {string[]} */
  const fields = [];
  const len = (/** @type {unknown} */ v) => String(v ?? "").trim().length;
  if (len(input.description) < 40 || len(input.description) > 4096) fields.push("description (40–4096)");
  if (len(input.messageFlow) < 40 || len(input.messageFlow) > 2048) fields.push("messageFlow (40–2048)");
  const samples = Array.isArray(input.messageSamples) ? input.messageSamples.filter((s) => len(s) > 0) : [];
  if (samples.length < 2 || samples.length > 5 || samples.some((s) => len(s) < 20 || len(s) > 1024)) {
    fields.push("messageSamples (2–5, each 20–1024)");
  }
  for (const key of ["optInMessage", "optOutMessage", "helpMessage"]) {
    if (len(input[key]) && (len(input[key]) < 20 || len(input[key]) > 320)) fields.push(`${key} (20–320)`);
  }
  if (path === "standard" && !STANDARD_USECASES.includes(String(input.usecase ?? ""))) fields.push("usecase");
  if (typeof input.hasEmbeddedLinks !== "boolean") fields.push("hasEmbeddedLinks");
  if (typeof input.hasEmbeddedPhone !== "boolean") fields.push("hasEmbeddedPhone");
  return fields.length ? { ok: false, fields } : { ok: true };
}

/**
 * 4.2 — the campaign. Creating it submits it for review and incurs fees (Twilio). Gated on the
 * brand being APPROVED (Twilio: "Do not continue… until the BrandRegistration's status is
 * APPROVED"), and on a sole-prop brand's OTP having been confirmed.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function createCampaign(ctx) {
  requireReady(ctx);
  const r = ctx.record;
  if (r?.campaignSid) throw new A2pStepRefused(`Campaign exists (${r.campaignSid}).`);
  if (!r?.messagingServiceSid || !r.brandSid) throw new A2pStepRefused("The brand and the Messaging Service must exist first.");
  if (r.statuses?.brand !== "APPROVED") throw new A2pStepRefused("The brand is not APPROVED yet — refresh status.");
  const path = pathOf(ctx);
  if (path === "sole-proprietor" && r.statuses?.brandIdentity !== "VERIFIED") {
    throw new A2pStepRefused("The owner has not confirmed the carrier OTP yet (identity is not VERIFIED).");
  }
  const input = ctx.input;
  requireFields("Campaign", validateCampaignInput(input, path));
  /** @type {Record<string, string | string[]>} */
  const params = {
    BrandRegistrationSid: r.brandSid,
    UsAppToPersonUsecase: path === "sole-proprietor" ? "SOLE_PROPRIETOR" : String(input.usecase),
    Description: String(input.description).trim(),
    MessageFlow: String(input.messageFlow).trim(),
    MessageSamples: input.messageSamples.map((/** @type {string} */ s) => s.trim()).filter(Boolean),
    HasEmbeddedLinks: String(input.hasEmbeddedLinks),
    HasEmbeddedPhone: String(input.hasEmbeddedPhone),
  };
  for (const [key, param] of [["optInMessage", "OptInMessage"], ["optOutMessage", "OptOutMessage"], ["helpMessage", "HelpMessage"]]) {
    if (String(input[key] ?? "").trim()) params[param] = String(input[key]).trim();
  }
  const body = await twilioRequest({
    method: "POST",
    url: `${MESSAGING}/Services/${encodeURIComponent(r.messagingServiceSid)}/Compliance/Usa2p`,
    params,
    auth: ctx.auth,
    fetchImpl: ctx.fetchImpl,
  });
  const record = await ctx.save({ campaignSid: String(body.sid ?? ""), statuses: { campaign: String(body.campaign_status ?? "PENDING") } });
  return { record, summary: `Created ${params.UsAppToPersonUsecase} campaign ${record.campaignSid}.` };
}

/**
 * 4.3 — add a site's number to the client's service, then READ IT BACK.
 *
 * A number sits in one Messaging Service at a time, and every number onboard.js buys today is
 * added to JDD's master pool. So the number has to LEAVE the master pool to join the client's
 * service — a write to a JDD-wide resource, which is why it is refused unless the operator
 * ticked `moveFromMaster` for this exact click. Without that, the step reports where the number
 * is and does nothing.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function attachNumberToService(ctx) {
  requireReady(ctx);
  const r = ctx.record;
  const serviceSid = r?.messagingServiceSid;
  if (!serviceSid) throw new A2pStepRefused("Create the Messaging Service first.");
  const siteSlug = String(ctx.input.siteSlug ?? "");
  const e164 = String(ctx.input.e164 ?? "");
  if (!siteSlug || !/^\+1\d{10}$/.test(e164)) throw new A2pStepRefused("A site slug and its E.164 TWILIO_NUMBER are required.");
  if (pathOf(ctx) === "sole-proprietor" && Object.keys(r.numbers ?? {}).some((s) => s !== siteSlug)) {
    throw new A2pStepRefused("A sole-proprietor campaign allows exactly one number.");
  }

  let phoneNumberSid = r.numbers?.[siteSlug]?.phoneNumberSid;
  if (!phoneNumberSid) {
    const list = await twilioRequest({
      method: "GET",
      url: `${TWILIO_API}/Accounts/${encodeURIComponent(ctx.auth.accountSid)}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(e164)}`,
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
    });
    phoneNumberSid = String(list.incoming_phone_numbers?.[0]?.sid ?? "");
    if (!phoneNumberSid) throw new A2pStepRefused(`${e164} is not a number on this Twilio account.`);
  }

  const master = (ctx.env.TWILIO_MESSAGING_SERVICE_SID ?? "").trim();
  if (master && master !== serviceSid && (await inService(ctx, master, phoneNumberSid))) {
    if (ctx.input.moveFromMaster !== true) {
      throw new A2pStepRefused(`${e164} is in JDD's master pool (${master}). Confirm the move to take it out of the master pool.`);
    }
    await twilioRequest({
      method: "DELETE",
      url: `${MESSAGING}/Services/${encodeURIComponent(master)}/PhoneNumbers/${encodeURIComponent(phoneNumberSid)}`,
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
    });
  }

  if (!(await inService(ctx, serviceSid, phoneNumberSid))) {
    await twilioRequest({
      method: "POST",
      url: `${MESSAGING}/Services/${encodeURIComponent(serviceSid)}/PhoneNumbers`,
      params: { PhoneNumberSid: phoneNumberSid },
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
    });
  }
  // Do not trust the write — a number that silently failed to join sends unregistered (30034).
  const confirmed = await inService(ctx, serviceSid, phoneNumberSid);
  const at = iso(ctx);
  const record = await ctx.save({ numbers: { [siteSlug]: { e164, phoneNumberSid, attachedAt: at, inService: confirmed, checkedAt: at } } });
  if (!confirmed) throw new A2pVendorError(`Twilio accepted the attach but ${e164} is not in ${serviceSid} on read-back.`, 502);
  return { record, summary: `${e164} joined ${serviceSid} (read back).` };
}

/**
 * Is a number in a service? `GET …/PhoneNumbers/{PN}` — 200 yes, 404 no.
 *
 * @param {StepContext} ctx
 * @param {string} serviceSid
 * @param {string} phoneNumberSid
 */
async function inService(ctx, serviceSid, phoneNumberSid) {
  try {
    await twilioRequest({
      method: "GET",
      url: `${MESSAGING}/Services/${encodeURIComponent(serviceSid)}/PhoneNumbers/${encodeURIComponent(phoneNumberSid)}`,
      auth: ctx.auth,
      fetchImpl: ctx.fetchImpl,
    });
    return true;
  } catch (error) {
    if (error instanceof A2pVendorError && error.status === 404) return false;
    throw error;
  }
}

// ── Phase 5 — status ─────────────────────────────────────────────────────────────────────────

/**
 * 5.1 — read every status the record can name. Read-only; no readiness gate, because reading is
 * how an operator finds out what is wrong. The only writes are to our own record.
 *
 * @param {StepContext} ctx
 * @returns {Promise<StepResult>}
 */
export async function readStatuses(ctx) {
  const r = ctx.record;
  if (!r) throw new A2pStepRefused("Nothing registered yet.");
  /** @type {Record<string, string>} */
  const statuses = {};
  /** @type {{ brand?: string[], campaign?: string[] }} */
  const errors = {};
  const get = (/** @type {string} */ url) => twilioRequest({ method: "GET", url, auth: ctx.auth, fetchImpl: ctx.fetchImpl });

  if (r.profileSid) statuses.profile = String((await get(`${TRUSTHUB}/CustomerProfiles/${r.profileSid}`)).status ?? "");
  if (r.trustProductSid) statuses.trustProduct = String((await get(`${TRUSTHUB}/TrustProducts/${r.trustProductSid}`)).status ?? "");
  if (r.brandSid) {
    const brand = await get(`${MESSAGING}/a2p/BrandRegistrations/${r.brandSid}`);
    statuses.brand = String(brand.status ?? "");
    statuses.brandIdentity = String(brand.identity_status ?? "");
    errors.brand = errorList(brand);
  }
  if (r.messagingServiceSid) {
    const list = await get(`${MESSAGING}/Services/${r.messagingServiceSid}/Compliance/Usa2p`);
    const campaigns = Array.isArray(list.compliance) ? list.compliance : [];
    // Prefer the campaign we filed; a mock brand creates one on its own, which we adopt.
    const mine = campaigns.find((c) => c?.sid === r.campaignSid) ?? (r.campaignSid ? null : campaigns[0]);
    if (mine) {
      statuses.campaign = String(mine.campaign_status ?? "");
      errors.campaign = errorList(mine);
    }
    /** @type {Record<string, any>} */
    const numbers = {};
    for (const [site, n] of Object.entries(r.numbers ?? {})) {
      numbers[site] = { ...n, inService: await inService(ctx, r.messagingServiceSid, n.phoneNumberSid), checkedAt: iso(ctx) };
    }
    statuses.refreshedAt = iso(ctx);
    /** @type {Partial<A2pRegistrationRecord>} */
    const patch = { statuses, errors, numbers };
    if (mine && !r.campaignSid && mine.sid) patch.campaignSid = String(mine.sid);
    const record = await ctx.save(patch);
    return { record, summary: `Refreshed: ${describeStatuses(record)}.` };
  }
  statuses.refreshedAt = iso(ctx);
  const record = await ctx.save({ statuses, errors });
  return { record, summary: `Refreshed: ${describeStatuses(record)}.` };
}

/** @param {Record<string, any>} body */
function errorList(body) {
  const raw = Array.isArray(body.errors) ? body.errors : [];
  return raw.map((e) => (typeof e === "string" ? e : String(e?.description ?? e?.message ?? JSON.stringify(e)))).slice(0, 10);
}

/** @param {A2pRegistrationRecord} r */
export function describeStatuses(r) {
  const s = r.statuses ?? {};
  return [
    s.profile && `profile ${s.profile}`,
    s.trustProduct && `trust product ${s.trustProduct}`,
    s.brand && `brand ${s.brand}${s.brandIdentity ? `/${s.brandIdentity}` : ""}`,
    s.campaign && `campaign ${s.campaign}`,
  ].filter(Boolean).join(", ") || "nothing filed";
}

/**
 * `PortalSite.a2pStatus` derived from the record — one pure function, so every surface agrees.
 *
 * Two deliberate caps on `verified`: every attached number must be confirmed in the service
 * (a verified campaign with no number in it sends nothing), and a MOCK registration never
 * reports `verified`, because a mock brand cannot send — telling a portal otherwise would be
 * the one lie this field exists to avoid.
 *
 * @param {A2pRegistrationRecord | null} r
 * @returns {import("@jdd/schema").A2pStatus}
 */
export function portalStatusFor(r) {
  if (!r) return "none";
  const s = r.statuses ?? {};
  if (["twilio-rejected"].includes(String(s.profile)) || ["twilio-rejected"].includes(String(s.trustProduct))) return "failed";
  if (["FAILED", "SUSPENDED"].includes(String(s.brand)) || ["FAILED", "SUSPENDED"].includes(String(s.campaign))) return "failed";
  const numbers = Object.values(r.numbers ?? {});
  if (s.campaign === "VERIFIED" && numbers.length && numbers.every((n) => n.inService) && !r.mock) return "verified";
  if (r.campaignSid) return "campaign-pending";
  if (s.brand === "APPROVED") return "brand-approved";
  if (r.brandSid) return "brand-pending";
  if (s.profile === "twilio-approved") return "profile-approved";
  if (FILED.has(String(s.profile))) return "profile-pending";
  return "none";
}

// ── The step table, availability, and the one entry point ────────────────────────────────────

/**
 * Every step, in order. `write: false` steps skip the readiness gate.
 *
 * @type {ReadonlyArray<{ id: string, runbook: string, label: string, write: boolean, path?: A2pRegistrationPath, run: (ctx: StepContext) => Promise<StepResult> }>}
 */
export const STEPS = Object.freeze([
  { id: "profile.create", runbook: "2.1", label: "Create customer profile", write: true, run: createSecondaryProfile },
  { id: "business.create", runbook: "2.2", label: "Business identity (EIN)", write: true, path: "standard", run: createBusinessEndUser },
  { id: "business.update", runbook: "2.2", label: "Correct business identity", write: true, path: "standard", run: updateBusinessEndUser },
  { id: "rep.create", runbook: "2.3", label: "Authorized representative", write: true, run: createRepEndUser },
  { id: "rep.update", runbook: "2.3", label: "Correct representative title", write: true, path: "standard", run: updateRepEndUser },
  { id: "address.create", runbook: "2.4", label: "Business address", write: true, run: createAddressAndDocument },
  { id: "profile.attach", runbook: "2.5", label: "Attach to profile (incl. JDD primary)", write: true, run: attachEntities },
  { id: "profile.evaluate", runbook: "2.6", label: "Evaluate profile", write: true, run: evaluateProfile },
  { id: "profile.submit", runbook: "2.7", label: "Submit profile for review", write: true, run: submitProfile },
  { id: "trust.create", runbook: "3.1", label: "Create A2P trust product", write: true, run: createTrustProduct },
  { id: "trust.evaluate", runbook: "3.1", label: "Evaluate trust product", write: true, run: evaluateTrustProduct },
  { id: "trust.submit", runbook: "3.1", label: "Submit trust product", write: true, run: submitTrustProduct },
  { id: "brand.register", runbook: "3.2", label: "Register brand", write: true, run: registerBrand },
  { id: "brand.otp", runbook: "3.2", label: "Resend owner OTP", write: true, path: "sole-proprietor", run: resendBrandOtp },
  { id: "service.create", runbook: "4.1", label: "Client Messaging Service", write: true, run: createClientMessagingService },
  { id: "campaign.create", runbook: "4.2", label: "Create campaign", write: true, run: createCampaign },
  { id: "number.attach", runbook: "4.3", label: "Attach number(s)", write: true, run: attachNumberToService },
  { id: "status.refresh", runbook: "5.1", label: "Refresh status", write: false, run: readStatuses },
]);

/**
 * Which steps are legal right now, and why the others are not — the stepper's whole state, and
 * the server's gate. Derived from the record only, so the next legal action is always the one
 * enabled button (plan §10 risk 3) and the UI can never offer a step the server would refuse.
 * Step functions re-check their own preconditions regardless.
 *
 * @param {A2pRegistrationRecord | null} r
 * @param {{ plan: string, primaryProfileSid?: string, siteSlugs?: string[] }} opts
 * @returns {Record<string, { done: boolean, enabled: boolean, reason?: string }>}
 */
export function availability(r, { plan, primaryProfileSid = "", siteSlugs = [] }) {
  const path = r?.registrationPath ?? "standard";
  const s = r?.statuses ?? {};
  /** @type {Record<string, { done: boolean, enabled: boolean, reason?: string }>} */
  const out = {};
  const set = (/** @type {string} */ id, /** @type {boolean} */ done, /** @type {string | null} */ blocked) => {
    out[id] = { done, enabled: !done && !blocked, ...(blocked && !done ? { reason: blocked } : {}) };
  };
  const registers = REGISTERING_PLANS.includes(plan);
  const noProfile = !registers ? "Only Growth and Enterprise register." : null;

  set("profile.create", Boolean(r?.profileSid), noProfile);
  const needProfile = r?.profileSid ? null : "Create the customer profile first.";
  const filed = FILED.has(String(s.profile ?? ""));
  if (path === "standard") {
    set("business.create", Boolean(r?.businessEndUserSid), needProfile);
    out["business.update"] = {
      done: false,
      enabled: Boolean(r?.businessEndUserSid) && !filed,
      ...(!r?.businessEndUserSid ? { reason: "No business EndUser yet." } : filed ? { reason: "The profile is filed." } : {}),
    };
  } else {
    out["business.create"] = { done: true, enabled: false, reason: "Not used on the sole-proprietor path." };
    out["business.update"] = { done: false, enabled: false, reason: "Not used on the sole-proprietor path." };
  }
  set("rep.create", Boolean(r?.repEndUserSid), needProfile);
  out["rep.update"] =
    path === "standard"
      ? {
          done: false,
          enabled: Boolean(r?.repEndUserSid) && !filed,
          ...(!r?.repEndUserSid ? { reason: "No representative EndUser yet." } : filed ? { reason: "The profile is filed." } : {}),
        }
      : { done: false, enabled: false, reason: "Not used on the sole-proprietor path." };
  set("address.create", Boolean(r?.addressDocSid), needProfile);

  const objects = profileObjects(r, primaryProfileSid);
  const allObjects = objects.every(Boolean);
  const attached = allObjects && objects.every((o) => r?.profileAssignments?.[/** @type {string} */ (o)]);
  set("profile.attach", attached, needProfile ?? (allObjects ? null : "Create every identity object first."));
  out["profile.evaluate"] = { done: false, enabled: attached && !filed, ...(!attached ? { reason: "Attach everything first." } : filed ? { reason: "Already filed." } : {}) };
  const evalOk = evaluationIsCurrent(r?.lastEvaluation, r?.profileChangedAt);
  set("profile.submit", filed, !attached ? "Attach everything first." : !evalOk ? "Needs a current, compliant evaluation." : null);

  const trustAttached = Boolean(r?.trustProductSid && r?.trustEndUserSid && r?.profileSid && r?.trustAssignments?.[r.trustEndUserSid] && r?.trustAssignments?.[r.profileSid]);
  set("trust.create", trustAttached, filed ? null : "Submit the customer profile first.");
  const trustFiled = FILED.has(String(s.trustProduct ?? ""));
  out["trust.evaluate"] = { done: false, enabled: trustAttached && !trustFiled, ...(!trustAttached ? { reason: "Create the trust product first." } : trustFiled ? { reason: "Already filed." } : {}) };
  const trustEvalOk = evaluationIsCurrent(r?.lastTrustEvaluation, r?.trustChangedAt);
  set("trust.submit", trustFiled, !trustAttached ? "Create the trust product first." : !trustEvalOk ? "Needs a current, compliant evaluation." : null);

  const bundlesReviewed = UNDER_REVIEW.has(String(s.profile ?? "")) && UNDER_REVIEW.has(String(s.trustProduct ?? ""));
  set("brand.register", Boolean(r?.brandSid), bundlesReviewed ? null : "Both bundles must be in-review or approved (refresh status).");
  if (path === "sole-proprietor") {
    const verified = s.brandIdentity === "VERIFIED";
    out["brand.otp"] = { done: verified, enabled: s.brand === "APPROVED" && !verified, ...(s.brand !== "APPROVED" && !verified ? { reason: "Sent once the brand is APPROVED." } : {}) };
  } else {
    out["brand.otp"] = { done: true, enabled: false, reason: "Standard brands have no OTP." };
  }
  set("service.create", Boolean(r?.messagingServiceSid), r?.brandSid ? null : "Register the brand first.");
  const brandReady = s.brand === "APPROVED" && (path === "standard" || s.brandIdentity === "VERIFIED");
  set("campaign.create", Boolean(r?.campaignSid), !r?.messagingServiceSid ? "Create the Messaging Service first." : brandReady ? null : "The brand must be APPROVED (and, for sole-prop, OTP-verified).");
  const sites = path === "sole-proprietor" ? siteSlugs.slice(0, 1) : siteSlugs;
  const allIn = sites.length > 0 && sites.every((site) => r?.numbers?.[site]?.inService);
  set("number.attach", allIn, r?.messagingServiceSid ? null : "Create the Messaging Service first.");
  out["status.refresh"] = { done: false, enabled: Boolean(r), ...(!r ? { reason: "Nothing registered yet." } : {}) };
  return out;
}

/**
 * The one entry point the console calls. Readiness first (for writes), then the step's own
 * availability, then the step. Every SID is saved by the step itself through `save`.
 *
 * @param {object} args
 * @param {string} args.step
 * @param {string} args.slug
 * @param {string} args.plan
 * @param {A2pRegistrationRecord | null} args.record
 * @param {Record<string, any>} args.input
 * @param {string[]} [args.siteSlugs]
 * @param {(patch: Partial<A2pRegistrationRecord>, current: A2pRegistrationRecord | null) => Promise<A2pRegistrationRecord>} args.persist
 * @param {Record<string, string | undefined>} [args.env]
 * @param {typeof fetch} [args.fetchImpl]
 * @param {() => Date} [args.now]
 * @returns {Promise<StepResult>}
 */
export async function runStep({ step, slug, plan, record, input, siteSlugs = [], persist, env = process.env, fetchImpl = fetch, now = () => new Date() }) {
  const def = STEPS.find((s) => s.id === step);
  if (!def) throw new A2pStepRefused(`Unknown step "${step}".`);
  if (!REGISTERING_PLANS.includes(plan)) throw new A2pStepRefused("Only Growth and Enterprise clients register.");
  if (def.path && (record?.registrationPath ?? "standard") !== def.path) throw new A2pStepRefused(`${def.label} does not apply to this path.`);

  const primaryProfileSid = (env.TWILIO_PRIMARY_PROFILE_SID ?? "").trim();
  /** @type {StepContext["ready"]} */
  let ready = { ok: null, policies: {} };
  if (def.write) {
    const report = await assertA2pReady({ env, fetchImpl });
    ready = { ok: report.ok, policies: report.policies };
    const gate = availability(record, { plan, primaryProfileSid, siteSlugs })[step];
    // `business.update` and `number.attach` stay legal after they first succeed.
    if (gate && !gate.enabled && !(step === "number.attach" && record?.messagingServiceSid)) {
      throw new A2pStepRefused(gate.reason ?? `${def.label} is already done.`);
    }
  }

  let current = record;
  /** @type {StepContext} */
  const ctx = {
    slug,
    plan,
    record,
    input: input ?? {},
    ready,
    auth: { accountSid: (env.TWILIO_ACCOUNT_SID ?? "").trim(), authToken: (env.TWILIO_AUTH_TOKEN ?? "").trim() },
    primaryProfileSid,
    env,
    fetchImpl,
    now,
    save: async (patch) => {
      current = await persist(patch, current);
      ctx.record = current;
      return current;
    },
  };
  return def.run(ctx);
}
