import 'server-only';
import { samePhone, toE164 } from '@jdd/schema';
import type { Finding, PortalAccount, PortalSite } from '@jdd/schema';
import type { SiteInfo } from './types';
import {
  cancelKvConfigured,
  getCancelRequestRecord,
  getFeaturedRequestRecord,
} from './cancelKv';

/**
 * Everything a client can change about themselves, brought back to the operator.
 *
 * The portal lets a client edit their contact details, grant or revoke SMS consent, opt in
 * to being a featured site, and cancel. All four write to KV. Until now the console read
 * exactly none of them — cancelKv.ts had been written, complete and correct, and imported
 * by nothing, so a cancellation reached you as an email and nowhere else.
 *
 * ── Why the contact-phone check is the important one ────────────────────────
 *
 * The portal's Settings page writes `contactPhone` onto `account.profile`, and that field
 * is read back by exactly one thing: the portal's own Settings page. Meanwhile the number
 * Twilio actually rings on an inbound call is `CLIENT_FORWARD_PHONE` in the site's
 * `.env.local`, which nothing updates.
 *
 * So a client who changes their number in the portal sees it saved, believes it, and their
 * calls keep forwarding to the old one indefinitely. There is no error, no bounce, and no
 * symptom on our side — the first sign is a client asking why they stopped getting calls.
 * That is the failure this whole project started from.
 *
 * The fix is offered, never applied automatically: a typo typed into the portal would
 * otherwise silently reroute a business's phone calls.
 *
 * ── The rule every finding in this file obeys ───────────────────────────────
 *
 * GATE ON EXPECTED STATE. A client mid-build has no voice agent, no live URL and no
 * subscription, and none of those are faults — they are what "building" means. Reporting
 * them anyway fires on every client until launch day, and `attention.ts` already recorded
 * where that ends: "a warning that is always on is wallpaper."
 *
 * This has been got wrong three separate times while building this engine — on the site
 * checks, on the portal-record lookup, and on the plan/agent check below — so it is written
 * down here rather than left to be rediscovered a fourth time. Before adding a finding, ask
 * what state the client must be in for it to be true, and gate on that.
 */

export interface PortalSignalInput {
  slug: string;
  site: SiteInfo;
  account: PortalAccount | null;
  portalSite: PortalSite | null;
}

/**
 * Findings from the portal side. Cheap — one KV read per signal, no vendor APIs — so this
 * runs on every sweep rather than being gated behind a button.
 */
