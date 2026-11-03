// @ts-check
/**
 * lib/a2p-teardown.js — the A2P half of tearing a client down.
 *
 * Same contract as `teardown-ops.js`, deliberately: credentials are ARGUMENTS (a Next route has
 * no dotenv), KV is raw REST, nothing throws, and every function answers with step results the
 * CLI and the console both format. Its own file so the A2P rules stay in one place and the
 * shared teardown files only gain a call.
 *
 * ── The rule this module exists to keep (HANDOFF-a2p-sid-store-correction.md §5) ─────────────
 * Delete the Trust Hub objects ONLY when the registration never completed. Deleting the bundles
 * behind a live brand breaks a real registration; deleting only our record orphans objects on
 * Twilio's side with nothing left to find them by. So:
 *
 *   - **Live** — a real (non-mock) brand in any state but FAILED, or a real campaign that has
 *     not FAILED. Nothing on Twilio's side is touched and the KV record is KEPT, because it is
 *     the only pointer to those objects. Reported, with the cost: an approved campaign bills
 *     monthly until someone removes it.
 *   - **Unknown** — a brand or campaign whose status could not be read. Treated as live. A
 *     teardown that guesses wrong here deletes a paying client's registration.
 *   - **Never completed** — everything else (drafts, submitted bundles with no brand, a failed
 *     brand, a mock). Its objects are deleted; brands are never deleted (there is no API path
 *     teardown should use), so a mock or failed brand is reported as left behind.
 *
 * Separately, and regardless of liveness: a number leaves the client's Messaging Service
 * BEFORE it is released (`detachA2pNumber`).
 *
 * The KV record is deleted only when every object it names is confirmed gone.
 */

const TRUSTHUB = "https://trusthub.twilio.com/v1";
const MESSAGING = "https://messaging.twilio.com/v1";
const TWILIO_API = "https://api.twilio.com/2010-04-01";

/** @param {string} slug */
const recordKey = (slug) => `jdd:a2p-registration:${slug}`;

/**
 * @typedef {object} StepResult
 * @property {string} resource
 * @property {string} target
 * @property {'deleted' | 'already-gone' | 'skipped' | 'failed'} outcome
 * @property {number} durationMs
 * @property {string} [message]
 */

/** @returns {StepResult} */
function step(/** @type {string} */ resource, /** @type {string} */ target, /** @type {StepResult['outcome']} */ outcome, /** @type {number} */ started, extra = {}) {
  return { resource, target, outcome, durationMs: Date.now() - started, ...extra };
}
const skip = (/** @type {string} */ resource, /** @type {string} */ target, /** @type {string} */ message) =>
  step(resource, target, "skipped", Date.now(), { message });

/** @param {{ accountSid: string, authToken: string }} auth */
const basic = (auth) => `Basic ${Buffer.from(`${auth.accountSid}:${auth.authToken}`).toString("base64")}`;

/**
 * One Twilio request. `{ status, body }`; status 0 means it could not be reached. Never throws.
 *
 * @param {"GET" | "DELETE" | "POST"} method
 * @param {string} url
 * @param {{ accountSid: string, authToken: string }} auth
 * @param {typeof fetch} fetchImpl
 */
async function twilio(method, url, auth, fetchImpl) {
  try {
    const res = await fetchImpl(url, { method, headers: { Authorization: basic(auth) } });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON: status alone */
    }
    return { status: res.status, body };
  } catch {
    return { status: 0, body: null };
  }
}

/**
 * Read `jdd:a2p-registration:{slug}` over Upstash REST. The value is stored by `@upstash/redis`,
 * which JSON-encodes it, so `result` is a JSON STRING (recorded: teardown/kv-registration-e2e.json).
 *
 * @returns {Promise<{ ok: true, record: Record<string, any> | null } | { ok: false, error: string }>}
 */
export async function readA2pRecord({ kvUrl, kvToken, slug, fetchImpl = fetch }) {
  try {
    const base = String(kvUrl).replace(/\/+$/, "");
    const res = await fetchImpl(`${base}/get/${encodeURIComponent(recordKey(slug))}`, { headers: { Authorization: `Bearer ${kvToken}` } });
    if (!res.ok) return { ok: false, error: `KV get returned ${res.status}` };
    const { result } = /** @type {{ result: unknown }} */ (await res.json());
    if (result == null) return { ok: true, record: null };
    return { ok: true, record: typeof result === "string" ? JSON.parse(result) : /** @type {any} */ (result) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "KV read failed" };
  }
}

