/**
 * lib/onboard-checks.js — the correctness predicates for a provisioning run.
 *
 * ── Why this module exists ──────────────────────────────────────────────────
 *
 * Seven bugs in the provisioning path were found by inspection, not by failure: a Make
 * endpoint that 404s, an Airtable table id never remapped, `singleSelect` casing that fails
 * the whole row, a vestigial module that halts the route, a per-site tag written to a key
 * nothing reads, a published phone number never swapped, and a console probe that had never
 * once executed. Every one of them left the run looking successful.
 *
 * The lesson is that "it provisioned" and "it provisioned correctly" are different questions,
 * and only the first was ever being asked. These predicates ask the second.
 *
 * ── One implementation, two callers ─────────────────────────────────────────
 *
 *   test/*.test.mjs        → runs them against recorded fixtures   (hermetic; CI + pre-commit)
 *   onboard.js --dry-run   → runs them against the real client     (operator + console UI)
 *
 * That is the whole point of the split. If the dry run had its own copy of these rules, the
 * suite could pass while a dry run blessed a broken client — which is the same class of
 * mistake as a mocked test certifying a 404. One implementation cannot disagree with itself.
 *
 * ── The tristate ────────────────────────────────────────────────────────────
 *
 * `ok` is `true | false | null`, matching lib/reconcile-probes.js. **`null` means "could not
 * check"** — no credentials, no network, nothing provisioned yet — and is NOT a pass. CI has
 * no secrets, so the vendor-facing checks degrade to `null` there and still run fully on an
 * operator's machine. Never collapse `null` into `true`: "we didn't look" reported as "fine"
 * is precisely the failure mode this module was written to end.
 *
 * Every predicate is pure. Callers fetch, these only judge.
 */

// samePhone normalizes both sides through toE164 before comparing, so "(207) 555-1212" and
// "+12075551212" are recognized as one line. An earlier draft of this file compared
// digits-only strings and reported those two as DIFFERENT — a 10-digit local form never equals
// its 11-digit E.164 — which would have made the forward-loop check silently pass on the exact
// input it exists to catch. Importing is not a style preference here: this repo already has a
// documented history of five diverging copies of toE164, and that was nearly a sixth.
import { samePhone, toE164 } from '@jdd/schema';

/** @typedef {{ id: string, ok: boolean|null, detail: string }} Check */

const ok = (id, detail) => ({ id, ok: true, detail });
const bad = (id, detail) => ({ id, ok: false, detail });
const skip = (id, detail) => ({ id, ok: null, detail });

