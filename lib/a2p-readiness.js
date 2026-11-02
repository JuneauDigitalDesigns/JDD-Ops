// @ts-check
/**
 * A2P Phase 0 readiness — is this Twilio account set up to register clients at all?
 *
 * Per-client registration (runbook phases 2-4) is only correct if the JDD account itself is an
 * ISV reseller with a primary customer profile every secondary profile links back to. The
 * runbook is blunt about the consequence of getting this wrong: omit the primary-profile
 * assignment and the secondary profile "evaluates as a direct business and the whole ISV
 * posture collapses." That failure is not visible at submit time — it surfaces days later as a
 * rejection, having burned a registration attempt.
 *
 * So this module exists to make Phase 0 checkable rather than assumed, and the console blocks
 * every per-client vendor write on it.
 *
 * Conventions this follows deliberately (CLAUDE.md):
 *   - `ok` is `true | false | null`, and **`null` means "could not check"** — no credentials,
 *     network failure, nothing provisioned yet. It is never a pass.
 *   - `fetchImpl` is injectable so the suite drives the real code with a recorded/spied double.
 *   - Read-only. Nothing here creates, updates or deletes anything.
 *
 * Plain ESM with `@ts-check`, like the rest of `lib/`.
 */

const TRUSTHUB = "https://trusthub.twilio.com/v1";

/**
 * SID prefixes, which are load-bearing here rather than cosmetic.
 *
 * The mistake this guards against happened for real on 2026-10-31: `TWILIO_ACCOUNT_SID` was
 * *renamed* to `TWILIO_PRIMARY_PROFILE_SID` on the assumption that the missing value was
 * already present under the wrong name. They are different objects — an account (`AC…`) is who
 * you authenticate as; a primary customer profile (`BU…`) is a Trust Hub bundle describing your
 * business. Checking the prefix turns that into one clear sentence instead of a 404 at submit.
 */
const PREFIX = {
  account: "AC",
  profile: "BU",
  messagingService: "MG",
  policy: "RN",
};

/**
 * @typedef {object} ReadinessCheck
 * @property {string} id
 * @property {string} label
 * @property {true | false | null} ok `null` = could not check. Never a pass.
 * @property {string} detail What was found. Never a credential value.
 * @property {string} [fix] What the operator should do about it.
 */

/**
 * @typedef {object} ReadinessReport
 * @property {true | false | null} ok `true` only when every check passed.
 * @property {ReadinessCheck[]} checks
 * @property {{ secondaryCustomerProfilePolicySid?: string, a2pMessagingPolicySid?: string }} policies
 * @property {Array<{ sid: string, friendlyName: string, status: string }>} profileCandidates
 */

/** @param {{ accountSid: string, authToken: string }} auth */
function basicAuth(auth) {
  return `Basic ${Buffer.from(`${auth.accountSid}:${auth.authToken}`).toString("base64")}`;
}

/**
 * One read-only GET. Returns `{ ok, status, body }` rather than throwing, because every caller
 * here wants to turn a failure into a `null`/`false` check with a readable detail, not unwind.
 *
 * @param {string} url
 * @param {{ accountSid: string, authToken: string }} auth
 * @param {typeof fetch} fetchImpl
 */
async function get(url, auth, fetchImpl) {
  try {
    const response = await fetchImpl(url, { headers: { Authorization: basicAuth(auth) } });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON body — reported via status alone */
    }
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      body: null,
      transport: error instanceof Error ? error.message : "request failed",
    };
  }
}

/**
 * List the account's Trust Hub customer profiles, so the console can tell the operator which
 * SID to record rather than making them hunt for it in the dashboard.
 *
 * @param {object} args
 * @param {{ accountSid: string, authToken: string }} args.auth
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<Array<{ sid: string, friendlyName: string, status: string, policySid: string }>>}
 */
export async function listCustomerProfiles({ auth, fetchImpl = fetch }) {
  const res = await get(`${TRUSTHUB}/CustomerProfiles?PageSize=50`, auth, fetchImpl);
  if (!res.ok || !res.body) return [];
  const results = Array.isArray(res.body.results) ? res.body.results : [];
  return results.map((/** @type {Record<string, unknown>} */ p) => ({
    sid: String(p.sid ?? ""),
    friendlyName: String(p.friendly_name ?? ""),
    status: String(p.status ?? ""),
    policySid: String(p.policy_sid ?? ""),
  }));
}

