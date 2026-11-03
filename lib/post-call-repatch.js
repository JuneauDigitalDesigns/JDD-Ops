/**
 * lib/post-call-repatch.js — bring an EXISTING client's post-call clone up to the current master.
 *
 * A clone is a copy taken at onboarding. A deliberate master edit — the SMS consent mapping, the
 * total select mappings, the connected-calls filter, the agency HTTP hand-off, `airtable_record_id`
 * — never reaches the clones that already exist. Before this, each one was carried to the growth
 * fixture by hand from a scratch script; every other clone silently stayed on the old design.
 *
 * ── What is kept, and why ───────────────────────────────────────────────────
 *
 * The clone's FIRST module is its own `gateway:CustomWebHook`, bound to the clone's own hook
 * (`parameters.hook`). The master's first module is bound to the master's hook. Copying the
 * master's blueprint wholesale would point the clone at the master's webhook — which belongs to
 * the master, so Make would either refuse or, worse, leave the client's agent posting to a hook
 * nothing of theirs listens on. So the trigger is the clone's, and everything AFTER it is rebuilt
 * from the current master through the real `patchPostCallBlueprint` — the same function a new
 * clone gets at onboarding, so a re-patched clone and a fresh one are the same shape.
 *
 * Pure: the caller fetches and writes. The token goes into the blueprint and nowhere else.
 */

import { patchPostCallBlueprint } from '../onboard.js';

/** Deep copy, so neither the master nor the live clone object is mutated. */
const copy = (x) => JSON.parse(JSON.stringify(x));

/**
 * The clone's next blueprint: its own trigger, then the current master's modules, patched for
 * this client. Throws (caller refuses to write) when either input is not shaped like a
 * webhook-triggered post-call scenario, rather than guessing.
 */
export function rebuildCloneBlueprint({ clone, master, baseId, siteTag = null, ingestToken, masterMap, clientMap }) {
  const trigger = clone?.flow?.[0];
  if (!trigger || !(trigger.module ?? '').startsWith('gateway:')) {
    throw new Error("the clone's first module is not a webhook trigger — refusing to rebuild it");
  }
  if (!(master?.flow?.[0]?.module ?? '').startsWith('gateway:')) {
    throw new Error("the master's first module is not a webhook trigger — refusing to rebuild from it");
  }
  const next = copy(clone);
  next.flow = [copy(trigger), ...copy(master.flow.slice(1))];
  patchPostCallBlueprint(next, { baseId, siteTag, ingestToken, masterMap, clientMap, quiet: true });
  return next;
}

/** The clone still triggers off its own hook, exactly as before. */
export function checkCloneTriggerKept({ before, after }) {
  const id = 'repatch.triggerKept';
  const a = JSON.stringify(before?.flow?.[0]?.parameters ?? null);
  const b = JSON.stringify(after?.flow?.[0]?.parameters ?? null);
  if (a === 'null') return { id, ok: null, detail: 'no trigger to compare' };
  if (a !== b) return { id, ok: false, detail: "the clone's trigger module changed — it would stop receiving its own calls" };
  return { id, ok: true, detail: `trigger unchanged (hook ${before.flow[0].parameters?.hook ?? '?'})` };
}

/** One line per module, for before/after output. No mapper contents, so no token. */
export function describeFlow(bp) {
  return (bp?.flow ?? []).map((m) => `${m.id}:${m.module}${m.filter ? '[filter]' : ''}`).join(' → ');
}
