'use client';

import { useCallback, useState } from 'react';
import { CheckCircle, Copy, EnvelopeSimple, Hourglass, XCircle } from '@phosphor-icons/react';
import { welcomeSignupUrl } from '@/lib/welcomeLink';
import { useManage } from './ManageContext';
import SectionHeader from './SectionHeader';

/**
 * What Manage shows for a client converted from a lead who hasn't onboarded on the agency site.
 *
 * Replaces Overview entirely rather than sitting above it. There is no deploy, domain or env to
 * report on, and OverviewSection would fire a request for each of them at a project that does
 * not exist. Build and Onboard are locked behind the same fact (lib/onboardingGate), so this is
 * the one place the operator can move the client forward: send the welcome email, or copy the
 * link and send it some other way.
 *
 * It unlocks by itself. The gate re-reads the client's portal account on every load, so once the
 * client finishes onboarding this card is simply no longer rendered.
 */
export default function AwaitingOnboarding() {
  const { ctx } = useManage();
  const email = ctx.awaitingOnboarding?.email ?? null;

  const [send, setSend] = useState<{ loading: boolean; ok?: boolean; error?: string }>({
    loading: false,
  });
  const [copied, setCopied] = useState(false);

  const sendWelcome = useCallback(async () => {
    setSend({ loading: true });
    try {
      const res = await fetch(`/api/c/${ctx.slug}/welcome`, { method: 'POST', cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && body.ok) setSend({ loading: false, ok: true });
      else setSend({ loading: false, error: body.error ?? 'Send failed.' });
    } catch {
      setSend({ loading: false, error: 'Send failed. Check the console logs.' });
    }
  }, [ctx.slug]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(welcomeSignupUrl(ctx.plan));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  }, [ctx.plan]);

  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-8 lg:px-10">
      <SectionHeader title="Overview" lede={`Waiting on onboarding · clients/${ctx.slug}`} />

      <div
        className="rounded-[12px] border p-5"
        style={{ borderColor: 'var(--warn)', background: 'var(--surface)' }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-fg">
              <Hourglass size={15} weight="fill" style={{ color: 'var(--warn)', flexShrink: 0 }} />
              Waiting on {ctx.brandName} to onboard
            </span>
            <p className="text-xs text-fg2">
              This client hasn&apos;t finished onboarding on the agency site yet, so Build and Onboard
              are locked. Send them the welcome email to get them started. Everything unlocks on its
              own once they finish.
            </p>
            {email ? (
              <p className="text-xs text-fg3">
                The email goes to <span className="font-mono text-fg2">{email}</span>, the
                {' '}
                <span className="capitalize">{ctx.plan}</span> plan link.
              </p>
            ) : (
              <p className="text-xs" style={{ color: 'var(--warn)' }}>
                No email is on file for this client, so the welcome email can&apos;t be sent. You can
                still copy the signup link.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={sendWelcome}
              disabled={!email || send.loading || send.ok}
              className="btn btn-sm btn-primary"
            >
              <EnvelopeSimple size={13} weight={send.loading ? 'regular' : 'fill'} />
              {send.loading ? 'Sending…' : send.ok ? 'Sent' : 'Send welcome email'}
            </button>
            <button type="button" onClick={copyLink} className="btn btn-sm">
              <Copy size={13} /> {copied ? 'Copied' : 'Copy signup link'}
            </button>
          </div>

          {send.ok && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--ok)' }}>
              <CheckCircle size={13} weight="fill" /> Welcome email sent.
            </p>
          )}
          {send.error && (
            <p className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--danger)' }}>
              <XCircle size={13} weight="fill" /> {send.error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
