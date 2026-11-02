# Implementation spec — Build-studio condense + Onboard restructure

> **This is an execution spec, not a discussion doc.** Every edit below names the exact file,
> the exact anchor to find, and the exact code to write. Do the edits verbatim. Do **not**
> redesign, rename, or "improve" beyond what is written. When something is genuinely ambiguous
> it is called out under **CONFIRM** — stop and ask, do not guess.
>
> Author: planning session 2026-10-29. Branch: decide with the user (`feat/onboard-wizard-redesign` or new).

---

## 0. Rules of engagement (read first)

- **Scope is exactly two things:** (A) condense the Build **Studio** step's vertical chrome;
  (B) restructure the onboard runbook (`console/src/lib/runbook-content.ts`) into two macro-phases
  and add the per-client Make field-mapping step. Nothing else.
- **DO NOT touch** `onboard.js`, anything under `jdd-ops/lib/`, the fixtures, `run-plan.ts`,
  `onboard-parse.ts`, or any test. The onboard changes here are **UI content only**
  (`runbook-content.ts` + two components) plus a doc.
- **DO NOT** change the Build **Intake** step, the top `ConsoleNav`, or the `ToolBar` shell
  component. The 40px `ToolBar` strip already self-collapses when its portal slot is empty
  (`console/src/components/shell/ToolBar.tsx:29`) — rely on that, don't modify it.