/**
 * @typedef {object} A2pTeardownObject
 * @property {string} kind  e.g. "customer profile", "business EndUser"
 * @property {string} sid
 * @property {string} url   The resource's own URL — GET to probe, DELETE to remove.
 * @property {boolean | null} exists
 * @property {string} [status]
 */

/**
 * @typedef {object} A2pTeardownPlan
 * @property {boolean} hasRecord
 * @property {'live' | 'never-completed' | 'unknown' | 'none'} state
 * @property {string} detail One line for the preview.
 * @property {A2pTeardownObject[]} toDelete  In deletion order. Empty unless never-completed.
 * @property {Array<{ kind: string, sid: string, reason: string }>} kept
 * @property {string | null} messagingServiceSid
 */

/**
 * Work out what an A2P teardown would do — read-only. The dry run IS this.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {string | undefined} args.accountSid
 * @param {string | undefined} args.authToken
 * @param {string | undefined} args.kvUrl
 * @param {string | undefined} args.kvToken
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<{ ok: true, plan: A2pTeardownPlan } | { ok: false, error: string }>}
 */
export async function planA2pTeardown({ slug, accountSid, authToken, kvUrl, kvToken, fetchImpl = fetch }) {
  if (!kvUrl || !kvToken) return { ok: false, error: "KV credentials not set — the A2P record could not be read." };
  const read = await readA2pRecord({ kvUrl, kvToken, slug, fetchImpl });
  if (!read.ok) return { ok: false, error: read.error };
  const r = read.record;
  if (!r) {
    return { ok: true, plan: { hasRecord: false, state: "none", detail: "No A2P registration on record.", toDelete: [], kept: [], messagingServiceSid: null } };
  }
  if (!accountSid || !authToken) return { ok: false, error: "Twilio credentials not set — A2P objects could not be checked." };
  const auth = { accountSid, authToken };

  /** @type {Array<{ kind: string, sid: string | undefined, url: string }>} */
  const named = [
    // Deletion order: the campaign and its service first, the bundles next (trust product before
    // the customer profile it points at), then the objects the bundles were built from.
    { kind: "campaign", sid: r.campaignSid, url: `${MESSAGING}/Services/${r.messagingServiceSid}/Compliance/Usa2p/${r.campaignSid}` },
    { kind: "client Messaging Service", sid: r.messagingServiceSid, url: `${MESSAGING}/Services/${r.messagingServiceSid}` },
    { kind: "trust product", sid: r.trustProductSid, url: `${TRUSTHUB}/TrustProducts/${r.trustProductSid}` },
    { kind: "trust product EndUser", sid: r.trustEndUserSid, url: `${TRUSTHUB}/EndUsers/${r.trustEndUserSid}` },
    { kind: "customer profile", sid: r.profileSid, url: `${TRUSTHUB}/CustomerProfiles/${r.profileSid}` },
    { kind: "business EndUser", sid: r.businessEndUserSid, url: `${TRUSTHUB}/EndUsers/${r.businessEndUserSid}` },
    { kind: "representative EndUser", sid: r.repEndUserSid, url: `${TRUSTHUB}/EndUsers/${r.repEndUserSid}` },
    { kind: "address document", sid: r.addressDocSid, url: `${TRUSTHUB}/SupportingDocuments/${r.addressDocSid}` },
    { kind: "address", sid: r.addressSid, url: `${TWILIO_API}/Accounts/${accountSid}/Addresses/${r.addressSid}.json` },
  ];

  // Liveness, read live — the record's statuses can be days stale.
  let state = /** @type {A2pTeardownPlan['state']} */ ("never-completed");
  /** @type {A2pTeardownPlan['kept']} */
  const kept = [];
  if (r.brandSid) {
    const brand = await twilio("GET", `${MESSAGING}/a2p/BrandRegistrations/${r.brandSid}`, auth, fetchImpl);
    const status = String(brand.body?.status ?? "");
    const mock = brand.body?.mock === true || r.mock === true;
    if (brand.status !== 200 && brand.status !== 404) {
      state = "unknown";
      kept.push({ kind: "brand", sid: r.brandSid, reason: `status could not be read (HTTP ${brand.status}) — treated as live` });
    } else if (brand.status === 200 && !mock && status !== "FAILED") {
      state = "live";
      kept.push({ kind: "brand", sid: r.brandSid, reason: `${status}, real — a live registration is never deleted by teardown` });
    } else if (brand.status === 200) {
      kept.push({ kind: "brand", sid: r.brandSid, reason: `${mock ? "mock" : status} — brands are not deleted by teardown; nothing bills for it` });
    }
  }
  if (r.campaignSid && r.messagingServiceSid && state !== "unknown") {
    const list = await twilio("GET", `${MESSAGING}/Services/${r.messagingServiceSid}/Compliance/Usa2p`, auth, fetchImpl);
    const campaign = (Array.isArray(list.body?.compliance) ? list.body.compliance : []).find((/** @type {any} */ c) => c?.sid === r.campaignSid);
    if (list.status !== 200 && list.status !== 404) {
      state = "unknown";
      kept.push({ kind: "campaign", sid: r.campaignSid, reason: `status could not be read (HTTP ${list.status}) — treated as live` });
    } else if (campaign && campaign.mock !== true && campaign.campaign_status !== "FAILED") {
      state = "live";
      kept.push({ kind: "campaign", sid: r.campaignSid, reason: `${campaign.campaign_status} — an approved campaign bills monthly until someone removes it` });
    }
  }

  if (state !== "never-completed") {
    for (const o of named) {
      if (o.sid && !kept.some((k) => k.sid === o.sid)) kept.push({ kind: o.kind, sid: o.sid, reason: "kept with the live registration" });
    }
    kept.push({ kind: "A2P record", sid: recordKey(slug), reason: "kept — the only pointer to the objects above" });
    const detail =
      state === "live"
        ? "Live A2P registration — nothing on Twilio is deleted. An approved campaign keeps billing monthly until removed by hand."
        : "A2P status could not be read — treated as live; nothing on Twilio is deleted.";
    return { ok: true, plan: { hasRecord: true, state, detail, toDelete: [], kept, messagingServiceSid: r.messagingServiceSid ?? null } };
  }

  /** @type {A2pTeardownObject[]} */
  const toDelete = [];
  for (const o of named) {
    if (!o.sid) continue;
    const probe = await twilio("GET", o.url, auth, fetchImpl);
    toDelete.push({
      kind: o.kind,
      sid: o.sid,
      url: o.url,
      exists: probe.status === 200 ? true : probe.status === 404 ? false : null,
      ...(probe.body?.status ? { status: String(probe.body.status) } : {}),
    });
  }
  const live = toDelete.filter((o) => o.exists !== false).length;
  return {
    ok: true,
    plan: {
      hasRecord: true,
      state,
      detail: `Never completed — ${live} Twilio object(s) and the A2P record will be deleted.`,
      toDelete,
      kept,
      messagingServiceSid: r.messagingServiceSid ?? null,
    },
  };
}

