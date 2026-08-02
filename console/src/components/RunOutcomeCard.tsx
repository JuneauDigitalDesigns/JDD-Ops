'use client';
import { CheckCircle, ArrowSquareOut, GithubLogo } from '@phosphor-icons/react';
import type { RunState } from '@/lib/onboard-parse';
import CopyButton from './CopyButton';

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="meta w-28 shrink-0">{label}</span>
      <code className="codechip flex-1">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}

function LinkRow({ label, href, Icon }: { label: string; href: string; Icon: typeof ArrowSquareOut }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="meta w-28 shrink-0">{label}</span>
      <a href={href} target="_blank" rel="noreferrer" className="btn btn-sm inline-flex min-w-0 flex-1">
        <Icon size={13} />
        <span className="truncate">{href}</span>
      </a>
      <CopyButton value={href} />
    </div>
  );
}

/**
 * The artifacts a real provisioning run creates — the things you actually need afterward, which
 * otherwise vanish into the raw log. Rendered only on a successful REAL run.
 */
export default function RunOutcomeCard({ state }: { state: RunState }) {
  const multi = state.sites.length > 1;
  return (
    <div className="panel flex flex-col gap-4 p-5" style={{ borderColor: 'var(--ok)' }}>
      <div className="flex items-center gap-2">
        <CheckCircle size={18} weight="fill" style={{ color: 'var(--ok)' }} />
        <h3 className="font-display text-base font-medium">Provisioned — what was created</h3>
      </div>

      {state.sites.map((s, i) => (
        <div key={i} className="flex flex-col gap-2">
          {multi && <span className="meta" style={{ color: 'var(--accent)' }}>{s.label}</span>}
          {s.repo && <LinkRow label="Repo" href={s.repo} Icon={GithubLogo} />}
          {s.agent && <CopyRow label="Retell agent" value={s.agent} />}
          {s.number && <CopyRow label="Phone number" value={s.number} />}
        </div>
      ))}

      <div className="flex flex-col gap-2 border-t border-rule pt-3">
        {state.vercelProject && <CopyRow label="Vercel project" value={state.vercelProject} />}
        {state.sharedBase && <CopyRow label="Airtable base" value={state.sharedBase} />}
        {state.portal && <LinkRow label="Portal" href={state.portal} Icon={ArrowSquareOut} />}
      </div>

      <p className="text-2xs text-fg3">Status advanced automatically. Continue with the checkpoints below.</p>
    </div>
  );
}