- **Gates (must all pass before done):**
  1. `cd console && npm run build` — zero errors. Remove any import/var the build reports as
     unused *only* if these edits made it unused (the spec lists the expected ones).
  2. `cd console && npm test` — green. (No test imports `runbook-content.ts`; the phase-contract
     test only parses onboard.js stdout via `run-plan.ts`, so it is unaffected. Confirm it stays green.)
  3. `cd jdd-ops && npm test` — green (should be untouched; run to prove you didn't drift into `lib/`).
- Match surrounding code style: these files use 2-space indent, single quotes, Tailwind class
  strings, and `’`-style curly apostrophes in user-facing copy. Keep that.

---

## WORKSTREAM A — Condense the Build Studio

Locked decisions: merge the step-pill strip into the PageStudio toolbar; Templates band → a
popover button; tighten the preview card padding; single undo/redo per step; **top nav and
Intake untouched.** The Templates control is a transient popover, so there is **no** persisted
open/closed state and **no** localStorage key — default closed. (The earlier "remember per
session" answer applied to a collapsible-band approach that was not chosen.)

### A1. `console/src/app/c/[slug]/build/BuildWizard.tsx` — extract step pills, gate NavSlot to Intake, pass pills to Studio

**A1.1 — Remove now-dead imports.** Find (line 5):
```tsx
import { ArrowLeft, ArrowRight, Check, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react';
```
Replace with:
```tsx
import { Check, ArrowUUpLeft, ArrowUUpRight } from '@phosphor-icons/react';
```
(`ArrowLeft`/`ArrowRight` were used only by the Back/Next buttons removed in A1.3.)

**A1.2 — Remove the now-dead `isLast`.** Find (line ~719):
```tsx
  // ── Navigation ───────────────────────────────────────────────────────────
  const isLast = stepIndex === STEPS.length - 1;

  function go(nextIndex: number) {
```
Replace with:
```tsx
  // ── Navigation ───────────────────────────────────────────────────────────
  function go(nextIndex: number) {
```

**A1.3 — Extract `stepNav` and gate the NavSlot to the Intake step.** Find the entire `<NavSlot>…</NavSlot>`
block (currently lines ~743–827, from `<NavSlot>` through its closing `</NavSlot>`). Replace the
WHOLE block with:

```tsx
      {/* The two step pills (Intake · Studio). On the Intake step they render in the ToolBar
          strip (below); on the Studio step they are handed to PageStudio and render inline in
          its toolbar, so the 40px strip collapses and the preview gets that height back. */}
      <NavSlot>
        {step === 'intake' && (
          <>
            {stepNav}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Undo/redo for the Intake step only — drives the Intake stack. The Studio step's
                  undo/redo lives in the PageStudio toolbar. */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={intakeHistory.undo}
                  disabled={!intakeHistory.canUndo}
                  aria-label="Undo"
                  className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUUpLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={intakeHistory.redo}
                  disabled={!intakeHistory.canRedo}
                  aria-label="Redo"
                  className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <ArrowUUpRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </NavSlot>
```

**A1.4 — Define `stepNav` once.** Immediately BEFORE the `return (` of the component (just after
`const variants = stepVariants(reduce);`, line ~727), insert:

```tsx
  // The step pills, defined once and rendered in exactly one place per step: the ToolBar strip
  // on Intake (via NavSlot) or the PageStudio toolbar on Studio (via the stepNav prop). Only one
  // branch mounts at a time because `step` is one value, so there is no duplicate-key risk.
  const stepNav = (
    <div className="flex shrink-0 items-center gap-1.5">
      {STEPS.map((s, i) => {
        const state = i === stepIndex ? 'active' : i < stepIndex ? 'done' : 'todo';
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => i < stepIndex && go(i)}
            disabled={i > stepIndex}
            className={[
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              state === 'active'
                ? 'bg-accent text-[var(--accent-ink)]'
                : state === 'done'
                ? 'text-accent hover:bg-surface'
                : 'cursor-default text-fg3/60',
            ].join(' ')}
          >
            <span
              className={[
                'flex h-4 w-4 items-center justify-center rounded-full text-2xs',
                state === 'active'
                  ? 'bg-[var(--accent-ink)] text-accent'
                  : state === 'done'
                  ? 'bg-accent text-[var(--accent-ink)]'
                  : 'border border-current',
              ].join(' ')}
            >
              {state === 'done' ? <Check size={9} weight="bold" /> : i + 1}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );

```

**A1.5 — Pass `stepNav` to PageStudio.** Find the `<PageStudio` call (line ~875) and add the prop
as the first prop after the opening tag:
```tsx
                <PageStudio
                  stepNav={stepNav}
                  composition={siteComposition}
```

### A2. `console/src/app/c/[slug]/build/PageStudio.tsx` — accept `stepNav`, add Templates popover, remove Templates band, tighten padding

**A2.1 — Import `createPortal`.** Find (line 3):
```tsx
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
```
Immediately AFTER it add:
```tsx
import { createPortal } from 'react-dom';
```

**A2.2 — Add `stepNav` to props.** In the destructured params (lines ~34–40) add `stepNav,` as the
first item:
```tsx
export default function PageStudio({
  stepNav,
  composition, effective, categories, vertical, slug,
```
In the props type (the `}: {` block, after line ~41) add as the first member:
```tsx
}: {
  stepNav?: React.ReactNode;
  composition: SiteComposition;
```

**A2.3 — Popover state + anchor.** Find the existing state block (lines ~62–67):
```tsx
  const [activeRoute, setActiveRoute] = useState('');
  // Which section's hover control panel is open (by its style key). Only one at a time.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
```
Immediately AFTER `const trackRef = useRef<HTMLDivElement>(null);` add:
```tsx
  // Templates popover. Rendered in a portal to document.body because PageStudio's root is
  // overflow-hidden, which would clip a popover anchored inside the toolbar. Transient — no
  // persisted state. Position is measured from the button on open.
  const templatesBtnRef = useRef<HTMLButtonElement>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templatesPos, setTemplatesPos] = useState<{ top: number; left: number } | null>(null);
  const openTemplates = () => {
    const r = templatesBtnRef.current?.getBoundingClientRect();
    if (r) setTemplatesPos({ top: r.bottom + 6, left: r.left });
    setTemplatesOpen(true);
  };
```

**A2.4 — Toolbar: add `stepNav` on the left and a Templates button on the right.**
Find the toolbar opening (lines ~170–192):
```tsx
        {/* Toolbar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-panel px-5 py-2.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
```
Replace ONLY the first two lines (the comment + the opening `<div …>` and the start of the page-switcher group) so that `stepNav` + a divider precede the page switcher:
```tsx
        {/* Toolbar — step pills (Studio step) · page switcher · actions */}
        <div className="flex shrink-0 items-center gap-3 border-b border-rule bg-panel px-5 py-2.5">
          {stepNav && (
            <>
              {stepNav}
              <div className="mx-1 h-5 w-px shrink-0 bg-rule" aria-hidden />
            </>
          )}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous page"
```

Then find the right-side action group (lines ~193–197):
```tsx
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center">
              <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:opacity-30"><ArrowUUpLeft size={15} /></button>
```
Insert the Templates button as the FIRST child of the `ml-auto` group:
```tsx
          <div className="ml-auto flex items-center gap-2">
            <button
              ref={templatesBtnRef}
              type="button"
              onClick={() => (templatesOpen ? setTemplatesOpen(false) : openTemplates())}
              className="btn btn-sm"
            >
              <Cards size={15} /> Templates
            </button>
            <div className="flex items-center">
              <button type="button" onClick={onUndo} disabled={!canUndo} title="Undo" className="rounded-md p-1.5 text-fg3 hover:bg-surface hover:text-fg disabled:opacity-30"><ArrowUUpLeft size={15} /></button>
```

**A2.5 — Remove the Templates band.** Find and DELETE this entire block (lines ~213–248):
```tsx
          {/* Templates — one card per built vertical. Applying one sets layout/colors/type
              across all four pages at once. All are shown so any vertical can be spot-checked
              from any client without cycling through the Intake vertical picker. */}
          <div className="shrink-0 border-b border-rule bg-panel/40 px-5 py-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg3">
              Templates
              <span className="normal-case tracking-normal text-fg3">· each applies to the whole site</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(VERTICAL_TEMPLATES) as [VerticalId, { label: string }][]).map(([id, tmpl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onApplyVerticalTemplate(id)}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    id === vertical
                      ? 'border-accent/60 bg-surface hover:border-accent'
                      : 'border-rule bg-surface/50 hover:border-accent/50',
                  ].join(' ')}
                >
                  <span className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    id === vertical ? 'bg-accent text-[var(--accent-ink)]' : 'bg-surface text-fg3',
                  ].join(' ')}>
                    <Cards size={20} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-fg">{tmpl.label}</span>
                    <span className="block text-xs text-fg3">Layout · colors · type</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

```
The `<div className="flex min-h-0 flex-1 flex-col">` that wrapped it stays; it now wraps only the
page track. Leave that wrapper as-is.

**A2.6 — Tighten the preview card padding.** Find (line ~264):
```tsx
              <div key={page.route || 'home'} className="h-full w-full shrink-0 snap-start overflow-y-auto p-5">
```
Replace `p-5` with `p-2`:
```tsx
              <div key={page.route || 'home'} className="h-full w-full shrink-0 snap-start overflow-y-auto p-2">
```

**A2.7 — Render the Templates popover (portal).** Find the Launch/Deploy dialogs block near the end
(line ~284):
```tsx
      {/* ── Launch / Deploy (interim: home page via legacy bridge) ──────── */}
      <AnimatePresence>
```
Immediately BEFORE that comment line, insert:
```tsx
      {/* Templates popover — portal to body so overflow-hidden ancestors can't clip it. */}
      {templatesOpen && templatesPos && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setTemplatesOpen(false)} />
          <div
            className="fixed z-[61] w-[min(680px,90vw)] rounded-xl border border-rule bg-panel p-4 shadow-panel"
            style={{ top: templatesPos.top, left: templatesPos.left }}
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg3">
              Templates
              <span className="normal-case tracking-normal text-fg3">· each applies to the whole site</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(VERTICAL_TEMPLATES) as [VerticalId, { label: string }][]).map(([id, tmpl]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { onApplyVerticalTemplate(id); setTemplatesOpen(false); }}
                  className={[
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    id === vertical
                      ? 'border-accent/60 bg-surface hover:border-accent'
                      : 'border-rule bg-surface/50 hover:border-accent/50',
                  ].join(' ')}
                >
                  <span className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    id === vertical ? 'bg-accent text-[var(--accent-ink)]' : 'bg-surface text-fg3',
                  ].join(' ')}>
                    <Cards size={20} weight="bold" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-fg">{tmpl.label}</span>
                    <span className="block text-xs text-fg3">Layout · colors · type</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body,
      )}

```
`Cards` and `VERTICAL_TEMPLATES` remain in use (button + popover) — do **not** remove their imports.

### A3. Build-studio acceptance check (manual)
Run `npm run console`, open a client's `/build`, go to the Studio step and confirm:
- No 40px step-pill strip above the PageStudio toolbar; the Intake · Studio pills sit at the
  left of the PageStudio toolbar.
- The Templates band is gone; a "Templates" toolbar button opens a popover of the vertical cards;
  clicking a card applies it and closes the popover; clicking outside closes it.
- The preview sits noticeably higher (≈150px reclaimed) with a tighter card frame.
- On the Intake step: pills + undo/redo still render in the top ToolBar strip (unchanged).

---

## WORKSTREAM B — Onboard runbook restructure

All UI edits are in `console/src/lib/runbook-content.ts` and `console/src/components/onboard/PhaseBreadcrumbs.tsx`.
Model today is flat `Phase[]` → `Step[]`, rendered as breadcrumbs. We add a `group` tag so there
are two macro-phases — **Onboarding** (all the work) then **Review** (all checks + reference) —
each containing named sub-phases. `flatten()`/`progressOf()`/`firstIncomplete()`/`phaseProgress()`
in `runbook-nav.ts` iterate phases in order and need **NO change**; the new order flows through them.

Locked decisions:
- Remove `twilio-sms-reg-{slug}` (SMS pool-add is automatic) and `invite-client` (portal signup is
  part of onboarding) entirely.
- Remove the `postcall-auto-{slug}` "automated" explainer and replace it with a **manual**
  `make-fieldmap-{slug}` step carrying the Airtable field table + Twilio body.
- Keep checkpoints as actionable steps, in the Review macro-phase.
- Keep `call-routing` (auto reference) — place it LAST in its Review sub-phase.
- Progress already excludes `auto` steps (`runbook-nav.ts:29`) — no change needed there.

### B1. `runbook-content.ts` — add `group` to the `Phase` interface

Find (lines ~77–82):
```tsx
export interface Phase {
  id: string;
  title: string;
  subtitle?: string;
  steps: Step[];
}
```
Replace with:
```tsx
export interface Phase {
  id: string;
  title: string;
  subtitle?: string;
  /**
   * Which macro-phase this sub-phase belongs to: all `onboarding` sub-phases (the work) render
   * before all `review` sub-phases (checks + reference). OPTIONAL so go-live-content.ts phases,
   * which borrow this type and have no macro grouping, keep compiling. buildRunbook always sets it.
   */
  group?: 'onboarding' | 'review';
  steps: Step[];
}
```
> **Why optional:** `console/src/lib/go-live-content.ts` imports the `Phase` type and builds phases
> without a `group`. A required field would break the go-live build. Do not edit go-live-content.ts.

### B2. `runbook-content.ts` — remove the unused import

Find (line 5):
```tsx
import { vercelVoiceUrl } from '@jdd/schema';
```
DELETE the line. (`vercelVoiceUrl` was used only by the removed `twilio-sms-reg` step. `ClientContext`,
`OpsConfig`, `Plan`, `SiteInfo` on line 6 all remain in use.)

### B3. `runbook-content.ts` — replace the per-client phase functions

Replace the ENTIRE span from the comment `// ── per-client phases ───` (line ~115) down to and
including the `buildRunbook` function's closing brace (line ~482) — i.e. the current
`provisionPhase`, `voicePhase`, `callbackStepsForSite`, `callbackPhase`, `portalPhase`, and
`buildRunbook` — with the following. Keep everything ABOVE line 115 (helpers `pending`, `envVal`,
`clerkMetadataJson`) and everything BELOW `buildRunbook` (`buildPartA`, `PLAN_LABEL`) unchanged.

```tsx
// ── per-client phases ────────────────────────────────────────────────────────
// Two macro-groups, in order: ONBOARDING (everything you must DO) then REVIEW (everything you
// check once the work is done, plus reference). `group` tags each sub-phase; buildRunbook emits
// all onboarding sub-phases first, then all review sub-phases. Sub-phase titles name the action.

// ── Onboarding: Provision ─────────────────────────────────────────────────────
function provisionPhase(ctx: ClientContext, config: OpsConfig): Phase {
  const voice = !ctx.isWebOnly;
  const org = config.githubOrg ?? 'GITHUB_ORG';
  return {
    id: 'provision',
    group: 'onboarding',
    title: 'Provision the stack',
    subtitle: 'Run the orchestrator to stand up the whole client stack.',
    steps: [
      {
        id: 'run-onboard',
        launch: true,
        title: 'Launch onboard.js',
        why: 'One command stands up the whole stack: GitHub repo, schema, build, Vercel deploy — plus (Growth/Enterprise) the Retell agent, phone number, Airtable base, Make post-call clone, and the Clerk portal user.',
        blocks: [
          { t: 'diagram', kind: 'pipeline' },
          {
            t: 'context',
            label: 'GitHub repo it creates',
            from: 'auto-created by onboard step 2',
            to: `github.com/${org}/${ctx.slug}`,
            value: `https://github.com/${org}/${ctx.slug}`,
          },
          {
            t: 'callout',
            tone: 'warn',
            title: 'Re-running is safe',
            body: 'If a step FAILs: fix the cause in jdd-ops/.env and re-run. onboard.js is idempotent — it reuses already-provisioned IDs from .env.local, so re-runs won’t double-charge or duplicate resources.',
          },
          {
            t: 'verify',
            title: 'A clean run ends with',
            items: [
              { text: 'The log reaching [step 10/10] and printing an ONBOARDED summary, with no FAIL or ✗ lines.' },
              {
                text: voice
                  ? 'A repo URL, Retell agent id, phone number, Airtable base, and Clerk user id in that summary.'
                  : 'A repo URL and a Clerk user id in that summary.',
              },
            ],
          },
        ],
      },
    ],
  };
}