/**
 * The policy SIDs, discovered rather than hardcoded (runbook 0.2).
 *
 * The runbook quotes a literal `RNdfbf3fae0e1107f8aded0e7cead80bf5` for the secondary-profile
 * policy. That is useful as something to compare against, never as the source: a policy SID
 * that changes under us would otherwise fail at evaluation time with a vendor error about a
 * field nobody touched.
 *
 * @param {object} args
 * @param {{ accountSid: string, authToken: string }} args.auth
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<Array<{ sid: string, friendlyName: string }>>}
 */
export async function listPolicies({ auth, fetchImpl = fetch }) {
  const res = await get(`${TRUSTHUB}/Policies?PageSize=50`, auth, fetchImpl);
  if (!res.ok || !res.body) return [];
  const results = Array.isArray(res.body.results) ? res.body.results : [];
  return results.map((/** @type {Record<string, unknown>} */ p) => ({
    sid: String(p.sid ?? ""),
    friendlyName: String(p.friendly_name ?? ""),
  }));
}

/**
 * Read the business-information EndUser attached to a customer profile, if there is one.
 *
 * Two calls: the profile's entity assignments, then each assigned object until a
 * `customer_profile_business_information` EndUser turns up. Twilio does not expose the
 * business type on the profile itself.
 *
 * @param {object} args
 * @param {string} args.profileSid
 * @param {{ accountSid: string, authToken: string }} args.auth
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<{ found: boolean, attributes: Record<string, unknown> | null, reachable: boolean }>}
 */
export async function readProfileBusinessInfo({ profileSid, auth, fetchImpl = fetch }) {
  const assignments = await get(
    `${TRUSTHUB}/CustomerProfiles/${encodeURIComponent(profileSid)}/EntityAssignments?PageSize=50`,
    auth,
    fetchImpl,
  );
  if (!assignments.ok || !assignments.body) return { found: false, attributes: null, reachable: false };

  const objectSids = (Array.isArray(assignments.body.results) ? assignments.body.results : [])
    .map((/** @type {Record<string, unknown>} */ a) => String(a.object_sid ?? ""))
    .filter((sid) => sid.startsWith("IT"));

  for (const sid of objectSids) {
    const endUser = await get(`${TRUSTHUB}/EndUsers/${encodeURIComponent(sid)}`, auth, fetchImpl);
    if (!endUser.ok || !endUser.body) continue;
    if (String(endUser.body.type ?? "") === "customer_profile_business_information") {
      return {
        found: true,
        attributes: /** @type {Record<string, unknown>} */ (endUser.body.attributes ?? {}),
        reachable: true,
      };
    }
  }
  return { found: false, attributes: null, reachable: true };
}

/**
 * Is the account ready to register clients?
 *
 * @param {object} [args]
 * @param {Record<string, string | undefined>} [args.env]
 * @param {typeof fetch} [args.fetchImpl]
 * @returns {Promise<ReadinessReport>}
 */
