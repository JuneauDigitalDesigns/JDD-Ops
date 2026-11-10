// The Google Business Profile manual step (SEO plan D12), split out of runbook-content.ts so a
// test can load it: runbook-content imports @jdd/schema at run time, which the tsx test loader
// cannot resolve. Type-only imports here, so this module has no runtime dependencies.
import type { Block, Phase } from '@/lib/runbook-content';
import type { ClientContext } from '@/lib/types';

function pending(label: string): { value: string; pending: boolean } {
  return { value: label, pending: true };
}

// ── Onboarding: Google Business Profile ────────────────────────────────────────
/**
 * SEO plan D12 (Xander, 2026-11-10): the client's Google Business Profile must list the number
 * the site publishes and link to the site. A manual step here because "this is where manual
 * client onboarding steps are surfaced", not a go-live checklist item.
 *
 * Why it matters: the profile is the strongest local-ranking input, and a profile whose phone
 * differs from the site is a known negative (Whitespark's expert survey). For a client with a
 * receptionist the site publishes the JDD Twilio number, so a profile still on the owner's line
 * also sends callers around /api/voice and the agent. One step per site: each enterprise site has
 * its own number and URL.
 */
export function gbpPhase(ctx: ClientContext): Phase {
  return {
    id: 'google-business-profile',
    group: 'onboarding',
    title: 'Google Business Profile',
    subtitle: 'Point the profile at the site’s phone number and website.',
    steps: ctx.sites.map((site) => {
      const phone = site.brandPhone ? { value: site.brandPhone, pending: false } : pending('the number the site publishes (not set yet)');
      const url = site.canonical ? { value: site.canonical, pending: false } : pending('the live site URL (not set yet)');
      return {
        id: ctx.sites.length > 1 ? `gbp-${site.slug}` : 'gbp-match-site',
        title: 'Match the Google Business Profile to the site',
        why: 'The profile’s phone and website must be the ones the site shows. A different phone on the profile is a local-ranking negative, and on a site with a receptionist it sends callers past the call routing.',
        ...(ctx.sites.length > 1 ? { site: site.brandName } : {}),
        blocks: [
          { t: 'fields', caption: 'Values for the profile', rows: [
            { label: 'Primary phone', value: phone.value, pending: phone.pending },
            { label: 'Website', value: url.value, pending: url.pending },
          ] } as Block,
          {
            t: 'substeps',
            items: [
              { text: 'Google Business Profile → Edit profile → Contact: set the primary phone to the number above.', detail: 'It is the number the site publishes. The owner’s own line stays off the profile.' },
              { text: 'Edit profile → Contact → Website: set it to the site URL above.' },
              { text: 'If customers don’t come to the business address: Edit profile → Location → hide the address, and list the same towns the site serves (up to 20).' },
              { text: 'Add the profile’s link to the client’s profile links in the console intake (Google Business Profile).', detail: 'It feeds the site’s "Find us on" footer block and the structured data’s sameAs.' },
            ],
          },
          { t: 'nav', app: 'Google Business Profile', path: ['Edit profile', 'Contact'] },
          { t: 'link', label: 'Open Google Business Profile', href: 'https://business.google.com/' },
        ],
      };
    }),
  };
}