// ── Onboarding: map the cloned post-call scenario (per site, non-web-only) ──────
// The clone inherits the MASTER's module settings, so its Airtable + Twilio modules must be
// pointed at THIS client by hand before the first real call. The exact field expressions and
// message body are operator-supplied and reproduced verbatim.
function callLoggingSetupStepsForSite(ctx: ClientContext, s: SiteInfo): Step[] {
  const label = ctx.isEnterprise ? ` (${s.brandName})` : '';
  // The {{newline}} tokens are Make functions and must be copied exactly. A `json` block
  // (preformatted <pre> + copy button) is used so the line breaks survive — a single-line `copy`
  // chip would collapse them in the preview.
  const twilioBody = [
    'Name:{{1.call.call_analysis.custom_analysis_data.caller_name}}',
    '{{newline}}',
    'Status:{{1.call.call_analysis.custom_analysis_data.caller_priority}}',
    '{{newline}}',
    'Phone: {{if(1.call.direction = "inbound"; 1.call.from_number; 1.call.to_number)}}',
    '{{newline}}',
    'About: {{1.call.call_analysis.call_summary}}',
  ].join('\n');
  return [
    {
      id: `make-fieldmap-${s.slug}`,
      site: s.slug,
      title: `Map the cloned call-log scenario${label}`,
      why: 'onboard.js clones the master post-call scenario for this client, but the cloned Airtable and Twilio modules carry the master’s module settings — they do not point at this client yet. Open the clone and set the Airtable base/table + field mappings and the Twilio number + message body before the first real call.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: `Make.com → open this client’s cloned scenario “Post-call: ${s.brandName}”.` },
            { text: 'Airtable module (Create a Record): set the Base to THIS client’s base and the Table to “Call Log”.', detail: 'The clone still points at the master’s placeholder base until you change it.' },
            { text: 'Map each Call Log field to the expression in the table below (copy each). Leave Outcome unmapped — nothing writes it.' },
            { text: 'Twilio module (Send a Message): set the From/To to this client’s numbers, then paste the message body below.' },
            { text: 'Save, then confirm the scenario is Active.' },
          ],
        },
        {
          t: 'fields',
          caption: 'Airtable → Create a Record — Call Log field mappings:',
          rows: [
            { label: 'Date', value: '{{parseDate(1.call.start_timestamp; "x")}}' },
            { label: 'Caller name', value: '{{1.call.call_analysis.custom_analysis_data.caller_name}}' },
            { label: 'Caller number', value: '{{if(1.call.direction = "inbound"; 1.call.from_number; 1.call.to_number)}}' },
            { label: 'Summary', value: '{{1.call.call_analysis.call_summary}}' },
            { label: 'Duration (seconds)', value: '{{round(ifempty(1.call.duration_ms; 0) / 1000)}}' },
            { label: 'Call type', value: '{{1.call.direction}}' },
            { label: 'Email', value: '{{1.call.call_analysis.custom_analysis_data.caller_email}}' },
            { label: 'Address', value: '{{1.call.call_analysis.custom_analysis_data.caller_address}}' },
            { label: 'Recording URL', value: '{{1.call.recording_url}}' },
            { label: 'Priority', value: '{{1.call.call_analysis.custom_analysis_data.caller_priority}}' },
          ],
        },
        {
          t: 'json',
          label: 'Twilio → Send a Message · Body (paste verbatim)',
          json: twilioBody,
        },
      ],
    },
  ];
}