/**
 * Delete what the plan says may be deleted, in order, then the KV record if nothing is left.
 * One step result per object, plus one for the record. `dryRun` returns the plan as skipped
 * steps and touches nothing.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {string | undefined} args.accountSid
 * @param {string | undefined} args.authToken
 * @param {string | undefined} args.kvUrl
 * @param {string | undefined} args.kvToken
 * @param {boolean} [args.dryRun]
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<{ steps: StepResult[], plan: A2pTeardownPlan | null }>}
 */
export async function teardownA2pRegistration({ slug, accountSid, authToken, kvUrl, kvToken, dryRun = false, fetchImpl = fetch }) {
  const started = Date.now();
  const planned = await planA2pTeardown({ slug, accountSid, authToken, kvUrl, kvToken, fetchImpl });
  if (!planned.ok) return { plan: null, steps: [step("a2p.registration", slug, "failed", started, { message: planned.error })] };
  const { plan } = planned;
  if (plan.state === "none") return { plan, steps: [step("a2p.registration", slug, "already-gone", started, { message: plan.detail })] };
  if (plan.state !== "never-completed") {
    return { plan, steps: plan.kept.map((k) => skip(`a2p.${k.kind}`, k.sid, k.reason)) };
  }
  if (dryRun) {
    return {
      plan,
      steps: [
        ...plan.toDelete.map((o) => skip(`a2p.${o.kind}`, o.sid, o.exists === false ? "already gone" : `would delete${o.status ? ` (${o.status})` : ""}`)),
        skip("a2p.record", recordKey(slug), "would delete once every object above is gone"),
        ...plan.kept.map((k) => skip(`a2p.${k.kind}`, k.sid, k.reason)),
      ],
    };
  }

  const auth = { accountSid: /** @type {string} */ (accountSid), authToken: /** @type {string} */ (authToken) };
  /** @type {StepResult[]} */
  const steps = [];
  for (const o of plan.toDelete) {
    const t0 = Date.now();
    if (o.exists === false) {
      steps.push(step(`a2p.${o.kind}`, o.sid, "already-gone", t0));
      continue;
    }
    const res = await twilio("DELETE", o.url, auth, fetchImpl);
    if (res.status === 204 || res.status === 200) steps.push(step(`a2p.${o.kind}`, o.sid, "deleted", t0));
    else if (res.status === 404) steps.push(step(`a2p.${o.kind}`, o.sid, "already-gone", t0));
    else steps.push(step(`a2p.${o.kind}`, o.sid, "failed", t0, { message: `HTTP ${res.status}${res.body?.message ? `: ${res.body.message}` : ""}` }));
  }
  for (const k of plan.kept) steps.push(skip(`a2p.${k.kind}`, k.sid, k.reason));

  const t0 = Date.now();
  if (steps.some((s) => s.outcome === "failed")) {
    steps.push(skip("a2p.record", recordKey(slug), "kept — an object above was not deleted, and this is the only pointer to it"));
  } else {
    try {
      const base = String(kvUrl).replace(/\/+$/, "");
      const res = await fetchImpl(`${base}/del/${encodeURIComponent(recordKey(slug))}`, { method: "POST", headers: { Authorization: `Bearer ${kvToken}` } });
      steps.push(res.ok ? step("a2p.record", recordKey(slug), "deleted", t0) : step("a2p.record", recordKey(slug), "failed", t0, { message: `KV del returned ${res.status}` }));
    } catch (err) {
      steps.push(step("a2p.record", recordKey(slug), "failed", t0, { message: err instanceof Error ? err.message : "KV del failed" }));
    }
  }
  return { plan, steps };
}