/** Parse `KEY=value` lines (the shape buildClientEnvLines returns) into an object. */
export function envLinesToObject(lines) {
  const out = {};
  for (const line of lines ?? []) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(String(line).trim());
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Turn an Airtable field SPEC (the array onboard.js sends to create-base) into the same
 * `{ tableId, byName, byId, choices }` shape `airtableFieldMap` reads back from a live base.
 *
 * This is what lets a test ask "does the base we are ABOUT to create cover what the master
 * actually writes?" without creating one. Field ids are synthesized — they only need to be
 * internally consistent, because the remap joins the two bases on column NAME, never on id.
 */
export function fieldMapFromSpec(fields, { tableId = 'tblSPEC0000000000' } = {}) {
  const byName = {};
  const byId = {};
  const choices = {};
  (fields ?? []).forEach((f, i) => {
    const id = `fldSPEC${String(i).padStart(10, '0')}`;
    byName[f.name] = id;
    byId[id] = f.name;
    if (Array.isArray(f.options?.choices)) choices[f.name] = f.options.choices.map((c) => c.name);
  });
  return { tableId, byName, byId, choices };
}

/** True when both sides parse AND refer to the same line; false when they differ or either can't be parsed. */
const sameLine = (a, b) => samePhone(a, b);

/** Can we even compare these two? Used to return `null` instead of a meaningless verdict. */
const bothDialable = (a, b) => toE164(a) !== null && toE164(b) !== null;

/* ── env ─────────────────────────────────────────────────────────────────── */

/**
 * The plan-tier matrix from CLAUDE.md, asserted against the env that would actually be written.
 *
 * **Every tier captures web-form leads into the portal** (`LEAD_DELIVERY_MODE=portal`), so the
 * old email-vs-callback split is gone. What differs is `LEAD_CALLBACK`: Growth and Enterprise
 * additionally have `/api/contact` dial the lead back through Retell. The lead is recorded either
 * way, which is the point — a dropped callback used to mean a lost customer with no trace.
 *
 * Both are asserted because both are invisible when wrong. A missing token 401s every lead at the
 * ingest endpoint; a wrong `LEAD_CALLBACK` just quietly stops a Growth client's leads being
 * phoned back, which is most of what they are paying for.
 */
export function checkEnvTierMatrix({ lines, plan, webOnly }) {
  const id = 'env.tierMatrix';
  const env = envLinesToObject(lines);

  if (env.LEAD_DELIVERY_MODE !== 'portal') {
    return bad(
      id,
      `every tier captures leads in the portal — expected LEAD_DELIVERY_MODE=portal, got "${env.LEAD_DELIVERY_MODE ?? '(unset)'}"`,
    );
  }

  const expectedCallback = plan === 'starter' ? 'off' : 'on';
  if (env.LEAD_CALLBACK !== expectedCallback) {
    return bad(
      id,
      `plan "${plan}" expects LEAD_CALLBACK=${expectedCallback}, got "${env.LEAD_CALLBACK ?? '(unset)'}"`,
    );
  }

  // Resend is gone. A leftover key means an older template is still in play, which would also
  // mean the route written into the repo is the email one.
  const resendKeys = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'LEAD_TO_EMAIL'].filter((k) => k in env);
  if (resendKeys.length) {
    return bad(id, `Resend lead delivery was removed but these keys are still written: ${resendKeys.join(', ')}`);
  }

  if (!/^[0-9a-f]{64}$/.test(env.LEAD_INGEST_TOKEN ?? '')) {
    return bad(
      id,
      `LEAD_INGEST_TOKEN must be 64 hex chars, got "${env.LEAD_INGEST_TOKEN ? `${env.LEAD_INGEST_TOKEN.slice(0, 8)}… (${env.LEAD_INGEST_TOKEN.length} chars)` : '(unset)'}"`,
    );
  }

  if (!/^https:\/\/\S+\/api\/ingest\/lead$/.test(env.LEAD_INGEST_URL ?? '')) {
    return bad(id, `LEAD_INGEST_URL must be an https .../api/ingest/lead URL, got "${env.LEAD_INGEST_URL ?? '(unset)'}"`);
  }

  // The apex host 307-redirects to www across the whole site, and a redirect to a different
  // host drops the Authorization header — so the bearer token never arrives and the ingest
  // answers 401. Measured in production: posting to the apex returns 401 after following the
  // redirect, posting to www with the same token returns 200.
  //
  // Nothing about that looks wrong from either side. The URL resolves, the endpoint is up, the
  // token is valid, and every lead is lost. It is the same silent-loss shape as the Resend key
  // that was seeded empty and skipped by the env sync.
  //
  // Narrow on purpose: only the known-redirecting apex is rejected. Any other host, a preview
  // deploy included, stays legal — pointing a test client at a branch deploy is a supported
  // thing to do, and the test below pins that.
  if (/^https:\/\/juneaudigitaldesigns\.com\//.test(env.LEAD_INGEST_URL)) {
    return bad(
      id,
      'LEAD_INGEST_URL uses the apex host, which 307-redirects to www and drops the bearer ' +
        'token — every lead would 401. Use https://www.juneaudigitaldesigns.com/api/ingest/lead',
    );
  }

  // A web-only client declined the receptionist. Writing voice keys for them means a number,
  // an agent and a call log they never agreed to pay for.
  const voiceKeys = ['RETELL_AGENT_ID', 'TWILIO_NUMBER', 'CLIENT_FORWARD_PHONE', 'AIRTABLE_BASE_ID'];
  const present = voiceKeys.filter((k) => k in env);
  if (webOnly && present.length) {
    return bad(id, `web-only client must have no voice keys, found: ${present.join(', ')}`);
  }
  if (!webOnly && present.length !== voiceKeys.length) {
    const missing = voiceKeys.filter((k) => !(k in env));
    return bad(id, `client with a receptionist is missing voice keys: ${missing.join(', ')}`);
  }
  return ok(
    id,
    `LEAD_DELIVERY_MODE=portal, LEAD_CALLBACK=${expectedCallback}, ingest token present, voice stack ${webOnly ? 'absent (web-only)' : 'present'}`,
  );
}