function callLoggingSetupPhase(ctx: ClientContext): Phase {
  return {
    id: 'call-logging-setup',
    group: 'onboarding',
    title: 'Map the call log (Make)',
    subtitle: ctx.isEnterprise
      ? 'Point each site’s cloned post-call scenario at its own base + number.'
      : 'Point the cloned post-call scenario at this client’s base + number.',
    steps: ctx.sites.flatMap((s) => callLoggingSetupStepsForSite(ctx, s)),
  };
}

// ── Onboarding: analytics ──────────────────────────────────────────────────────
function analyticsPhase(ctx: ClientContext): Phase {
  return {
    id: 'analytics',
    group: 'onboarding',
    title: 'Enable analytics',
    subtitle: 'Switch on Web Analytics so the portal’s Traffic tab has data.',
    steps: [
      {
        id: 'enable-web-analytics',
        title: 'Enable Web Analytics on the client’s Vercel project',
        why: 'The portal’s Traffic tab reads page views + visitors from the Vercel Web Analytics API, keyed by the user’s vercelProjectId. The exported site already renders <Analytics /> from @vercel/analytics (template root layout), so enabling Web Analytics is the only step — no GA4 property, no site tag, no service-account grant.',
        blocks: [
          {
            t: 'callout',
            tone: 'info',
            body: 'The portal account record already has vercelProjectId set (onboard.js step 10 wrote it from the client’s Vercel project). You only need to switch Web Analytics on — no command, no account edit.',
          },
          {
            t: 'substeps',
            items: [
              { text: 'Vercel → the client’s project → Analytics → Enable Web Analytics.', detail: '@vercel/analytics is already in the template root layout, so no code change or redeploy is needed — the project starts collecting once enabled.' },
              { text: 'The Traffic tab stays empty until the live site receives real visitors — visit the site once and confirm data appears within ~30s.' },
              { text: 'Verify it rather than trusting the toggle: npm run audit-analytics', detail: 'Exit 0 = every live site collecting, 1 = at least one is off (it names the project), 2 = could not check. onboard.js also reports this at the end of a run.' },
            ],
          },
          { t: 'nav', app: 'Vercel', path: ['Project', 'Analytics', 'Enable Web Analytics'] },
          { t: 'link', label: 'Open Vercel dashboard', href: 'https://vercel.com/dashboard' },
          ...(ctx.isEnterprise
            ? ([
                {
                  t: 'callout',
                  tone: 'warn',
                  body: 'Enterprise: enable Web Analytics on each site’s Vercel project. Every entry in the account record’s sites[] carries its own vercelProjectId, and each project needs Analytics switched on to light up that site’s Traffic tab.',
                } as Block,
              ])
            : []),
          { t: 'json', label: 'publicMetadata shape (onboard.js step 10 set this, including vercelProjectId)', json: clerkMetadataJson(ctx) },
        ],
      },
    ],
  };
}

