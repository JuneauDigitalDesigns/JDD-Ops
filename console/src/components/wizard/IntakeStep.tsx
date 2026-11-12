'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { VERTICALS, presetFor, type VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS, parseVerdictKey, type Section, type VerdictKey } from '@/lib/copy-schema';
import { buildReviewGroups, reviewKeys, rewrittenPageKeys, rewrittenTownKeys, townCopyBehind, type ReviewPage } from '@/lib/copy-review-groups';
import { copyPages } from '@/lib/copy-brief/run-sections';
import { labelFor } from '@/lib/section-labels';
import { resolveBrief } from '@/lib/copy-brief/resolve';
import { sourceOf, isSupplied, type SourceContext } from '@/lib/intake-sources';
import { intakeTodo, attentionByStep, servicePageHint, realReviews, BUSINESS_GROUPS } from '@/lib/intake-todo';
import { SERVICE_GATE } from '@/lib/service-gate';
import { copyRisks, intakeServicePicks } from '@/lib/copyRisks';
import type { ReviewDraft } from '@/lib/review-draft';
import type { SaveStatus } from '@/lib/autosave';
import { setTickedSections } from '@/lib/copy-brief/mutations';
import { migrateStepId, landingStepId } from '@/lib/intake-steps';
import IntakeShell from './brief/IntakeShell';
import type { SectionVerdict } from './CopyWireframe';

/** The Intake's position is now a single step id (see lib/intake-steps.ts). Kept as a plain
 *  string because the persisted bundle can hold a legacy value that migrateStepId resolves. */
export type IntakeStageId = string;

/**
 * The Intake step: resolve the brief, own the copy-review gate, delegate the rest.
 *
 * This file used to render a header bar of its own — Brief/Prompt/Review pills, a vertical
 * picker, a JSON button, Back/Next and Approve — on top of whichever sub-stage was active.
 * All of it is gone. The three sub-stages were flattened into one eight-step sequence
 * (lib/intake-steps.ts), and IntakeShell renders that sequence including Prompt and Review,
 * which are now steps rather than modes. The vertical picker and JSON hatch moved into the
 * Client intake step, and Approve into the Review step's sticky rail.
 *
 * What's left here is the state that spans steps and must not be duplicated: the resolved
 * blocks, the pre-run snapshot that makes per-section Revert possible, and the gate.
 */
