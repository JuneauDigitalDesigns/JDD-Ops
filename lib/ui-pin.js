/**
 * Which `@jdd/ui` spec a client repo should move to on this run, or null to leave it alone.
 *
 * A repo's package.json isn't template-owned, so a re-run refreshes `/api/contact` and nothing
 * refreshes the form it pairs with. A callback site on the new route with an older form has no
 * consent box, so every lead goes to the inbox and nobody is called back, with no error anywhere.
 *
 * Forward only, and only between version tags: a branch or commit pin was put there on purpose.
 *
 * Two callers, one rule: onboard.js (`refreshUiPin`, which moves the pin on every run) and the
 * console export (which moves it only after the operator confirms the change it was shown).
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const UI = '@jdd/ui';

const tagOf = (spec) => /#v(\d+)\.(\d+)\.(\d+)$/.exec(spec ?? '')?.slice(1).map(Number) ?? null;

export function uiPinToAdopt(repoSpec, templateSpec) {
  const have = tagOf(repoSpec);
  const want = tagOf(templateSpec);
  if (!have || !want) return null;
  for (let i = 0; i < 3; i += 1) {
    if (want[i] > have[i]) return templateSpec;
    if (want[i] < have[i]) return null;
  }
  return null;
}

/** The `@jdd/ui` spec a folder's package.json pins, or undefined. */
export function readUiPin(dir) {
  const pkg = resolve(dir, 'package.json');
  if (!existsSync(pkg)) return undefined;
  return JSON.parse(readFileSync(pkg, 'utf8')).dependencies?.[UI];
}

/** `{ from, to }` when the repo at `repoDir` should move to the pin in `templateDir`, else null. */
export function uiPinMove(repoDir, templateDir) {
  const from = readUiPin(repoDir);
  const to = uiPinToAdopt(from, readUiPin(templateDir));
  return to ? { from, to } : null;
}

/**
 * True for a spec that is safe to hand to `npm install` on a command line.
 *
 * npm on Windows only runs through a shell, so whatever is installed is re-parsed by cmd.exe.
 * A pin comes from template/package.json, which the operator controls, but it is still checked
 * here rather than trusted: owner/repo#vX.Y.Z, nothing else.
 */
export function isInstallableUiSpec(spec) {
  return typeof spec === 'string' && /^github:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#v\d+\.\d+\.\d+$/.test(spec);
}
