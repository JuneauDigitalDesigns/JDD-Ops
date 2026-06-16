'use client';
import Link from 'next/link';
import { Lightbulb, ArrowRight, Wrench, Stack } from '@phosphor-icons/react';
import CopyButton from './CopyButton';

// Maps a failed onboarding run to concrete remediation. Patterns are matched against the
// collected error text (error events + error-classified log lines) in priority order; the
// first match wins, otherwise a generic recovery block is shown. Strings are grounded in
// the real messages emitted by onboard.js and the /api/runbook/onboard route — keep them in
// sync if those messages change. `{slug}` is interpolated with the selected client.
type Remedy = {
  id: string;
  match: RegExp;
  title: string;
  steps: string[]; // may contain {slug}
  command?: string; // may contain {slug}
  buildLink?: boolean; // show an "Open Build" link
  setup?: boolean; // show an "Open One-time setup" button
};

const REMEDIES: Remedy[] = [
  {
    id: 'missing-env',
    match: /Missing required env:\s*([A-Z0-9_]+)/i,
    title: 'A required credential is missing',
    steps: [
      'onboard.js stopped because a required environment variable is not set.',
      'Copy jdd-ops/.env.example to jdd-ops/.env (if you haven’t already) and fill in the variable named in the log above.',
      'Re-run a dry run to confirm prerequisites pass before provisioning for real.',
    ],
    setup: true,
  },
  {
    id: 'no-intake',
    match: /No intake at|Schema file not found|Missing --schema|Could not derive a slug/i,
    title: 'This client has no intake schema',
    steps: [
      'There is no clients/{slug}/site.ts for onboard.js to read.',
      'Build the site in the Build tab — exporting writes the site.ts intake into this client folder.',
      'Or scaffold a blank intake from the command line, then fill it in:',
    ],
    command: 'npm run new-client -- --slug {slug}',
    buildLink: true,
  },
  {
    id: 'schema-import',
    match: /Could not import schema/i,
    title: 'The intake schema has an error',
    steps: [
      'clients/{slug}/site.ts could not be imported — usually a syntax or type error.',
      'Open the file and fix the error shown in the log, or re-export the site from the Build tab to regenerate it.',
    ],
    buildLink: true,
  },
  {
    id: 'missing-field',
    match: /missing required field/i,
    title: 'The intake is missing required fields',
    steps: [
      'The schema loaded but required fields are empty (also listed under _meta.missing_fields).',
      'Fill the field(s) named in the log in clients/{slug}/site.ts (or in the Build tab), then re-run.',
    ],
    buildLink: true,
  },
  {
    id: 'template-marker',
    match: /Could not find ".*" in template|refusing to overwrite/i,
    title: 'Template mismatch',
    steps: [
      'onboard.js could not find the expected marker in the template’s site.ts and refused to overwrite blindly.',
      'Check that template/src/data/site.ts is the current blank template, then re-run.',
    ],
  },
  {
    id: 'vercel',
    match: /VERCEL_TOKEN not set|Vercel sync failed/i,
    title: 'Vercel sync was skipped or failed',
    steps: [
      'Set VERCEL_TOKEN (and VERCEL_TEAM_ID if you use a Vercel team) in jdd-ops/.env.',
      'Then push the client’s env vars to its Vercel project:',
    ],
    command: 'npm run sync-env -- --slug {slug}',
    setup: true,
  },
  {
    id: 'clerk',
    match: /CLERK_SECRET_KEY not set|CLERK_USER_ID not found/i,
    title: 'The Clerk portal step needs setup',
    steps: [
      'Clerk credentials are not configured, so the portal-user step was skipped.',
      'Complete the Clerk setup in One-time setup (see RUNBOOK.md), then re-run.',
    ],
    setup: true,
  },
  {
    id: 'ops-root',
    match: /Could not locate the jdd-ops root/i,
    title: 'The console cannot find the ops repo',
    steps: [
      'The app could not locate onboard.js by walking up from its working directory.',
      'Launch the console from inside the jdd-ops tree: cd jdd-ops/console && npm run dev.',
    ],
  },
];

const FALLBACK = {
  title: 'How to recover',
  steps: [
    'Read the red lines in the log above — they name what failed.',
    'Re-run as a dry run (toggle on) to test changes without touching live APIs or files.',
    'Confirm the prerequisites in One-time setup are all green, then provision again.',
  ],
  setup: true,
};

export default function NextSteps({
  errorText,
  slug,
  onOpenSetup,
}: {
  errorText: string;
  slug: string;
  onOpenSetup?: () => void;
}) {
  const remedy = REMEDIES.find((r) => r.match.test(errorText));
  const title = remedy?.title ?? FALLBACK.title;
  const steps = (remedy?.steps ?? FALLBACK.steps).map((s) => s.replaceAll('{slug}', slug));
  const command = remedy?.command?.replaceAll('{slug}', slug);
  const showBuild = remedy?.buildLink ?? false;
  const showSetup = (remedy?.setup ?? FALLBACK.setup) && Boolean(onOpenSetup);

  return (
    <div className="panel flex flex-col gap-3 p-5" style={{ borderColor: 'var(--rule-strong)' }}>
      <div className="flex items-center gap-2">
        <Lightbulb size={17} weight="fill" style={{ color: 'var(--warn)' }} />
        <h3 className="font-display text-[16px] font-medium">Next steps</h3>
      </div>
      <p className="kicker" style={{ color: 'var(--warn)' }}>
        {title}
      </p>

      <ol className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[13px] leading-[1.6] text-fg2">
            <span
              className="mono mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px]"
              style={{ border: '1px solid var(--rule-strong)', color: 'var(--fg-3)' }}
            >
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

      {command && (
        <div className="flex items-center gap-2 rounded-[10px] border border-rule bg-[var(--bg-deep)] px-3 py-2">
          <code className="mono flex-1 text-fg2">{command}</code>
          <CopyButton value={command} />
        </div>
      )}

      {(showBuild || showSetup) && (
        <div className="flex flex-wrap gap-2">
          {showBuild && (
            <Link href="/build" className="btn btn-sm btn-primary">
              <Stack size={13} /> Open Build <ArrowRight size={12} weight="bold" />
            </Link>
          )}
          {showSetup && (
            <button type="button" onClick={onOpenSetup} className="btn btn-sm">
              <Wrench size={13} /> One-time setup
            </button>
          )}
        </div>
      )}
    </div>
  );
}