/**
 * `CLIENT_FORWARD_PHONE` must never be the Twilio number.
 *
 * Hop 1 of inbound routing dials CLIENT_FORWARD_PHONE from the Twilio number. If they are the
 * same line, `/api/voice` forwards the call to the number that just invoked it. This is the
 * failure the ordering in main() exists to prevent — the env is written while brand.phone is
 * still the owner's number, before the publish swap — so it is worth asserting rather than
 * trusting the order to stay correct.
 */
export function checkForwardNotSelf({ lines, twilioNumber }) {
  const id = 'env.forwardNotSelf';
  const env = envLinesToObject(lines);
  const forward = env.CLIENT_FORWARD_PHONE;
  if (!('CLIENT_FORWARD_PHONE' in env)) return skip(id, 'no voice stack for this client');
  if (!forward) return bad(id, 'CLIENT_FORWARD_PHONE is empty — /api/voice has nowhere to forward');
  if (!twilioNumber) return skip(id, 'no Twilio number resolved yet');
  // Refuse to render a verdict on numbers we can't parse: "they look different" is not
  // evidence they ARE different when neither side normalized.
  if (!bothDialable(forward, twilioNumber)) {
    return skip(id, `cannot compare "${forward}" with "${twilioNumber}" — one is not a dialable number`);
  }
  if (sameLine(forward, twilioNumber)) {
    return bad(id, `CLIENT_FORWARD_PHONE (${forward}) is the Twilio number — /api/voice would dial itself`);
  }
  return ok(id, `forwards to ${forward}, distinct from ${twilioNumber}`);
}

/* ── site content ────────────────────────────────────────────────────────── */

/**
 * The site must advertise the Twilio number, not the owner's.
 *
 * Until this was fixed the deployed site kept the intake number, so every real caller dialed
 * the owner directly and bypassed `/api/voice` entirely: no human-first forward, no Retell
 * fallback, no Airtable row. The receptionist worked and was simply never reached — no error
 * anywhere, which is why it needs an assertion rather than a code review.
 */
export function checkSitePublishesTwilioNumber({ published, twilioNumber, webOnly }) {
  const id = 'site.publishesTwilioNumber';
  if (webOnly) return skip(id, 'web-only client has no number to publish');
  if (!twilioNumber) return skip(id, 'no Twilio number resolved yet');
  if (!published) {
    return bad(id, `Twilio number "${twilioNumber}" is not dialable, so the site keeps the owner's number and calls bypass /api/voice`);
  }
  if (!sameLine(published.e164, twilioNumber)) {
    return bad(id, `site would publish ${published.display} but the Twilio number is ${twilioNumber}`);
  }
  if (published.href !== `tel:${published.e164}`) {
    return bad(id, `phoneHref "${published.href}" is not the E.164 of ${published.display}`);
  }
  return ok(id, `publishes ${published.display} (${published.href})`);
}

/** The swap must not have clobbered the forward target — the two numbers have different jobs. */
export function checkForwardPreserved({ lines, previousPhone, webOnly }) {
  const id = 'site.forwardPreserved';
  if (webOnly) return skip(id, 'web-only client has no forward target');
  const env = envLinesToObject(lines);
  if (!('CLIENT_FORWARD_PHONE' in env)) return skip(id, 'no voice stack for this client');
  if (!previousPhone) return skip(id, "owner's original number unknown");
  if (!bothDialable(env.CLIENT_FORWARD_PHONE, previousPhone)) {
    return skip(id, `cannot compare "${env.CLIENT_FORWARD_PHONE}" with "${previousPhone}" — one is not a dialable number`);
  }
  if (!sameLine(env.CLIENT_FORWARD_PHONE, previousPhone)) {
    return bad(id, `CLIENT_FORWARD_PHONE is ${env.CLIENT_FORWARD_PHONE}, expected the owner's line ${previousPhone}`);
  }
  return ok(id, `forward target is still the owner's line ${previousPhone}`);
}

/* ── Make blueprint ──────────────────────────────────────────────────────── */

/**
 * Every Airtable mapping in the patched clone resolves to the CLIENT's base.
 *
 * Airtable table and field ids are base-scoped, so a clone that inherits the master's `tbl…`
 * and `fld…` ids writes nowhere. Four of the seven bugs lived in this one module's mapper.
 */
