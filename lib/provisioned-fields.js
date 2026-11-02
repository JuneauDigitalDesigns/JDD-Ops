/**
 * lib/provisioned-fields.js — who owns which field in a client repo's `src/data/site.ts`.
 *
 * ── The problem this solves ─────────────────────────────────────────────────
 *
 * Two different programs write that one file, for two different reasons:
 *
 *   • The CONSOLE writes the site's CONTENT — copy, palette, services, images, nav. It is the
 *     editor, and its export is how an operator ships a change.
 *   • onboard.js writes a handful of PROVISIONED FACTS, discovered while standing the client
 *     up, that the console cannot know because they do not exist until provisioning runs.
 *
 * Whichever ran last used to win the whole file, which makes both orders wrong. If onboard.js
 * goes last it reverts the console's copy to the intake. If the console goes last it reverts
 * `brand.phone` to the OWNER'S number — and that one is a catastrophe with no error anywhere
 * to find it. CLAUDE.md spells out why: the site must advertise the JDD Twilio number, because
 * that number is what routes a caller through `/api/voice` (human-first forward, then the
 * Retell agent on no-answer, then an Airtable row). Publish the owner's line instead and every
 * real caller dials the owner directly, bypassing the entire receptionist stack. The number
 * looks configured, the agent looks healthy, and the call log is simply empty.
 *
 * ── The contract ────────────────────────────────────────────────────────────
 *
 * Field-level, not file-level. The console owns everything EXCEPT `PROVISIONED_FIELDS`; those
 * it carries forward from whatever is already in the repo. onboard.js owns those fields and
 * nothing else once the repo carries console-authored content.
 *
 * ── Why this is its own dependency-free module ──────────────────────────────
 *
 * Both callers have to agree, and they cannot share an ordinary import: onboard.js pulls in
 * dotenv/Anthropic/Octokit/twilio, so a Next route importing it would drag that whole SDK
 * graph in and run `dotenv.config()` at module load. So this file stays pure and dependency
 * free, exactly like `lib/client-env.js`, and the console reaches it the same way — a dynamic
 * `webpackIgnore` import from the ops root (see console/src/lib/provisionedFields.ts).
 *
 * That is deliberately NOT the two-copies-pinned-by-a-test arrangement used for the ring
 * window. That compromise exists only because `console/src/lib/envFields.ts` is bundled into
 * the browser and physically cannot reach outside the Next project. Everything that needs
 * THIS module is server-side, so one copy is achievable and one copy is better.
 *
 * Pure: every function takes its inputs as arguments. Nothing here touches disk.
 */

/**
 * Dotted paths in SiteContent that onboard.js owns and the console must never overwrite.
 *
 * Adding one? It must be a value that does not and cannot exist before provisioning runs.
 * A field the console can legitimately edit does not belong here — listing it would make the
 * console unable to change it, silently.
 *
 * `brand.phone` / `brand.phoneHref` are written by `applyTwilioNumberToSite` after the number
 * is purchased. The pair moves together: `phone` is what the site displays and `phoneHref` is
 * what it dials, and publishing one without the other shows one number and calls another.
 */
export const PROVISIONED_FIELDS = ['brand.phone', 'brand.phoneHref'];

/**
 * Header line stamped into a repo's site.ts by the console's exporter.
 *
 * Its only job is to answer "has the console written this file?", which is what tells
 * onboard.js to stop splicing `clients/{slug}/site.ts` over the top of it. A comment rather
 * than a `_meta` key on purpose: `_meta` is serialized content that ships to a public repo and
 * is typed in @jdd/schema, so a provenance flag there would mean a schema change and would
 * travel into places that have no business reading it.
 *
 * It survives onboard.js's own writes, which is correct — `writeClientSchema` preserves
 * everything above the `export const CONTENT` marker, so a file stays console-authored even
 * after the phone swap rewrites it.
 */
export const CONSOLE_CONTENT_MARKER = '@jdd:content-source console-export';

/** The declaration the data object follows in both writers' output. */
const CONTENT_MARKER = 'export const CONTENT: SiteContent = ';

/** True when this site.ts source was written by the console's exporter. */
export function hasConsoleMarker(src) {
  return typeof src === 'string' && src.includes(CONSOLE_CONTENT_MARKER);
}

/**
 * Pull the CONTENT object out of a site.ts source, or null if it can't be read.
 *
 * Sound because BOTH writers emit `JSON.stringify(content, null, 2)` after the marker and
 * nothing after the closing `;` — so the tail of the file is strict JSON, not TypeScript, and
 * parsing it needs no evaluation. If that ever stops being true this returns null and callers
 * fall back to their previous behaviour rather than guessing.
 */
export function extractContentObject(src) {
  if (typeof src !== 'string') return null;
  const idx = src.indexOf(CONTENT_MARKER);
  if (idx === -1) return null;
  let tail = src.slice(idx + CONTENT_MARKER.length).trim();
  if (tail.endsWith(';')) tail = tail.slice(0, -1);
  try {
    const parsed = JSON.parse(tail);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/** Read a dotted path. Returns undefined for any missing or non-object link in the chain. */
export function getPath(obj, path) {
  let cur = obj;
  for (const key of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

/**
 * Write a dotted path, creating intermediate objects as needed. Mutates `obj`.
 *
 * Refuses to walk THROUGH a non-object (returns false without writing) rather than replacing
 * it — clobbering a populated value to make room for a nested one is never what was meant.
 */
export function setPath(obj, path, value) {
  if (obj === null || typeof obj !== 'object') return false;
  const keys = path.split('.');
  let cur = obj;
  for (const key of keys.slice(0, -1)) {
    if (cur[key] === undefined || cur[key] === null) cur[key] = {};
    else if (typeof cur[key] !== 'object') return false;
    cur = cur[key];
  }
  cur[keys[keys.length - 1]] = value;
  return true;
}

/**
 * Carry every provisioned field from `provisioned` onto a COPY of `incoming`.
 *
 * This is the console's half of the contract: `incoming` is the export payload (whose
 * `brand.phone` is still the owner's intake number) and `provisioned` is whatever the repo
 * currently holds (whose `brand.phone` is the published Twilio number).
 *
 * A field absent from `provisioned`, or equal to what `incoming` already has, is skipped — so
 * a client who has never been provisioned is untouched and `applied` stays empty, which is
 * what lets the caller report only the overrides that actually happened.
 *
 * Returns `{ content, applied }` and never mutates either argument.
 */
export function overlayProvisionedFields(incoming, provisioned, fields = PROVISIONED_FIELDS) {
  const content = structuredClone(incoming);
  const applied = [];
  if (!provisioned || typeof provisioned !== 'object') return { content, applied };

  for (const path of fields) {
    const value = getPath(provisioned, path);
    if (value === undefined || value === null || value === '') continue;
    if (getPath(content, path) === value) continue;
    if (setPath(content, path, value)) applied.push({ path, value });
  }
  return { content, applied };
}
