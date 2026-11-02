'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BUILT_IN_VERTICALS } from '@jdd/schema';
import type { CopyBrief } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import { VERTICALS, type VerticalId } from '@/lib/verticals';
import { ALL_SECTIONS, parseVerdictKey, type Section, type VerdictKey } from '@/lib/copy-schema';
import { buildReviewGroups, reviewKeys, type ReviewPage } from '@/lib/copy-review-groups';
import { labelFor } from '@/lib/section-labels';
import { missingFields as getMissingFields } from '@/lib/flags';
import { resolveBrief } from '@/lib/copy-brief/resolve';
import { intakeFactPaths } from '@/lib/copy-brief/attention';
import { setTickedSections } from '@/lib/copy-brief/mutations';
import { migrateStepId } from '@/lib/intake-steps';
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
}) {
  const missing = getMissingFields(effective._meta);

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

  const blocks = useMemo(
    () => resolveBrief({ vertical: verticalDef, effective, imported, brief, tickedSections }),
    [verticalDef, effective, imported, brief, tickedSections],
  );

  /** Which fact paths the client's own intake supplied, for the Client intake step's source
   *  chips. Computed once here rather than per-field inside the editor. */
  const intakePaths = useMemo(() => intakeFactPaths(imported), [imported]);

  /**
   * Resolve a legacy persisted position to a real step id, once on mount.
   *
   * Bundles saved before this rebuild hold 'brief' | 'prompt' | 'review'. The migration lives
   * here rather than in BuildWizard because BuildWizard has no reason to know the step
   * registry, and duplicating the sequence in two files is how the two drift apart.
   */
  useEffect(() => {
    const resolved = migrateStepId(stage);
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
  }, [generated, onGenerated]);

  const verdictFor = useCallback((key: VerdictKey): SectionVerdict => {
    // The revert machinery keys off the generated overlay's TOP-LEVEL section key (what
    // onSetGeneratedSection writes); the route only distinguishes which review row this is.
    const { section } = parseVerdictKey(key);
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
    };
  }, [tickedKeys, preRunGenerated, generated, onBriefChange, onStageChange, onSetGeneratedSection]);

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

  return (
    <IntakeShell
      activeId={migrateStepId(stage)}
      onSelect={onStageChange}
      blocks={blocks}
      content={effective}
      setField={setField}
      missingFields={missing}
      onUpdate={onBriefChange}
      intakePaths={intakePaths}
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
      verdictFor={verdictFor}
      pages={pages}
      unreviewed={unreviewedSet}
      gateReason={gateReason}
      onApprove={approve}
    />
  );
}