export function checkBlueprintFieldsResolve({ blueprint, clientMap, siteTag }) {
  const id = 'blueprint.fieldsResolve';
  if (!blueprint || !clientMap) return skip(id, 'no credentials to resolve the blueprint or base schema');

  const mod = (blueprint.flow ?? []).find((m) => (m.module ?? '').startsWith('airtable'));
  if (!mod) return bad(id, 'patched blueprint has no airtable module — nothing would be logged');

  if (mod.mapper?.table !== clientMap.tableId) {
    return bad(id, `mapper.table is "${mod.mapper?.table}", expected the client table "${clientMap.tableId}" — a stale table id fails every write`);
  }
  if ('Site' in (mod.mapper ?? {})) {
    return bad(id, 'mapper.Site is set as a top-level key, which airtable:ActionCreateRecord does not read');
  }

  const keys = Object.keys(mod.mapper?.record ?? {});
  if (!keys.length) return bad(id, 'patched record mapping is empty — rows would be created with no fields');
  const foreign = keys.filter((k) => !(k in clientMap.byId));
  if (foreign.length) {
    return bad(id, `${foreign.length} record key(s) belong to another base: ${foreign.join(', ')}`);
  }

  if (siteTag) {
    const siteFld = clientMap.byName.Site;
    if (!siteFld) return bad(id, 'enterprise site needs a "Site" column and the client base has none');
    if (mod.mapper.record[siteFld] !== siteTag) {
      return bad(id, `Site tag "${siteTag}" is not in mapper.record — the portal filters on row.Site and would show no calls`);
    }
  }
  return ok(id, `table + ${keys.length} field(s) resolve to the client base${siteTag ? `, Site="${siteTag}"` : ''}`);
}

/**
 * The `call_analyzed` guard must survive removal of the datastore module that carried it.
 *
 * Retell posts call_started and call_ended to the same webhook. Drop the filter with the
 * module and the clone logs three rows per call, two of them with no transcript or summary.
 */
export function checkBlueprintEventFilter({ blueprint }) {
  const id = 'blueprint.eventFilter';
  if (!blueprint) return skip(id, 'no credentials to resolve the blueprint');
  const mod = (blueprint.flow ?? []).find((m) => (m.module ?? '').startsWith('airtable'));
  if (!mod) return bad(id, 'no airtable module to carry the event filter');
  if (!JSON.stringify(mod.filter ?? null).includes('call_analyzed')) {
    return bad(id, 'airtable module has no call_analyzed filter — every Retell event would log a row');
  }
  return ok(id, 'call_analyzed filter present on the airtable module');
}

/** No datastore module may survive: a lookup miss emits no bundle and halts the route. */
export function checkBlueprintNoDatastore({ blueprint }) {
  const id = 'blueprint.noDatastore';
  if (!blueprint) return skip(id, 'no credentials to resolve the blueprint');
  const left = (blueprint.flow ?? []).filter((m) => (m.module ?? '').startsWith('datastore'));
  if (left.length) {
    return bad(id, `${left.length} datastore module(s) survived — a lookup miss halts the route before Airtable`);
  }
  return ok(id, 'no datastore module in the clone');
}

/* ── Retell post-call analysis ───────────────────────────────────────────── */

/** Every `custom_analysis_data.<name>` a blueprint references, in first-seen order. */
export function analysisFieldsReadBy(blueprint) {
  const names = [];
  const re = /custom_analysis_data\.([A-Za-z0-9_]+)/g;
  for (const m of JSON.stringify(blueprint ?? null).matchAll(re)) {
    if (!names.includes(m[1])) names.push(m[1]);
  }
  return names;
}

/**
 * Every `custom_analysis_data.*` field the Make scenario reads must be one the agent extracts.
 *
 * Retell only emits the fields defined in the agent's `post_call_analysis_data`, and a Make
 * mapping to a field that is never emitted resolves to empty without complaint. That shipped:
 * the master read caller_email, caller_address and caller_priority from day one while the
 * schema defined none of them, so Email, Address, Priority and the owner text's "Status:" were
 * blank on every call ever logged — a row that writes, with three cells nobody filled.
 *
 * Checked against the blueprint, master or patched clone alike: the patch rewrites record keys,
 * never the `{{1.call.…}}` expressions, so both read the same fields.
 */