export default function IntakeStep({
  stage,
  onStageChange,
  vertical,
  onVerticalChange,
  effective,
  setField,
  generated,
  onGenerated,
  onClearGenerated,
  onSetGeneratedSection,
  onReplaceContent,
  imported,
  onDone,
  brief,
  onBriefChange,
  copyModel,
  onCopyModelChange,
  pages,
  edits,
  reviewDraft,
  onReviewDraftChange,
  saveStatus,
  onRetrySave,
}: {
  stage: IntakeStageId;
  onStageChange: (s: IntakeStageId) => void;
  vertical: VerticalId;
  onVerticalChange: (v: VerticalId) => void;
  effective: SiteContent;
  setField: (path: string, value: unknown) => void;
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  onSetGeneratedSection: (section: string, value: unknown) => void;
  onReplaceContent: (site: SiteContent) => void;
  imported: SiteContent | null;
  onDone: () => void;
  brief: CopyBrief;
  onBriefChange: (mutate: (brief: CopyBrief) => CopyBrief) => void;
  copyModel: string;
  onCopyModelChange: (m: string) => void;
  /** The site's non-home pages (from the live composition) — drives the per-page review groups
   *  and, with them, the gate. Empty for a single-page site. */
  pages: ReviewPage[];
  /** The operator's edits by path: an edited value's source is Console (lib/intake-sources.ts). */
  edits: Record<string, unknown>;
  /** A review being typed, kept in the wizard's saved bundle (autosave). */
  reviewDraft: ReviewDraft | null;
  onReviewDraftChange: (d: ReviewDraft | null) => void;
  /** The wizard's save status, shown in the intake (autosave). */
  saveStatus: SaveStatus;
  onRetrySave: () => void;
}) {

  // Only the six built-in verticals are visible client-side today — a custom/overridden
  // vertical (console/.state/verticals.json, resolved server-side by
  // lib/verticals-registry.ts) doesn't reach the browser bundle yet.
  const verticalDef = useMemo(
    () => BUILT_IN_VERTICALS.find((v) => v.id === vertical) ?? BUILT_IN_VERTICALS[0],
    [vertical],
  );

  // undefined (the key was never set) defaults to every section; an explicit [] (the operator
  // deselected everything via "None") must stay empty. Checking `.length` instead of
  // `=== undefined` conflated the two, so unticking the last section snapped back to all.
  const tickedSections = useMemo(
    () => (brief.tickedSections === undefined ? ALL_SECTIONS.filter((s) => s !== 'brand') : (brief.tickedSections as Section[])),
    [brief.tickedSections],
  );
  const tickedKeys = useMemo<VerdictKey[]>(
    () => (brief.tickedSections === undefined ? ALL_SECTIONS.filter((s) => s !== 'brand') : brief.tickedSections),
    [brief.tickedSections],
  );

  // `subpages` is the page list the run sends, so the brief on screen carries the same page-header
  // instruction and page list that generate-copy compiles (copy-brief/run-sections.ts).
  const blocks = useMemo(
    () => resolveBrief({ vertical: verticalDef, effective, imported, preset: presetFor(vertical), edits, brief, tickedSections, subpages: copyPages(pages) }),
    [verticalDef, effective, imported, vertical, edits, brief, tickedSections, pages],
  );

  /** Where each value came from: the form, the close, the console, or nowhere yet. */
  const sources = useMemo<SourceContext>(
    () => ({ effective, imported, preset: presetFor(vertical), edits }),
    [effective, imported, vertical, edits],
  );

  /**
   * Where the Intake opens, once per mount: Still to do if the intake has run (Approve stamped
   * `brief.lastRunAt`), else the saved step with legacy ids migrated (lib/intake-steps.ts). Here
   * rather than in BuildWizard because BuildWizard has no reason to know the step registry.
   */
  useEffect(() => {
    const resolved = landingStepId(stage, brief.lastRunAt);
    if (resolved !== stage) onStageChange(resolved);
    // Mount only — a later `stage` is always a real id written by the shell.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot `generated` the instant before a run's results land, so the Review step's
  // per-section Revert has an exact pre-run value to restore — `generated` (the prop) is still
  // the old value at the moment this fires, since onGenerated is what causes it to change.
  const [preRunGenerated, setPreRunGenerated] = useState<Partial<SiteContent> | null>(null);
  const handleGenerated = useCallback((p: Partial<SiteContent>) => {
    setPreRunGenerated(generated);
    onGenerated(p);
    // Each page whose header the run rewrote waits for review on its own page, like a home section.
    // So does each town page and town + service page whose copy the run rewrote.
    const pageKeys = [
      ...rewrittenPageKeys(generated, p),
      ...rewrittenTownKeys(generated, p),
    ];
    if (pageKeys.length) {
      onBriefChange((b) => setTickedSections(b, [...new Set([...(b.tickedSections ?? tickedKeys), ...pageKeys])]));
    }
  }, [generated, onGenerated, onBriefChange, tickedKeys]);

  const verdictFor = useCallback((key: VerdictKey): SectionVerdict => {
    // The revert machinery keys off the generated overlay's TOP-LEVEL section key (what
    // onSetGeneratedSection writes); the route only distinguishes which review row this is.
    const { section: keySection } = parseVerdictKey(key);
    // Both town sections are written into the overlay's `areaCopy` (@jdd/schema v1.34.0, lib/townPages.ts).
    const section = keySection === 'townPages' || keySection === 'townServicePages' ? 'areaCopy' : keySection;
    const ticked = tickedKeys.includes(key);
    const priorValue = preRunGenerated ? (preRunGenerated as Record<string, unknown>)[section] : undefined;
    const currentValue = generated ? (generated as Record<string, unknown>)[section] : undefined;
    return {
      ticked,
      canRevert: priorValue !== undefined || currentValue !== undefined,
      onAccept: () => onBriefChange((b) => setTickedSections(b, tickedKeys.filter((k) => k !== key))),
      onReroll: () => {
        if (!ticked) onBriefChange((b) => setTickedSections(b, [...tickedKeys, key]));
        onStageChange('prompt');
      },
      onRevert: () => onSetGeneratedSection(section, priorValue),
      // Regenerated parts (lib/review-parts.ts): snapshot for Revert, write them, and the section
      // waits for review again, exactly as after a whole-section run (the gate is unchanged).
      onApplyParts: (w: { sections: Record<string, unknown>; edits: Record<string, unknown> }) => {
        setPreRunGenerated(generated);
        for (const [top, value] of Object.entries(w.sections)) onSetGeneratedSection(top, value);
        for (const [p, value] of Object.entries(w.edits)) setField(p, value);
        onBriefChange((b) => setTickedSections(b, [...new Set([...tickedKeys, key])]));
      },
    };
  }, [tickedKeys, preRunGenerated, generated, onBriefChange, onStageChange, onSetGeneratedSection, setField]);

  // ── The copy-review gate (a HARD block) ───────────────────────────────────────────────
  // A key is "unreviewed" when it has model-generated copy behind it AND is still ticked
  // (ticked = queued for regeneration = not yet approved; Accept is what removes it). Leaving
  // the Intake is blocked while any key is unreviewed, so a model's prose only reaches a client
  // site after an operator has actually read it. The counts shown in the Review step use this
  // exact set, so the UI and the gate never disagree.
  const reviewGroups = useMemo(() => buildReviewGroups(pages), [pages]);
  const allKeys = useMemo(() => reviewKeys(reviewGroups), [reviewGroups]);
  const hasGeneratedBehind = useCallback((key: VerdictKey): boolean => {
    if (!generated) return false;
    const { route, section } = parseVerdictKey(key);
    // A per-route page header's generated copy lives in the route-keyed subpages overlay;
    // every other key reads the overlay's top-level section key.
    if (route && section === 'subpages') {
      const map = (generated as { subpages?: Record<string, unknown> }).subpages;
      return Boolean(map && map[route] !== undefined);
    }
    // A town page's copy lives in the town-keyed areaCopy overlay.
    const town = townCopyBehind(key, generated);
    if (town !== undefined) return town;
    return (generated as Record<string, unknown>)[section] !== undefined;
  }, [generated]);
  const unreviewed = useMemo<VerdictKey[]>(
    () => allKeys.filter((k) => hasGeneratedBehind(k) && tickedKeys.includes(k)),
    [allKeys, hasGeneratedBehind, tickedKeys],
  );
  const unreviewedSet = useMemo(() => new Set(unreviewed), [unreviewed]);

  const approve = useCallback(() => {
    if (unreviewed.length > 0) return; // the hard block — mirrors the disabled button
    onBriefChange((b) => ({ ...b, lastRunAt: new Date().toISOString() }));
    onDone();
  }, [unreviewed.length, onBriefChange, onDone]);

  // A short, human reason for the gate: first few unreviewed sections, by page.
  const unreviewedLabel = useCallback((key: VerdictKey): string => {
    const { route, section } = parseVerdictKey(key);
    const page = route ? (pages.find((p) => p.route === route)?.label ?? route) : 'Home';
    return `${page} · ${labelFor(section)}`;
  }, [pages]);
  const gateReason = unreviewed.length === 0
    ? undefined
    : `${unreviewed.length} section${unreviewed.length === 1 ? '' : 's'} still need review: ${unreviewed.slice(0, 3).map(unreviewedLabel).join(', ')}${unreviewed.length > 3 ? '…' : ''}`;

  const clientPickedVertical = useMemo((): VerticalId | null => {
    const industry = imported?._meta.industry?.trim().toLowerCase();
    if (!industry) return null;
    return VERTICALS.find((v) => v.id === industry || v.label.toLowerCase() === industry)?.id ?? null;
  }, [imported]);

  // Still to do, the rail's counts and the summary's figures: one list, so they never disagree.
  const todo = useMemo(
    () => intakeTodo(SERVICE_GATE, { ...sources, unreviewed: unreviewed.map(unreviewedLabel) }),
    [sources, unreviewed, unreviewedLabel],
  );
  // SEO plan D2 (Xander, 2026-11-10): preset sample copy and claims the facts don't support,
  // warned about loudly on Still to do. client-seo's detector; a warning, never a block.
  // The service names and tags the intake picked are the client's choice, not sample copy.
  const servicePicks = useMemo(() => intakeServicePicks(imported, edits), [imported, edits]);
  const risks = useMemo(() => copyRisks(effective, presetFor(vertical), servicePicks), [effective, vertical, servicePicks]);
  const counts = useMemo(() => {
    const by = attentionByStep(todo);
    const total = Object.values(by).reduce((a, b) => a + b, 0);
    return { ...by, todo: total } as Record<string, number>;
  }, [todo]);
  const stats = useMemo(() => {
    const fields = BUSINESS_GROUPS.flatMap((g) => g.fields);
    const facts = fields.filter((f) => isSupplied(sourceOf(sources, f.path))).length;
    const services = effective.services?.items ?? [];
    const own = services.filter((_, i) => servicePageHint(SERVICE_GATE, effective, i).page).length;
    const reviews = realReviews(effective).length;
    return [
      { value: `${facts} / ${fields.length}`, label: 'Business facts' },
      { value: `${own} / ${services.length}`, label: 'Services with their own page' },
      { value: String(reviews), label: reviews ? 'Real reviews' : 'Real reviews · section hidden' },
      generated
        ? (unreviewed.length
          ? { value: String(unreviewed.length), label: 'Sections to review' }
          : { value: 'All', label: 'Sections reviewed', ok: true })
        : { value: '—', label: 'No copy generated yet' },
    ];
  }, [sources, effective, generated, unreviewed.length]);

  return (
    <IntakeShell
      activeId={migrateStepId(stage)}
      onSelect={onStageChange}
      blocks={blocks}
      content={effective}
      setField={setField}
      onUpdate={onBriefChange}
      sources={sources}
      todo={todo}
      counts={counts}
      stats={stats}
      risks={risks}
      reviewDraft={reviewDraft}
      onReviewDraftChange={onReviewDraftChange}
      saveStatus={saveStatus}
      onRetrySave={onRetrySave}
      vertical={vertical}
      onVerticalChange={onVerticalChange}
      clientPickedVertical={clientPickedVertical}
      onReplaceContent={onReplaceContent}
      brief={brief}
      verticalDef={verticalDef}
      imported={imported}
      tickedSections={tickedSections}
      copyModel={copyModel}
      onCopyModelChange={onCopyModelChange}
      onGenerated={handleGenerated}
      onClearGenerated={onClearGenerated}
      hasGenerated={Boolean(generated)}
      generated={generated}
      verdictFor={verdictFor}
      pages={pages}
      unreviewed={unreviewedSet}
      gateReason={gateReason}
      onApprove={approve}
    />
  );
}
