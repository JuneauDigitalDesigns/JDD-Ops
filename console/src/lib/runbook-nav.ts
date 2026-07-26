// Flattening + cursor logic for the rail/stage walk.
//
// The old accordion held two pieces of local state (which phase is expanded, which step is
// open). A rail+stage model has exactly one: which step is on stage. Everything else — the
// numbering, which phase to highlight, what Back/Next/Complete do — is derived from the flat
// order, so it can't drift out of sync with itself.

import type { Phase, Step } from './runbook-content';

export interface StepNode {
  step: Step;
  phase: Phase;
  /** Position in flat order across all phases. */
  index: number;
  /**
   * 1-based number among ACTIONABLE steps, continuous across phases. 0 for reference steps —
   * they are not to-dos and numbering them implies they are.
   */
  n: number;
  actionable: boolean;
}

export function flatten(phases: Phase[]): StepNode[] {
  const out: StepNode[] = [];
  let n = 1;
  for (const phase of phases) {
    for (const step of phase.steps) {
      const actionable = !step.auto;
      out.push({ step, phase, index: out.length, n: actionable ? n++ : 0, actionable });
    }
  }
  return out;
}

/** Progress counts only actionable steps — reference steps are readable, not completable. */
export function progressOf(nodes: StepNode[], done: Set<string>) {
  const total = nodes.filter((x) => x.actionable).length;
  const completed = nodes.filter((x) => x.actionable && done.has(x.step.id)).length;
  return { total, completed, pct: total ? Math.round((completed / total) * 100) : 0 };
}

/** The step the walk should open on: the first actionable one not yet done. */
export function firstIncomplete(nodes: StepNode[], done: Set<string>): StepNode | undefined {
  return nodes.find((x) => x.actionable && !done.has(x.step.id));
}

/**
 * Where "✓ Complete" sends you: the next actionable step, skipping reference steps.
 * Distinct from plain Next, which steps through everything including references so the
 * system can be read end to end.
 */
export function nextActionable(nodes: StepNode[], from: number, done: Set<string>): StepNode | undefined {
  return nodes.slice(from + 1).find((x) => x.actionable && !done.has(x.step.id))
    ?? nodes.slice(from + 1).find((x) => x.actionable);
}

/** Phase-level counts for the rail's group headers. */
export function phaseProgress(phase: Phase, done: Set<string>) {
  const steps = phase.steps.filter((s) => !s.auto);
  return { total: steps.length, completed: steps.filter((s) => done.has(s.id)).length };
}

/**
 * Group a phase's steps into consecutive runs sharing a site, so the rail can print one
 * sub-header per site instead of repeating the brand in every row. Steps without a `site`
 * form their own unlabelled group.
 */
export function groupBySite(nodes: StepNode[]): Array<{ site?: string; nodes: StepNode[] }> {
  const groups: Array<{ site?: string; nodes: StepNode[] }> = [];
  for (const node of nodes) {
    const site = node.step.site;
    const last = groups[groups.length - 1];
    if (last && last.site === site) last.nodes.push(node);
    else groups.push({ site, nodes: [node] });
  }
  return groups;
}