export function checkAnalysisCoversBlueprint({ blueprint, analysisData }) {
  const id = 'analysis.coversBlueprint';
  if (!blueprint) return skip(id, 'no credentials to resolve the blueprint');
  const read = analysisFieldsReadBy(blueprint);
  if (!read.length) return bad(id, 'the blueprint reads no custom_analysis_data fields — caller details would never be logged');
  const defined = new Set((analysisData ?? []).map((f) => f?.name));
  const missing = read.filter((n) => !defined.has(n));
  if (missing.length) {
    return bad(id, `the scenario reads ${missing.join(', ')} but the agent never extracts ${missing.length === 1 ? 'it' : 'them'} — those cells would be blank on every call`);
  }
  return ok(id, `all ${read.length} analysis field(s) the scenario reads are extracted: ${read.join(', ')}`);
}

/**
 * Every mapping into a singleSelect column must be unable to produce an invalid option.
 *
 * Airtable rejects any value that is not one of a singleSelect's choices — including "" — with
 * "Insufficient permissions to create new select option", and that fails the whole row. Retell
 * returns "" for an analysis field it could not fill, so a BARE `{{…custom_analysis_data.x}}`
 * mapped into a select is a row-killer waiting for the first call that skips that field. It
 * shipped: on 2026-11-03 a completed callback with caller_priority "" wrote no row, so no portal
 * lead and no owner brief, and Make deactivated the scenario behind it.
 *
 * Two rules, both checkable without a call: no bare analysis reference into a select, and every
 * string literal the expression can emit must be one of the column's choices.
 *
 * `fieldMap` is the base the blueprint's record keys belong to (master map for the master,
 * client map for a patched clone): `{ byId, choices }`.
 */
export function checkSelectMappingsTotal({ blueprint, fieldMap }) {
  const id = 'blueprint.selectsTotal';
  if (!blueprint || !fieldMap) return skip(id, 'no credentials to resolve the blueprint or base schema');
  const mod = (blueprint.flow ?? []).find((m) => (m.module ?? '').startsWith('airtable'));
  if (!mod) return bad(id, 'no airtable module to check');

  const problems = [];
  let selects = 0;
  for (const [key, expr] of Object.entries(mod.mapper?.record ?? {})) {
    const column = fieldMap.byId?.[key];
    const choices = column ? fieldMap.choices?.[column] : null;
    if (!Array.isArray(choices) || typeof expr !== 'string') continue;
    selects++;
    if (/^\{\{\s*1\.call\.call_analysis\.custom_analysis_data\.[A-Za-z0-9_]+\s*\}\}$/.test(expr.trim())) {
      problems.push(`"${column}" maps an analysis field bare, so an empty extraction fails the whole row`);
      continue;
    }
    const invalid = [...expr.matchAll(/"([^"]*)"/g)].map((m) => m[1]).filter((lit) => !choices.includes(lit));
    if (invalid.length) problems.push(`"${column}" can emit ${invalid.map((v) => JSON.stringify(v)).join(', ')}, not one of its choices`);
  }
  if (problems.length) return bad(id, problems.join('; '));
  return ok(id, `all ${selects} singleSelect mapping(s) can only emit a valid choice`);
}

/**
 * The generated prompt must carry the approved SMS consent ask word for word.
 *
 * The prompt is written by a model from instructions, and a model paraphrases. The ask is the
 * evidence of consent, so a paraphrase is a different disclosure than the one approved — and a
 * prompt that drops it records `unknown` on every call, silently withholding SMS from a client
 * who paid for it. Checked at generation and again before a backfill push.
 */
export function checkPromptHasConsentAsk({ prompt, ask }) {
  const id = 'prompt.smsConsentAsk';
  if (typeof prompt !== 'string' || !prompt.trim() || !ask) return skip(id, 'no generated prompt to inspect');
  if (!prompt.includes(ask)) return bad(id, `the prompt does not contain the approved SMS consent ask verbatim: "${ask}"`);
  return ok(id, 'the approved SMS consent ask appears verbatim');
}

/* ── Airtable schema ─────────────────────────────────────────────────────── */

