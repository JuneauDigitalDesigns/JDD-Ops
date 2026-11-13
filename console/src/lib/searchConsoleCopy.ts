/**
 * Every visible string of the Search Console screens (L11/L12), word for word as Xander approved
 * them on 2026-11-13 ("I approve", W1–W59 in https://claude.ai/artifact/AGN6puPcUeehTdkQiLNBtP).
 * The W numbers are that list's. Pinned by test/search-console-copy.test.mjs: a change here is a
 * wording change and needs his sign-off first. Client-safe: no imports.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "13 Nov 2026", in New York time, the console's clock. */
function day(d: Date): string {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, x) => ({ ...acc, [x.type]: x.value }), {});
  return `${Number(p.day)} ${MONTHS[Number(p.month) - 1]} ${p.year}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const SC = {
  section: 'Search', // W1
  title: 'Google Search Console', // W2
  pill: { setUp: 'SET UP', notSetUp: 'NOT SET UP', newAddress: 'NEW ADDRESS', stopped: 'STOPPED' }, // W3
  setUpFor: (property: string, at: Date) => `Set up for ${property} on ${day(at)}.`, // W4
  notSetUp: 'JDD verifies this site itself. The client does nothing.', // W5
  newAddress: (property: string, old: string) =>
    `${property} is a new address for this site and needs its own setup. The old one, ${old}, stays until teardown.`, // W6
  steps: {
    token: 'Google token',
    file: 'Token file on the site',
    verify: 'Verified as JDD',
    list: 'Added to Search Console',
    sitemap: 'Sitemap submitted',
    owner: 'Client added as owner',
  } as Record<string, string>, // W7
  ownerLabel: 'Client’s Google account', // W8
  ownerHelp: 'Added as an owner, so the data is theirs too. Leave it empty to add it later.', // W9
  ownerPlaceholder: 'name@gmail.com', // the mockup's, approved with it
  setUpButton: 'Set up Search Console', // W10
  rerunButton: 'Run setup again', // W10
  rerunHint: 'Safe to repeat. Each step that is already done is left as it is.', // W11

  proposalsTitle: 'Proposed pages', // W21
  proposalsHint: 'From Search Console data. Nothing here publishes a page.', // W22
  proposalsEmpty: 'No proposals yet. They come from Search Console data, usually 3 to 6 months after launch.', // W23
  spokeHeading: (service: string, town: string) => `${service} in ${town}`, // W24
  townHeading: (town: string) => `A town page for ${town}`, // W25
  foldHeading: (service: string, town: string) => `Merge ${service} in ${town} back`, // W26
  kind: {
    spoke: 'READY TO APPROVE',
    'ask-client': 'NEEDS FACTS FROM THE CLIENT',
    'town-facts': 'NEEDS TOWN FACTS',
    fold: 'LOW TRAFFIC',
  } as Record<string, string>, // W27
  approvedPill: 'APPROVED', // W27
  evidence: (impressions: number, clicks: number) =>
    `${plural(impressions, 'impression', 'impressions')}, ${plural(clicks, 'click', 'clicks')} in the last 90 days.`, // W28
  evidenceTown: (impressions: number, town: string) =>
    `${plural(impressions, 'impression', 'impressions')} on searches naming ${town} in the last 90 days.`, // W29
  evidenceFold: (impressions: number) => `${plural(impressions, 'impression', 'impressions')} in the 180 days since it went live.`, // W30
  signal: (town: string, calls: number, leads: number) => `Calls naming ${town}: ${calls}. Web leads: ${leads}.`, // W31
  table: ['Search', 'Impressions', 'Clicks', 'Position'], // W32
  missingFacts: (town: string, service: string, has: number) =>
    `Needs 2 job photos or reviews tagged to both ${town} and ${service}. It has ${has}.`, // W33
  missingPage: (service: string) => `The ${service} page isn’t built yet, so this can’t be either.`, // W34
  townFacts: (town: string) =>
    `People search for ${town}, but it has too few facts for a page of its own. It needs 3 facts of 2 kinds: job photos, reviews or sourced notes.`, // W35
  foldBody: (town: string) => `Merging folds it into the ${town} page, with a permanent redirect.`, // W36
  approve: 'Approve', // W37
  notNow: 'Not now', // W37
  ask: 'Ask the client for facts', // W37
  approved: (service: string, town: string) =>
    `Approved. ${service} in ${town} is a draft in the Studio. It needs its facts, copy and review before it can be exported.`, // W38
  approvedFold: (service: string, town: string) => `Approved. ${service} in ${town} will merge into the ${town} page at the next export.`, // W39
  asked: 'Marked as asked. It won’t be proposed again for 90 days.', // W40
  setAside: 'Set aside. It won’t be proposed again for 90 days.', // W41

  teardownLeaves: (property: string) => `Google Search Console: JDD leaves ${property}`, // W42
  teardownLeftBehind: (property: string) =>
    `The client stays an owner of ${property} for a while, until they verify it with their own Google account. Send them the note below.`, // W43

  noteTitle: 'Your Google Search Console data', // W50
  copyNote: 'Copy note', // W52
} as const;

/** W50–W51: the note for one custom domain JDD left. */
export function departureNote(domain: string): { title: string; paragraphs: string[]; text: string } {
  const paragraphs = [
    `We’ve removed Juneau Digital Designs from Google Search Console for ${domain}. Your Google account is still an owner, but only for a limited time.`,
    `To keep your search data, verify the site with your own Google account once it’s live at its new home. Open search.google.com/search-console, pick ${domain}, and go to Settings, then Ownership verification. Your search history stays with it, because the address hasn’t changed.`,
  ];
  return { title: SC.noteTitle, paragraphs, text: `${SC.noteTitle}\n\n${paragraphs.join('\n\n')}` };
}

/**
 * The hosts that get a note: Search Console properties the teardown left (or found already left)
 * on a custom domain. A vercel.app address goes with the site, so it gets none; a failed step
 * left JDD in place, so the client is not told it has gone.
 */
export function departureNoteHosts(steps: Array<{ resource: string; target: string; outcome: string }>): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.resource !== 'gsc.property' || (s.outcome !== 'deleted' && s.outcome !== 'already-gone')) continue;
    let host = '';
    try {
      host = new URL(s.target).hostname;
    } catch {
      continue;
    }
    if (host && !host.endsWith('.vercel.app') && !out.includes(host)) out.push(host);
  }
  return out;
}
