/**
 * Which `@jdd/ui` spec a client repo should move to on this run, or null to leave it alone.
 *
 * A repo's package.json isn't template-owned, so a re-run refreshes `/api/contact` and nothing
 * refreshes the form it pairs with. A callback site on the new route with an older form has no
 * consent box, so every lead goes to the inbox and nobody is called back, with no error anywhere.
 *
 * Forward only, and only between version tags: a branch or commit pin was put there on purpose.
 */

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