export async function portalSignalFindings({
  slug,
  site,
  account,
  portalSite,
}: PortalSignalInput): Promise<Finding[]> {
  const findings: Finding[] = [];
  const siteSlug = site.slug;

  // ── Contact phone vs the number Twilio actually rings ────────────────────
  const profilePhone = account?.profile?.contactPhone ?? null;
  const forwardPhone = site.env.CLIENT_FORWARD_PHONE ?? null;

  // A CLIENT_FORWARD_PHONE that can't be parsed is a DIFFERENT problem from one that
  // disagrees with the portal, and reporting it as "the client changed their number" tells
  // the wrong story about the wrong party. It is also worse: an unparseable value means
  // /api/voice has nothing valid to dial, so the human-first ring is already broken.
  if (forwardPhone && toE164(forwardPhone) === null) {
    findings.push({
      id: 'voice.forwardPhoneMalformed',
      severity: 'red',
      area: 'voice',
      siteSlug,
      title: 'Forwarding number is not a dialable number',
      detail:
        'CLIENT_FORWARD_PHONE cannot be normalized to E.164, so /api/voice has nothing valid to ' +
        'ring and the human-first hop is already failing — every call goes straight to the agent, ' +
        'or nowhere. Fix it in Environment.',
      actual: forwardPhone,
    });
  } else if (profilePhone && forwardPhone && !samePhone(profilePhone, forwardPhone)) {
    findings.push({
      id: 'portal.contactPhoneDrift',
      severity: 'amber',
      area: 'voice',
      siteSlug,
      title: 'Client changed their contact number in the portal',
      detail:
        'The portal saved this and told them it was done, but CLIENT_FORWARD_PHONE — the number ' +
        'Twilio actually rings before falling through to the agent — still points at the old one. ' +
        'Their calls are going to a number they no longer use, silently. Applying this writes ' +
        '.env.local, pushes it to Vercel and redeploys.',
      expected: profilePhone,
      actual: forwardPhone,
      fix: {
        route: '/api/manage/repair',
        body: { slug, siteSlug, action: 'profile.forwardPhone' },
        label: 'Update the forwarding number',
      },
    });
  } else if (profilePhone && !forwardPhone && site.env.TWILIO_NUMBER) {
    // A voice-enabled site with no forwarding number never rings a human at all: every
    // call goes straight to the agent, which is not what human-first routing promises.
    findings.push({
      id: 'portal.noForwardPhone',
      severity: 'amber',
      area: 'voice',
      siteSlug,
      title: 'No forwarding number set',
      detail:
        'This site has a Twilio number but no CLIENT_FORWARD_PHONE, so inbound calls never ring ' +
        'a human first — they go straight to the agent. The portal has a contact number on file.',
      expected: profilePhone,
      actual: '(unset)',
      fix: {
        route: '/api/manage/repair',
        body: { slug, siteSlug, action: 'profile.forwardPhone' },
        label: 'Set the forwarding number',
      },
    });
  }

  if (!cancelKvConfigured()) return findings;

  // ── Cancellation ─────────────────────────────────────────────────────────
  // Read from the dedicated signal rather than the account record: the portal writes this
  // one the moment the client asks, with the notice period already resolved, so it is both
  // earlier and more specific. reconcileBilling deliberately no longer reports this, or a
  // single cancellation would produce two rows saying the same thing.
  const cancel = await getCancelRequestRecord(slug).catch(() => null);
  if (cancel) {
    const effective = cancel.effectiveAt;
    const gone = effective > 0 && effective < Date.now();
    const days = Math.max(0, Math.ceil((effective - Date.now()) / 86_400_000));
    findings.push({
      id: 'portal.cancelRequested',
      severity: 'red',
      area: 'account',
      siteSlug,
      title: gone
        ? `Cancellation took effect — ${cancel.siteName}`
        : `Cancellation requested — ${days} day${days === 1 ? '' : 's'} of notice left`,
      detail: gone
        ? `${cancel.accountEmail} cancelled their ${cancel.plan} plan and the notice period has ended. ` +
          'The infrastructure is still provisioned and still costing you money until it is torn down.'
        : `${cancel.accountEmail} asked to cancel their ${cancel.plan} plan. It ends ` +
          `${new Date(effective).toISOString().slice(0, 10)}. This is the window to talk to them.`,
      actual: new Date(cancel.requestedAt).toISOString().slice(0, 10),
    });
  }

  // ── Featured-site opt-in ─────────────────────────────────────────────────
  // Grey: nothing is wrong. But a client volunteering to be a case study is a a short-lived
  // offer, and it currently reaches you nowhere at all.
  const featured = await getFeaturedRequestRecord(slug).catch(() => null);
  if (featured) {
    findings.push({
      id: 'portal.featuredOptIn',
      severity: 'grey',
      area: 'account',
      siteSlug,
      title: 'Client opted in to being featured',
      detail:
        `${featured.accountEmail} agreed to appear as a featured site` +
        (featured.quote ? ` and left a quote: “${featured.quote}”` : '') +
        `. Name ${featured.showName ? 'may' : 'may NOT'} be shown; link ` +
        `${featured.showLink ? 'may' : 'may NOT'} be shown. Publish it from the homepage tooling.`,
      actual: new Date(featured.optedInAt).toISOString().slice(0, 10),
    });
  }

  // ── Plan mismatch between the portal record and what's provisioned ───────
  // Distinct from billing's plan drift, which compares the record to Stripe. This compares
  // the record to what actually exists on disk: a client upgraded to growth who still has
  // no agent is paying for a receptionist they do not have.
  //
  // Gated on status === 'live', and that gate is the whole difference between a useful
  // finding and wallpaper. A client mid-build has no agent BY DEFINITION — that is what
  // "building" means — so without this both current clients lit up red permanently, which
  // is the third time this exact mistake has been made in this engine. See the rule at the
  // top of the file.
  if (
    portalSite?.status === 'live' &&
    portalSite.plan !== 'starter' &&
    !site.env.RETELL_AGENT_ID
  ) {
    findings.push({
      id: 'portal.planNotProvisioned',
      severity: 'red',
      area: 'account',
      siteSlug,
      title: `On ${portalSite.plan}, but no voice agent is provisioned`,
      detail:
        'The portal record says this client is on a plan that includes a voice receptionist, but ' +
        'there is no RETELL_AGENT_ID for this site. If they are being billed for it, they are ' +
        'paying for something that does not exist.',
      expected: `${portalSite.plan} with an agent`,
      actual: 'no RETELL_AGENT_ID',
    });
  }

  return findings;
}