export async function checkA2pReadiness({ env = process.env, fetchImpl = fetch } = {}) {
  /** @type {ReadinessCheck[]} */
  const checks = [];
  /** @type {ReadinessReport['policies']} */
  const policies = {};
  /** @type {ReadinessReport['profileCandidates']} */
  const profileCandidates = [];

  const accountSid = (env.TWILIO_ACCOUNT_SID ?? "").trim();
  const authToken = (env.TWILIO_AUTH_TOKEN ?? "").trim();
  const primaryProfileSid = (env.TWILIO_PRIMARY_PROFILE_SID ?? "").trim();
  const masterServiceSid = (env.TWILIO_MESSAGING_SERVICE_SID ?? "").trim();

  // ── 1. Credentials ──
  if (!accountSid || !authToken) {
    checks.push({
      id: "credentials",
      label: "Twilio API credentials",
      ok: false,
      detail: `${!accountSid ? "TWILIO_ACCOUNT_SID" : "TWILIO_AUTH_TOKEN"} is not set in jdd-ops/.env.`,
      fix: "Set both in jdd-ops/.env. onboard.js loads .env only, never .env.local.",
    });
  } else if (!accountSid.startsWith(PREFIX.account)) {
    checks.push({
      id: "credentials",
      label: "Twilio API credentials",
      ok: false,
      detail: `TWILIO_ACCOUNT_SID does not start with ${PREFIX.account} — it is not an account SID.`,
      fix: "An account SID looks like ACxxxxxxxx. Check the value has not been swapped with another SID.",
    });
  } else {
    checks.push({
      id: "credentials",
      label: "Twilio API credentials",
      ok: true,
      detail: "Account SID and auth token present.",
    });
  }

  const credentialsOk = checks[0].ok === true;
  const auth = { accountSid, authToken };

  // ── 2. The primary profile SID is recorded, and is the right kind of SID ──
  if (!primaryProfileSid) {
    checks.push({
      id: "primary-profile-sid",
      label: "Primary profile SID recorded",
      ok: false,
      detail: "TWILIO_PRIMARY_PROFILE_SID is not set.",
      fix: "Record the BU… SID of your primary customer profile. The candidates list below names them.",
    });
  } else if (!primaryProfileSid.startsWith(PREFIX.profile)) {
    checks.push({
      id: "primary-profile-sid",
      label: "Primary profile SID recorded",
      ok: false,
      detail: `TWILIO_PRIMARY_PROFILE_SID starts with ${primaryProfileSid.slice(0, 2)}, not ${PREFIX.profile}.`,
      fix:
        primaryProfileSid.startsWith(PREFIX.account)
          ? "That is an account SID, not a customer profile. They are different objects — see the candidates below for the BU… value."
          : "A Trust Hub customer profile SID looks like BUxxxxxxxx.",
    });
  } else {
    checks.push({
      id: "primary-profile-sid",
      label: "Primary profile SID recorded",
      ok: true,
      detail: "Set, and shaped like a customer profile SID.",
    });
  }

  // ── 3. The master Messaging Service (Account lane) ──
  // Not strictly part of per-client registration, but this panel is where an operator looks
  // when messaging is wrong, and onboard.js:1304 *silently* skips the pool join when it is
  // unset — the exact silent failure this repo's suite exists to prevent.
  checks.push(
    masterServiceSid.startsWith(PREFIX.messagingService)
      ? {
          id: "master-messaging-service",
          label: "Master Messaging Service (owner alerts)",
          ok: true,
          detail: "TWILIO_MESSAGING_SERVICE_SID set.",
        }
      : {
          id: "master-messaging-service",
          label: "Master Messaging Service (owner alerts)",
          ok: false,
          detail: masterServiceSid
            ? `TWILIO_MESSAGING_SERVICE_SID does not start with ${PREFIX.messagingService}.`
            : "TWILIO_MESSAGING_SERVICE_SID is not set.",
          fix: "This is JDD's own Account-lane service. Unset, onboard.js silently skips the A2P pool join.",
        },
  );

  if (!credentialsOk) {
    // Everything below needs the API. `null`, not `false`: not checked is not the same as failed.
    for (const [id, label] of [
      ["primary-profile-exists", "Primary profile reachable"],
      ["isv-reseller", "Primary profile is an ISV reseller"],
      ["policies", "Policy SIDs discoverable"],
    ]) {
      checks.push({ id, label, ok: null, detail: "Not checked — no usable credentials.", fix: "Fix the credentials first." });
    }
    return { ok: false, checks, policies, profileCandidates };
  }

  // ── 4. Candidates + policies, read live ──
  profileCandidates.push(
    ...(await listCustomerProfiles({ auth, fetchImpl })).map((p) => ({
      sid: p.sid,
      friendlyName: p.friendlyName,
      status: p.status,
    })),
  );

  const allPolicies = await listPolicies({ auth, fetchImpl });
  for (const policy of allPolicies) {
    const name = policy.friendlyName.toLowerCase();
    if (!policies.secondaryCustomerProfilePolicySid && name.includes("secondary") && name.includes("customer profile")) {
      policies.secondaryCustomerProfilePolicySid = policy.sid;
    }
    if (!policies.a2pMessagingPolicySid && name.includes("a2p") && name.includes("messaging")) {
      policies.a2pMessagingPolicySid = policy.sid;
    }
  }
  checks.push(
    allPolicies.length === 0
      ? {
          id: "policies",
          label: "Policy SIDs discoverable",
          ok: null,
          detail: "The Policies list came back empty or unreadable.",
          fix: "Retry; if it persists, check the credentials have Trust Hub access.",
        }
      : {
          id: "policies",
          label: "Policy SIDs discoverable",
          ok: Boolean(policies.secondaryCustomerProfilePolicySid),
          detail: `${allPolicies.length} policies readable. Secondary-profile policy ${
            policies.secondaryCustomerProfilePolicySid ? "found" : "NOT found by name"
          }.`,
          fix: policies.secondaryCustomerProfilePolicySid
            ? undefined
            : "Policy names may have changed. Compare the list against the runbook's literal before hardcoding anything.",
      },
  );

  // ── 5. Does the recorded profile exist, and is it an ISV reseller? ──
  const sidCheck = checks.find((c) => c.id === "primary-profile-sid");
  if (sidCheck?.ok !== true) {
    checks.push({
      id: "primary-profile-exists",
      label: "Primary profile reachable",
      ok: null,
      detail: "Not checked — no valid primary profile SID to look up.",
      fix: "Record a BU… SID first.",
    });
    checks.push({
      id: "isv-reseller",
      label: "Primary profile is an ISV reseller",
      ok: null,
      detail: "Not checked.",
    });
  } else {
    const profile = await get(
      `${TRUSTHUB}/CustomerProfiles/${encodeURIComponent(primaryProfileSid)}`,
      auth,
      fetchImpl,
    );
    if (!profile.ok) {
      checks.push({
        id: "primary-profile-exists",
        label: "Primary profile reachable",
        ok: profile.status === 0 ? null : false,
        detail:
          profile.status === 0
            ? "Could not reach Twilio."
            : `Twilio returned ${profile.status} for that profile SID.`,
        fix: profile.status === 404 ? "That profile does not exist on this account. See the candidates below." : undefined,
      });
      checks.push({ id: "isv-reseller", label: "Primary profile is an ISV reseller", ok: null, detail: "Not checked." });
    } else {
      const status = String(profile.body?.status ?? "unknown");
      checks.push({
        id: "primary-profile-exists",
        label: "Primary profile reachable",
        ok: status === "twilio-approved",
        detail: `Profile status: ${status}.`,
        fix: status === "twilio-approved" ? undefined : "A primary profile must be approved before it can vouch for secondaries.",
      });

      const info = await readProfileBusinessInfo({ profileSid: primaryProfileSid, auth, fetchImpl });
      if (!info.reachable) {
        checks.push({
          id: "isv-reseller",
          label: "Primary profile is an ISV reseller",
          ok: null,
          detail: "Could not read the profile's entity assignments.",
        });
      } else if (!info.found) {
        checks.push({
          id: "isv-reseller",
          label: "Primary profile is an ISV reseller",
          ok: false,
          detail: "No business-information EndUser is attached to the primary profile.",
          fix: "Runbook 0.1 — convert the profile to ISV Reseller or Partner in the Twilio console.",
        });
      } else {
        // Reported rather than asserted against a hardcoded enum value. The exact string Twilio
        // stores for "ISV Reseller or Partner" is not documented in the runbook, and inventing
        // one would make this check certify a belief instead of a fact. The console shows the
        // value; once a real reseller account has been read once, this tightens to an equality
        // check with the recorded value.
        const identity = String(info.attributes?.business_identity ?? "");
        const type = String(info.attributes?.business_type ?? "");
        const looksReseller = /reseller|isv|partner/i.test(`${identity} ${type}`);
        checks.push({
          id: "isv-reseller",
          label: "Primary profile is an ISV reseller",
          ok: looksReseller ? true : null,
          detail: `business_identity="${identity || "(absent)"}", business_type="${type || "(absent)"}".`,
          fix: looksReseller
            ? undefined
            : "Confirm in the Twilio console that this profile is ISV Reseller or Partner — the API values above do not say so outright.",
        });
      }
    }
  }

  const anyFalse = checks.some((c) => c.ok === false);
  const anyNull = checks.some((c) => c.ok === null);
  return {
    // `null` when something could not be checked and nothing outright failed: unknown is not
    // ready, but it is also not a diagnosis.
    ok: anyFalse ? false : anyNull ? null : true,
    checks,
    policies,
    profileCandidates,
  };
}

/**
 * The gate every per-client vendor write calls first.
 *
 * Throws unless readiness is `true`. Deliberately a throw rather than a boolean: a caller that
 * forgets to check a returned flag still gets blocked, and the whole point of Phase 0 is that
 * forgetting is expensive and silent.
 *
 * @param {object} [args]
 * @param {Record<string, string | undefined>} [args.env]
 * @param {typeof fetch} [args.fetchImpl]
 */
export async function assertA2pReady({ env = process.env, fetchImpl = fetch } = {}) {
  const report = await checkA2pReadiness({ env, fetchImpl });
  if (report.ok !== true) {
    const failing = report.checks
      .filter((c) => c.ok !== true)
      .map((c) => `${c.label}: ${c.detail}`)
      .join(" | ");
    throw new Error(`A2P Phase 0 is not ready — refusing to touch Twilio. ${failing}`);
  }
  return report;
}