// ── Review: the deployed site ───────────────────────────────────────────────────
function siteReviewPhase(ctx: ClientContext): Phase {
  const primary = ctx.sites[0];
  const proj = envVal(primary?.env.VERCEL_PROJECT_NAME, ctx.slug);
  return {
    id: 'review-site',
    group: 'review',
    title: 'Review the site',
    subtitle: 'Confirm the live build renders with real brand content.',
    steps: [
      {
        id: 'checkpoint-1',
        title: 'Checkpoint 1 — review the deployed site',
        est: '~15 min',
        why: 'Confirm the live build renders with real brand content before trusting anything else.',
        blocks: [
          {
            t: 'context',
            label: 'Vercel project',
            from: 'the ONBOARDED summary onboard.js printed (step 9), or the Vercel dashboard',
            to: 'open it in Vercel → Deployments → Production → Visit',
            value: proj.pending ? undefined : proj.value,
            example: ctx.slug,
            pending: proj.pending,
          },
          {
            t: 'substeps',
            items: [
              { text: 'Open the Vercel project (name above) → Deployments → the latest Production deploy → Visit.' },
              { text: 'Confirm the hero, services, and contact form show this client’s real copy — not “TODO” placeholders.', detail: 'Placeholders mean the intake (site.ts) still has unfilled fields.' },
              { text: 'Tab through the page on mobile width; check the nav and footer render.' },
            ],
          },
          { t: 'nav', app: 'Vercel', path: ['Project', 'Deployments', 'Production', 'Visit'] },
          { t: 'link', label: 'Open Vercel dashboard', href: 'https://vercel.com/dashboard' },
          ...(ctx.isWebOnly
            ? ([
                {
                  t: 'callout',
                  tone: 'info',
                  body: `This is a web-only client (receptionist declined) — no voice agent or Make scenario. Submit the contact form with a test message and confirm the lead email lands at ${primary?.env.LEAD_DELIVERY_MODE ? 'the brand inbox' : (primary?.brandName ?? 'the brand') + '’s inbox'} (Resend).`,
                } as Block,
              ])
            : []),
        ],
      },
    ],
  };
}

