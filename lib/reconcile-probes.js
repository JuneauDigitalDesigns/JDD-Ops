/**
 * Configuration probes — "is this vendor set up the way we think it is?"
 *
 * lib/teardown-ops.js already probes EXISTENCE for every vendor, because a teardown
 * preview needs to know what it is about to delete. These go one level deeper and read the
 * *configuration*, because most of the ways a client silently breaks are not "the resource
 * vanished" but "the resource is still there and is now pointed somewhere useless".
 *
 * ── The tri-state is the whole contract ─────────────────────────────────────
 *
 * Every field that answers a yes/no question is `true`, `false`, or `null`, where `null`
 * means THE CHECK DID NOT RUN — no credential, a rate limit, a timeout. It is never
 * collapsed into `false`. A rate-limited API rendering as "broken" trains you to ignore
 * the screen; a rate-limited API rendering as "fine" is worse. Both existing audits already
 * settled this the same way: audit-analytics exits 2 when a live site's state is unknown,
 * and audit-billing returns `driftSkipped` rather than an empty pass, on the stated grounds
 * that an unverifiable billing state must never render as a tick.
 *
 * Nothing here throws. A probe that cannot answer says so in its return value, so one dead
 * vendor cannot abort a sweep across five others.
 */

const RETELL_API = 'https://api.retellai.com';
const AIRTABLE_API = 'https://api.airtable.com';

/** Wrap fetch so a network error is `null` (unknown), never a thrown sweep-killer. */
async function safeJson(url, init, { timeoutMs = 12_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const body = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: null, body: null };
  } finally {
    clearTimeout(timer);
  }
}

/* ── Twilio ────────────────────────────────────────────────────────────────── */

/**
 * The voiceUrl a number SHOULD carry, given the host Vercel actually serves.
 *
 * The caller passes the resolved host rather than a slug, deliberately. Deriving it from
 * the slug is what onboard.js does at purchase time (`sanitizeProjectName(siteSlug)
 * .replace(/_/g, '-')`, onboard.js:878) and that transform is WRONG: Vercel *drops*
 * underscores from the deployment hostname, it does not convert them to hyphens. The
 * project `e2e_test_growth` serves at `e2etestgrowth.vercel.app`, not
 * `e2e-test-growth.vercel.app`. CLAUDE.md documents the same wrong rule.
 *
 * The first version of this probe reproduced that transform and duly reported a correctly
 * configured number as broken. Comparing against the host Vercel reports is strictly
 * better anyway — it is the real value, and it follows renames and custom domains for free.
 */
export function voiceUrlForHost(host) {
  return `https://${String(host).replace(/^https?:\/\//, '').replace(/\/$/, '')}/api/voice`;
}

/**
 * Number ownership + how it is wired, plus whether recent messages from it are failing.
 *
 * The delivery check exists because post-call SMS is billed whether or not it arrives:
 * an unregistered 10DLC sender gets error 30034 on every message, Twilio still charges for
 * the attempt, and the client never learns their alerts stopped. Nothing in the stack
 * notices, because from the scenario's point of view the send succeeded.
 */
export async function probeTwilioNumber({ accountSid, authToken, phoneNumber, liveHost }) {
  // No resolved host means the comparison is UNKNOWN, never a mismatch. Guessing the host
  // and declaring drift against the guess is how a correctly wired number gets reported as
  // broken — and a false red is worse than no check, because it trains you to ignore reds.
  const expected = liveHost ? voiceUrlForHost(liveHost) : null;
  const unknown = {
    exists: null,
    voiceUrl: null,
    smsUrl: null,
    voiceUrlMatches: null,
    expected,
    recentSendErrors: null,
    checked: false,
  };
  if (!accountSid || !authToken || !phoneNumber) return unknown;

  try {
    const { default: twilio } = await import('twilio');
    const client = twilio(accountSid, authToken);

    const [num] = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
    if (!num) return { ...unknown, exists: false, checked: true };

    // Delivery failures are counted, not just detected: one bounced message to a dead
    // handset is noise, every message failing is a broken sender.
    let recentSendErrors = null;
    try {
      const messages = await client.messages.list({ from: phoneNumber, limit: 50 });
      const failed = messages.filter((m) => m.errorCode);
      recentSendErrors = {
        total: messages.length,
        failed: failed.length,
        // 30034 = unregistered 10DLC. Surfaced by code so the finding can name the cause.
        codes: [...new Set(failed.map((m) => m.errorCode))],
      };
    } catch {
      // Leave null — message history is a separate permission from number listing.
    }

    return {
      exists: true,
      voiceUrl: num.voiceUrl ?? null,
      smsUrl: num.smsUrl ?? null,
      voiceUrlMatches: expected ? num.voiceUrl === expected : null,
      expected,
      recentSendErrors,
      checked: true,
    };
  } catch {
    return unknown;
  }
}

/* ── Retell ────────────────────────────────────────────────────────────────── */

/**
 * Agent wiring: which LLM backs it, where its post-call webhook points, and whether the
 * prompt it is actually answering with matches the one on disk.
 *
 * The prompt comparison is the reason this exists. The console's voice-agent editor reads
 * `agent-prompt.txt` and pushes it, but has never read anything back, so a change made in
 * the Retell dashboard is invisible here and the editor will silently overwrite it on the
 * next save. Note the prompt lives on the LLM, not the agent — `general_prompt` passed to
 * an agent with a retell-llm response engine is ignored — so this reads the LLM.
 */