/**
 * The owner's post-call brief must send from the ACCOUNT-lane number, never the client's own.
 *
 * Two SMS lanes exist and which campaign carries a message is decided by WHO RECEIVES it.
 * A post-call brief goes to the business owner, so it rides JDD's own approved
 * ACCOUNT_NOTIFICATION campaign from a dedicated JDD number. Messages to the client's
 * customers ride that client's own CUSTOMER_CARE campaign from the client's number.
 *
 * Sending an owner brief from the client's number is wrong even while it works. A campaign
 * binds to a Messaging Service and a number can only sit in one — so a client number used
 * for owner alerts is stuck in JDD's service and can never join the client's own. The cost
 * is not a failed text today; it is that the client's customer-facing messaging cannot be
 * registered later without first unpicking this.
 *
 * It also WILL fail outright the moment client numbers stop joining JDD's master pool, which
 * is the point of the two-lane migration. The account's own history shows why that ordering
 * matters: the same number went 30034 → delivered in mid-August when the campaign was
 * approved, with `messaging_service_sid` null throughout. Pool membership is what registers a
 * number with a campaign, not naming the service in the API call. So this check is a
 * prerequisite for that migration rather than a fix for a break you can see today.
 */
export function checkAccountLaneSender({ blueprint, notificationNumber, clientNumber, smsEnabled }) {
  const id = 'post-call brief sends from the JDD notification number';
  if (smsEnabled === false) return skip(id, 'no SMS consent on file, so no Twilio module is cloned');
  // The two reasons this cannot be judged are different and the detail has to say which. A
  // synthetic or unprovisioned client has no blueprint at all (the sibling blueprint checks
  // report 'no credentials to resolve the blueprint' for the same reason); a real blueprint
  // that is missing the module is a different situation entirely. Reporting the first as the
  // second sends you looking for a module that was never fetched.
  if (!blueprint || !Array.isArray(blueprint.flow)) {
    return skip(id, 'no credentials to resolve the blueprint, or nothing provisioned yet');
  }
  const twilio = blueprint.flow.find((m) => String(m.module ?? '').startsWith('twilio'));
  if (!twilio) return skip(id, 'the blueprint carries no Twilio module to check');

  const from = String(twilio.mapper?.from ?? '').trim();
  if (!notificationNumber) {
    return bad(id, 'TWILIO_NOTIFICATION_NUMBER is not set, so there is no Account-lane sender to send from');
  }
  if (!from) {
    // An unconfigured module errors on every run, and enough errors get a Make scenario
    // auto-disabled — which would take the Airtable call log down with it.
    return bad(id, 'the Twilio module has no `from`, so the clone errors on every run');
  }
  if (clientNumber && bothDialable(from, clientNumber) && sameLine(from, clientNumber)) {
    return bad(
      id,
      `would send from the client's own number (${from}), which strands that number in JDD's Messaging Service and blocks their own campaign`,
    );
  }
  if (!bothDialable(from, notificationNumber) || !sameLine(from, notificationNumber)) {
    return bad(id, `would send from ${from}, not the notification number ${notificationNumber}`);
  }
  return ok(id, `sends from ${from}, the Account-lane number`);
}

/**
 * The client base has a home for every column the master writes, with matching choices.
 *
 * Two distinct failures here. A missing column silently drops that value from every call. And
 * a `singleSelect` whose choices don't match what Retell sends is worse: the module runs with
 * `typecast: false`, so an unknown option rejects the ENTIRE row, not just that cell. That is
 * why `Call type` is lowercase `inbound`/`outbound` rather than prettier labels.
 */
export function checkAirtableSchemaCovers({ masterMap, clientMap, masterChoices, clientChoices }) {
  const id = 'airtable.schemaCovers';
  if (!masterMap || !clientMap) return skip(id, 'no credentials to read one of the base schemas');

  const missing = Object.keys(masterMap.byName).filter((n) => !(n in clientMap.byName));
  if (missing.length) {
    return bad(id, `client base is missing column(s) the master writes: ${missing.join(', ')}`);
  }

  // Choice sets are optional inputs; when absent this degrades to the column-presence check.
  if (masterChoices && clientChoices) {
    for (const [col, want] of Object.entries(masterChoices)) {
      const have = clientChoices[col];
      if (!have) continue;
      const absent = want.filter((c) => !have.includes(c));
      if (absent.length) {
        return bad(id, `"${col}" is missing choice(s) ${absent.map((c) => `"${c}"`).join(', ')} that the master writes — typecast:false rejects the whole row`);
      }
    }
  }
  return ok(id, `all ${Object.keys(masterMap.byName).length} master column(s) covered`);
}