/**
 * Take one number out of the client's own Messaging Service, before it is released. Runs
 * whatever the registration's state: a released number should not linger as a sender on a
 * campaign, and the release itself is not where to find that out.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {string | undefined} args.phoneNumber E.164
 * @param {string | undefined} args.accountSid
 * @param {string | undefined} args.authToken
 * @param {string | undefined} args.kvUrl
 * @param {string | undefined} args.kvToken
 * @param {boolean} [args.dryRun]
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<StepResult>}
 */
export async function detachA2pNumber({ slug, phoneNumber, accountSid, authToken, kvUrl, kvToken, dryRun = false, fetchImpl = fetch }) {
  const started = Date.now();
  const resource = "a2p.number-in-service";
  if (!phoneNumber) return skip(resource, "—", "No TWILIO_NUMBER recorded");
  if (!kvUrl || !kvToken) return skip(resource, phoneNumber, "KV credentials not set — could not read the A2P record");
  const read = await readA2pRecord({ kvUrl, kvToken, slug, fetchImpl });
  if (!read.ok) return step(resource, phoneNumber, "failed", started, { message: read.error });
  const serviceSid = read.record?.messagingServiceSid;
  if (!serviceSid) return step(resource, phoneNumber, "already-gone", started, { message: "No client Messaging Service on record" });
  if (!accountSid || !authToken) return skip(resource, phoneNumber, "Twilio credentials not set");
  const auth = { accountSid, authToken };

  const lookup = await twilio("GET", `${TWILIO_API}/Accounts/${accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phoneNumber)}`, auth, fetchImpl);
  const pn = lookup.body?.incoming_phone_numbers?.[0]?.sid;
  if (lookup.status !== 200) return step(resource, phoneNumber, "failed", started, { message: `number lookup HTTP ${lookup.status}` });
  if (!pn) return step(resource, phoneNumber, "already-gone", started, { message: "Number not on this account" });
  const url = `${MESSAGING}/Services/${serviceSid}/PhoneNumbers/${pn}`;
  const member = await twilio("GET", url, auth, fetchImpl);
  if (member.status === 404) return step(resource, phoneNumber, "already-gone", started, { message: `Not in ${serviceSid}` });
  if (member.status !== 200) return step(resource, phoneNumber, "failed", started, { message: `membership read HTTP ${member.status}` });
  if (dryRun) return skip(resource, phoneNumber, `would remove from ${serviceSid}`);
  const del = await twilio("DELETE", url, auth, fetchImpl);
  if (del.status === 204 || del.status === 200 || del.status === 404) {
    return step(resource, phoneNumber, del.status === 404 ? "already-gone" : "deleted", started, { message: `removed from ${serviceSid}` });
  }
  return step(resource, phoneNumber, "failed", started, { message: `HTTP ${del.status} removing from ${serviceSid}` });
}