export async function probeRetellAgent({ apiKey, agentId, promptOnDisk, expectedWebhookUrl }) {
  const unknown = {
    exists: null,
    llmId: null,
    webhookUrl: null,
    webhookMatches: null,
    promptMatches: null,
    livePrompt: null,
    maxCallDurationMs: null,
    checked: false,
  };
  if (!apiKey || !agentId) return unknown;

  const auth = { Authorization: `Bearer ${apiKey}` };
  const agent = await safeJson(`${RETELL_API}/get-agent/${agentId}`, { headers: auth });
  if (agent.status === 404) return { ...unknown, exists: false, checked: true };
  if (!agent.ok || !agent.body) return unknown;

  const llmId = agent.body?.response_engine?.llm_id ?? null;
  const webhookUrl = agent.body?.webhook_url ?? null;

  let livePrompt = null;
  if (llmId) {
    const llm = await safeJson(`${RETELL_API}/get-retell-llm/${llmId}`, { headers: auth });
    if (llm.ok && llm.body) livePrompt = llm.body?.general_prompt ?? null;
  }

  // Compared on trimmed text: a trailing newline difference between what the editor wrote
  // and what Retell stored is not a drift anyone needs to see.
  const promptMatches =
    livePrompt == null || promptOnDisk == null ? null : livePrompt.trim() === promptOnDisk.trim();

  return {
    exists: true,
    llmId,
    webhookUrl,
    webhookMatches: expectedWebhookUrl ? webhookUrl === expectedWebhookUrl : null,
    promptMatches,
    livePrompt,
    maxCallDurationMs: agent.body?.max_call_duration_ms ?? null,
    checked: true,
  };
}

/* ── Make ──────────────────────────────────────────────────────────────────── */

/**
 * Is this client's post-call scenario still running?
 *
 * NOTE the architecture here, because the RUNBOOK still documents the older design: there
 * is no shared scenario and no `retell-agent-lookup` Data Store on the live path.
 * `cloneAndWirePostCall` clones the master PER CLIENT, patches the clone's blueprint with
 * that client's Airtable base, Twilio number and SMS destination, activates it, and points
 * the agent's webhook at the clone's own hook. So the thing to verify is that this
 * client's clone is active — identified by matching the hook URL we stored in
 * `.env.local`, since the clone id is never written down anywhere.
 *
 * A deactivated clone is silent: calls still connect, the caller still gets an answer, and
 * nothing reaches Airtable or the owner's phone until someone notices the log stopped.
 */
export async function probeMakeScenario({ apiKey, zone, webhookUrl }) {
  const unknown = { scenarioId: null, isActive: null, name: null, checked: false };
  if (!apiKey || !zone || !webhookUrl) return unknown;

  const headers = { Authorization: `Token ${apiKey}` };
  const list = await safeJson(`${zone}/scenarios`, { headers });
  if (!list.ok || !list.body) return unknown;

  const scenarios = list.body?.scenarios ?? [];
  for (const s of scenarios) {
    const hooks = await safeJson(`${zone}/scenarios/${s.id}/hooks`, { headers });
    if (!hooks.ok) continue;
    const match = (hooks.body?.hooks ?? []).some((h) => h.url === webhookUrl);
    if (match) {
      return {
        scenarioId: s.id,
        // Make reports this as isActive on the list payload; absent means we don't know.
        isActive: typeof s.isActive === 'boolean' ? s.isActive : null,
        name: s.name ?? null,
        checked: true,
      };
    }
  }

  // Every scenario listed and none owns this hook: the clone is gone, not unknown.
  return { scenarioId: null, isActive: false, name: null, checked: true };
}

/* ── Airtable ──────────────────────────────────────────────────────────────── */

/**
 * Base reachable, `Call Log` table present, and — for enterprise, where several sites share
 * one base — the `Site` column that keeps their rows apart.
 *
 * A missing Site column on a shared base is not a cosmetic problem: every site's calls land
 * in one undifferentiated table and the portal shows each client all of them.
 */
export async function probeAirtableBase({ apiKey, baseId, needsSiteColumn = false }) {
  const unknown = {
    exists: null,
    hasCallLog: null,
    hasSiteColumn: null,
    needsSiteColumn,
    checked: false,
  };
  if (!apiKey || !baseId) return unknown;

  const headers = { Authorization: `Bearer ${apiKey}` };
  const tables = await safeJson(`${AIRTABLE_API}/v0/meta/bases/${baseId}/tables`, { headers });

  // Airtable answers 404 for a base that is gone AND for one the token can't see. Treat it
  // as absent only when the token demonstrably works elsewhere; here, prefer unknown.
  if (tables.status === 404) return { ...unknown, exists: false, checked: true };
  if (!tables.ok || !tables.body) return unknown;

  const callLog = (tables.body?.tables ?? []).find((t) => t.name === 'Call Log');
  const hasSiteColumn = callLog
    ? (callLog.fields ?? []).some((f) => f.name === 'Site')
    : null;

  return {
    exists: true,
    hasCallLog: Boolean(callLog),
    hasSiteColumn,
    needsSiteColumn,
    checked: true,
  };
}

/* ── Vercel ────────────────────────────────────────────────────────────────── */

/**
 * Domain attachment + verification, and registrar expiry where Vercel knows it.
 *
 * Expiry is only available for domains bought through Vercel; an externally registered
 * domain returns nothing, which is `null` and not "fine". A lapsed registration is the
 * most client-visible failure there is and the one nothing currently watches for.
 */
export async function probeDomainExpiry({ token, teamId, domain }) {
  const unknown = { expiresAt: null, renewalDisabled: null, checked: false };
  if (!token || !domain) return unknown;

  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const res = await safeJson(`https://api.vercel.com/v5/domains/${encodeURIComponent(domain)}${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) return unknown;

  const d = res.body?.domain ?? res.body;
  return {
    expiresAt: typeof d?.expiresAt === 'number' ? d.expiresAt : null,
    renewalDisabled: typeof d?.renew === 'boolean' ? !d.renew : null,
    checked: true,
  };
}