// ── Review: test-call each agent (+ routing reference last) ─────────────────────
function voiceReviewPhase(ctx: ClientContext): Phase {
  const routingStep: Step = {
    id: 'call-routing',
    title: 'How inbound calls route (human-first → AI fallback over SIP)',
    auto: true,
    why: 'onboard.js (step 8) and the site template wire this automatically — there is no manual Twilio or Retell console step for routing. Understand it before you test-call: the Retell agent only answers when the client misses the call.',
    blocks: [
      ...ctx.sites.map((s): Block => ({ t: 'diagram', kind: 'call-routing', siteSlug: s.slug })),
      {
        t: 'callout',
        tone: 'danger',
        title: 'Never import this number into Retell',
        body: 'A Retell-managed / SIP-trunked number bypasses /api/voice entirely, which kills the human-first ring — every call would go straight to the AI. The number must stay JDD/Twilio-owned with its voiceUrl pointed at /api/voice, which onboard.js sets automatically.',
      },
      {
        t: 'callout',
        tone: 'warn',
        title: 'Only works once deployed',
        body: 'Twilio has to reach /api/voice at the .vercel.app URL, so routing is dead until the repo is deployed with env synced (local dev gets no Twilio webhooks without a tunnel). To change the ring window, set CLIENT_FORWARD_RING_SECONDS in .env.local and re-sync — no code edit.',
      },
      {
        t: 'callout',
        tone: 'info',
        title: 'If the AI leg 500s after the ring',
        body: '/api/voice/no-answer needs RETELL_API_KEY and RETELL_SIP_DOMAIN at runtime to register the call and build the SIP URI. onboard.js writes both and Vercel sync pushes them — so if it fails, confirm RETELL_API_KEY actually exists on the Vercel project.',
      },
    ],
  };
  return {
    id: 'review-voice',
    group: 'review',
    title: 'Test-call the agent',
    subtitle: 'Hear each agent on a real call; the routing reference sits at the end.',
    steps: [
      ...ctx.sites.map((s, i): Step => {
        const agent = envVal(s.env.RETELL_AGENT_ID, 'agent_… (provision first)');
        const num = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
        const slugForCmd = ctx.isEnterprise ? `${ctx.slug}/site-${i + 1}` : ctx.slug;
        return {
          id: `checkpoint-2-${s.slug}`,
          site: s.slug,
          title: ctx.isEnterprise ? `Checkpoint 2 — test-call & tune (${s.brandName})` : 'Checkpoint 2 — test-call & tune the agent',
          est: '~20 min',
          why: 'Hear the greeting and qualifying flow on a real call, fix anything wrong in the prompt, and re-upload.',
          blocks: [
            { t: 'copy', label: 'Call this number', value: num.value, pending: num.pending },
            {
              t: 'substeps',
              items: [
                { text: 'To reach the AI, call the number from a phone that is NOT the client’s, and let the client’s real phone go unanswered for ~25s — only then does the agent pick up (human-first routing). Confirm the greeting names the business correctly.', detail: 'Answering the client’s phone within the ring window (CLIENT_FORWARD_RING_SECONDS, default 25s) connects a normal call and the AI never engages — see “How inbound calls route”.' },
                { text: 'Run a fake lead: ask about a service, give a name and a callback number, mention a timeline.' },
                { text: 'Note anything off — wrong hours, missing services, awkward phrasing, quoting a price (it should never quote prices).' },
                { text: `Edit the prompt at clients/${slugForCmd}/agent-prompt.txt to fix it.` },
                { text: 'Re-upload with the command below, then call again to confirm.' },
              ],
            },
            {
              t: 'context',
              label: 'Agent prompt file',
              from: `generated by onboard step 6 → clients/${slugForCmd}/agent-prompt.txt`,
              to: 'edit it, then re-upload with the command below',
              example: 'plain-text system prompt',
            },
            { t: 'cmd', command: `npm run update-prompt -- ${agent.value} --slug ${slugForCmd}`, cwd: 'jdd-ops/' },
            {
              t: 'verify',
              title: 'You should hear',
              items: [
                { text: 'A warm greeting using the exact business name.' },
                { text: 'FAQ answers drawn only from the intake — nothing invented.' },
                { text: 'Pricing deferred to the owner.', detail: 'The agent should never quote a price.' },
                { text: 'The agent collecting a name and a callback number.' },
              ],
            },
          ],
        };
      }),
      routingStep,
    ],
  };
}

// ── Review: prove post-call logging + owner SMS (per site) ──────────────────────
function callLoggingReviewStepsForSite(ctx: ClientContext, s: SiteInfo): Step[] {
  const twilio = envVal(s.env.TWILIO_NUMBER, '+1… (provision first)');
  const owner = envVal(s.env.CLIENT_FORWARD_PHONE, 'the owner number (brand.phone)');
  const ring = s.env.CLIENT_FORWARD_RING_SECONDS ?? '25';
  const label = ctx.isEnterprise ? ` (${s.brandName})` : '';
  return [
    {
      id: `checkpoint-postcall-${s.slug}`,
      site: s.slug,
      title: `Checkpoint — post-call log + owner SMS${label}`,
      est: '~15 min',
      why: 'Proves the chain: AI-handled call → Make clone → Airtable row + owner SMS.',
      blocks: [
        {
          t: 'substeps',
          items: [
            { text: `Trigger an AI-handled call: submit the form with your number, or call ${twilio.value} and let it ring past ${ring}s so the AI answers.` },
            { text: 'Finish the call and hang up.' },
            { text: `Within ~30s confirm a new Airtable Call Log row AND a brief SMS to ${owner.value}.` },
          ],
        },
        {
          t: 'verify',
          title: 'Within ~30 seconds',
          items: [
            { text: 'A new row in the client’s Airtable Call Log.' },
            { text: `A brief SMS to ${owner.value}.` },
          ],
        },
        {
          t: 'callout',
          tone: 'warn',
          title: 'If nothing arrives',
          body: `Walk it backwards: Retell call log (did the call complete?) → Make “Post-call: ${s.brandName}” History (webhook fired? filter passed? module errors?) → Twilio Messaging logs (is the number registered yet?).`,
        },
      ],
    },
  ];
}