/** A client must never be wired into the master call-log base. */
export function checkNotMasterBase({ clientBaseId, masterBaseId }) {
  const id = 'airtable.notMasterBase';
  if (!clientBaseId) return skip(id, 'no client base id resolved yet');
  if (!masterBaseId) return skip(id, 'master base id unknown');
  if (clientBaseId === masterBaseId) {
    return bad(id, `client AIRTABLE_BASE_ID is the master base ${masterBaseId} — this client's calls would land in the shared master log`);
  }
  return ok(id, `client base ${clientBaseId} is distinct from the master`);
}

/**
 * A client's post-call webhook must be its OWN clone, never the master scenario's hook.
 *
 * This is the check that would have caught the e2e fixture. Its agent's `webhook_url` was the
 * master scenario's own hook, so every test call ran through the master and wrote into the
 * master base — meaning `cloneAndWirePostCall` was never exercised by the one client that
 * existed to prove the pipeline. Five clone-path bugs survived behind that.
 *
 * Two sources are compared because they fail differently: `.env.local` records what onboard.js
 * wired, and the live agent records what Retell will actually POST to. The fixture had nothing
 * in `.env.local` at all — the master wiring existed only on the agent — so a check reading
 * only the client's env file would have declared it clean.
 */
export function checkNotMasterHook({ clientWebhookUrl, agentWebhookUrl, masterHookUrl }) {
  const id = 'make.notMasterHook';
  if (!masterHookUrl) return skip(id, 'master hook url unknown (master scenario not resolved)');

  const offenders = [];
  if (clientWebhookUrl && clientWebhookUrl === masterHookUrl) offenders.push('RETELL_POST_CALL_WEBHOOK_URL');
  if (agentWebhookUrl && agentWebhookUrl === masterHookUrl) offenders.push("the Retell agent's webhook_url");
  if (offenders.length) {
    return bad(
      id,
      `${offenders.join(' and ')} ${offenders.length === 1 ? 'points' : 'point'} at the MASTER scenario's hook — calls would run through the master and log into the master base, and the per-client clone would never be exercised`,
    );
  }

  if (!clientWebhookUrl && !agentWebhookUrl) return skip(id, 'no post-call webhook wired yet');
  return ok(id, 'post-call webhook is a per-client clone, not the master');
}

/* ── phase contract ──────────────────────────────────────────────────────── */

/**
 * The phases a run emits must match what the console predicted.
 *
 * console/src/lib/run-plan.ts carries a header warning that it mirrors onboard.js's `log()`
 * calls and that "the dry-run checkpoint across all three plans is the guard" — a guard that
 * was entirely manual. Drift here doesn't break provisioning; it breaks the UI's account of
 * it, which is how an operator decides whether a run went well.
 */
export function checkPhasesMatchPlan({ emitted, expected }) {
  const id = 'phases.matchPlan';
  if (!emitted?.length || !expected?.length) return skip(id, 'no phase data to compare');
  const missing = expected.filter((k) => !emitted.includes(k));
  const unplanned = emitted.filter((k) => !expected.includes(k));
  if (missing.length || unplanned.length) {
    const parts = [];
    if (missing.length) parts.push(`planned but never emitted: ${missing.join(', ')}`);
    if (unplanned.length) parts.push(`emitted but unplanned: ${unplanned.join(', ')}`);
    return bad(id, parts.join('; '));
  }
  return ok(id, `${emitted.length} phase(s) match the plan`);
}

/* ── reporting ───────────────────────────────────────────────────────────── */

export const CHECK_GLYPH = { true: '✓', false: '✗', null: '?' };

/**
 * Render checks for the console log.
 *
 * Deliberately never emits the token `FAIL:` — console/src/lib/onboard-parse.ts treats any
 * line containing it as a fatal run failure, so a soft check result using that word would
 * abort the UI's whole run narration.
 */
export function formatCheckLines(checks) {
  return (checks ?? []).map((c) => `  ${CHECK_GLYPH[String(c.ok)]} ${c.id} — ${c.detail}`);
}

/** A run is correct when nothing is false. `null` is unknown, not a pass — and not a stop. */
export function summarizeChecks(checks) {
  const list = checks ?? [];
  const failed = list.filter((c) => c.ok === false);
  const skipped = list.filter((c) => c.ok === null);
  const passed = list.filter((c) => c.ok === true);
  return {
    passed: passed.length,
    failed: failed.length,
    skipped: skipped.length,
    failedIds: failed.map((c) => c.id),
    allClear: failed.length === 0,
  };
}