function callLoggingReviewPhase(ctx: ClientContext): Phase {
  return {
    id: 'review-call-logging',
    group: 'review',
    title: 'Verify call logging',
    subtitle: ctx.isEnterprise
      ? 'Prove each site logs calls + texts the owner.'
      : 'Prove the chain: AI call → Airtable row + owner SMS.',
    steps: ctx.sites.flatMap((s) => callLoggingReviewStepsForSite(ctx, s)),
  };
}

/** The ordered per-client phases: all Onboarding (work) first, then all Review. */
export function buildRunbook(ctx: ClientContext, config: OpsConfig = {}): Phase[] {
  const phases: Phase[] = [];
  // ── Onboarding (do the work) ──
  phases.push(provisionPhase(ctx, config));
  if (!ctx.isWebOnly) phases.push(callLoggingSetupPhase(ctx));
  phases.push(analyticsPhase(ctx));
  // ── Review (verify + reference) ──
  phases.push(siteReviewPhase(ctx));
  if (!ctx.isWebOnly) {
    phases.push(voiceReviewPhase(ctx));
    phases.push(callLoggingReviewPhase(ctx));
  }
  return phases;
}
```

> **Removed on purpose:** the `postcall-auto-{slug}` step (and its `{ t: 'diagram', kind: 'post-call' }`
> block), the `twilio-sms-reg-{slug}` step, and the `invite-client` step. The `PostCallFlow` import in
> `BlockView.tsx` stays (still imported, now unused by onboard — harmless; do NOT remove it, other
> callers/`diagram` kinds may rely on it and removing it is out of scope).

### B4. `console/src/components/onboard/PhaseBreadcrumbs.tsx` — two-tier (macro label + sub-phase crumbs)

Replace the `return ( <nav …> … </nav> )` body (lines ~26–66) with the following. The per-phase
button and its reachability logic are unchanged; the only addition is a muted macro-group label
before the first crumb of each group, with a hairline divider between groups.

```tsx
  const activeIndex = phases.findIndex((p) => p.id === activePhaseId);
  const GROUP_LABEL: Record<'onboarding' | 'review', string> = {
    onboarding: 'Onboarding',
    review: 'Review',
  };

  return (
    <nav aria-label="Onboarding phases" className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto">
      {phases.map((phase, i) => {
        const { completed, total } = phaseProgress(phase, done);
        const complete = total > 0 && completed >= total;
        const active = phase.id === activePhaseId;
        // Jump-back: reachable if it's the active phase, any earlier phase, or one you've already
        // made progress in. Never a phase ahead of where you are.
        const reachable = i <= activeIndex || completed > 0;
        // A macro-group label is printed when the group changes (always before the first crumb).
        const groupChanged = i === 0 || phases[i - 1].group !== phase.group;

        return (
          <Fragment key={phase.id}>
            {groupChanged && phase.group ? (
              <span className="flex shrink-0 items-center gap-1">
                {i > 0 && <span className="mx-1 h-3 w-px shrink-0" style={{ background: 'var(--rule)' }} aria-hidden />}
                <span className="kicker shrink-0" style={{ color: 'var(--fg-3)' }}>{GROUP_LABEL[phase.group]}</span>
              </span>
            ) : (
              i > 0 && <CaretRight size={11} className="shrink-0 text-fg3" aria-hidden />
            )}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(phase.id)}
              aria-current={active ? 'step' : undefined}
              className="group flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors disabled:cursor-default"
              style={{
                background: active ? 'var(--surface)' : 'transparent',
                color: active ? 'var(--fg)' : reachable ? 'var(--fg-2)' : 'var(--fg-3)',
                cursor: reachable && !active ? 'pointer' : undefined,
              }}
            >
              <span
                className="flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                style={{
                  background: complete ? 'var(--accent)' : active ? 'var(--accent-glow)' : 'var(--surface-2)',
                  color: complete ? 'var(--bg-deep)' : active ? 'var(--accent)' : 'var(--fg-3)',
                  border: active && !complete ? '1px solid var(--accent)' : undefined,
                }}
              >
                {complete ? <Check size={10} weight="bold" /> : i + 1}
              </span>
              <span className="truncate">{phase.title}</span>
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
```
> Leave `OnboardStage.tsx` unchanged — `phase.title` is now the action name ("Provision the stack",
> "Map the call log (Make)", etc.), which already reads well as the stage kicker. The macro grouping
> is carried by the breadcrumb.

### B5. Onboard acceptance check (manual)
Open a Growth client's `/onboard` and confirm the breadcrumb reads:
`Onboarding  Provision the stack › Map the call log (Make) › Enable analytics   | Review  Review the site › Test-call the agent › Verify call logging`
and that:
- The Make step shows the 10-row Airtable field table (each row copyable) + a Twilio body block.
- No "Enable SMS", no "Invite the client", no "post-call (automated)" steps appear.
- `call-routing` appears as the LAST (Reference-badged) step under "Test-call the agent".
- A **web-only** client shows only `Provision the stack › Enable analytics | Review the site`
  (no Make, no voice, no call-logging).
- Progress `x/total` counts only actionable steps (the Reference step is excluded).

---

## WORKSTREAM C — RUNBOOK.md (surgical, with a flagged caveat)

> **Caveat to raise with the user before/with this edit:** `RUNBOOK.md`'s post-call sections
> (**A4**, **Part D**, **Part F**) still describe the *superseded* shared-Data-Store post-call design
> and the deprecated Make outbound clone — they already contradict `CLAUDE.md` and
> `runbook-content.ts`, independently of this change. Fully reconciling them is a larger, separate
> task and is **out of scope here** (doing it blind would be guessing). The edits below are the two
> that this change makes unambiguous. Flag the broader staleness and ask whether to schedule a
> dedicated RUNBOOK reconciliation.

### C1. Replace Part E's "Invite the client" step
Find (lines ~398–400):
```md
### E3. Invite the client
Send them the `/portal/sign-in` link (or a Clerk invitation). Confirm the three tabs render
with real data.
```
Replace with:
```md
### E3. Confirm portal sign-in (no invite step)
The portal account is created **during onboarding** — the client signs up as part of the
intake, and `onboard.js` step 10 creates/links the Clerk user automatically. There is no
separate "invite the client" action. Just confirm they can sign in at `/portal/sign-in` and
that the relevant tabs render with real data (Traffic, Performance, and — non-web-only — Calls).
```

### C2. Add the per-client post-call mapping as a Part C checkpoint
Find the end of **Part C** — the line (~256–258):
```md
- **Growth / Enterprise** → continue to Part D and Part E.
```
Immediately AFTER that line, insert:
```md

### C-checkpoint. Map the cloned post-call scenario (per Growth/Enterprise site)

> Supersedes the shared-scenario description in A4 for the per-client path: onboard.js clones the
> post-call master per client, but the clone inherits the master's module settings and must be
> pointed at this client by hand before the first real call. (A4/Part D/F are stale and pending a
> separate cleanup.)

1. Make.com → open this client's cloned scenario `Post-call: <brand>`.
2. **Airtable** module (Create a Record): set **Base** to this client's base, **Table** to `Call Log`.
   Map each field (leave `Outcome` unmapped — nothing writes it):

   | Call Log field | Expression |
   |---|---|
   | Date | `{{parseDate(1.call.start_timestamp; "x")}}` |
   | Caller name | `{{1.call.call_analysis.custom_analysis_data.caller_name}}` |
   | Caller number | `{{if(1.call.direction = "inbound"; 1.call.from_number; 1.call.to_number)}}` |
   | Summary | `{{1.call.call_analysis.call_summary}}` |
   | Duration (seconds) | `{{round(ifempty(1.call.duration_ms; 0) / 1000)}}` |
   | Call type | `{{1.call.direction}}` |
   | Email | `{{1.call.call_analysis.custom_analysis_data.caller_email}}` |
   | Address | `{{1.call.call_analysis.custom_analysis_data.caller_address}}` |
   | Recording URL | `{{1.call.recording_url}}` |
   | Priority | `{{1.call.call_analysis.custom_analysis_data.caller_priority}}` |

3. **Twilio** module (Send a Message): set From/To to this client's numbers, body:
   ```
   Name:{{1.call.call_analysis.custom_analysis_data.caller_name}}
   {{newline}}
   Status:{{1.call.call_analysis.custom_analysis_data.caller_priority}}
   {{newline}}
   Phone: {{if(1.call.direction = "inbound"; 1.call.from_number; 1.call.to_number)}}
   {{newline}}
   About: {{1.call.call_analysis.call_summary}}
   ```
4. Save and confirm the scenario is **Active**.

Enabling SMS on the number is **automatic** — onboard.js adds each local number to the A2P
Messaging Service pool and reads it back. There is no manual "enable SMS" step.
```

---

## OPEN ITEMS — stop and confirm, do not guess

1. **Twilio From vs To.** The operator note said "change the phone number to the client number."
   The master's placeholder design (see CLAUDE.md / `a-make-post-build`) is **From = client
   `TWILIO_NUMBER`, To = owner's consented alert number**. The spec text says "set the From/To to
   this client's numbers" to stay faithful without over-asserting. Before shipping, confirm the
   exact From/To wording with the user and tighten the `make-fieldmap` substep + the RUNBOOK step 3
   if they want it spelled out.

2. **Automation-vs-manual contradiction.** CLAUDE.md and `jdd-ops/lib` (`cloneAndWirePostCall` /
   `patchPostCallBlueprint`, guarded by `npm run verify-post-call`) assert onboard.js **auto-remaps**
   the clone's Airtable columns by name and sets Twilio From/To. The operator does it by hand. This
   spec follows the operator (manual step) and does **not** touch `lib/`. Surface this to the user:
   either the automation is partial/broken and should be fixed in `lib/` (then this step becomes a
   verify), or the docs/tests are stale. Decide before closing out — the console now tells the
   operator to do manually what the code claims to do automatically.

3. **Branch + RUNBOOK scope.** Confirm target branch, and confirm Workstream C should ship now
   (surgical) vs. deferring RUNBOOK entirely to a full reconciliation pass.
