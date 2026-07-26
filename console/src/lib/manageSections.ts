import type { Plan } from './types';

/**
 * The /manage rail. One source of truth for three consumers: the rail itself, the
 * [section] route validator, and the plan gate that decides whether a section exists
 * for a given client.
 *
 * Deliberately pure data — no JSX and no icon components — so a server component can
 * import it and hand the result to a client component without a serialization boundary
 * problem. ManageRail maps `icon` to a Phosphor component on its side.
 */

export type SectionId = 'overview' | 'environment' | 'deployments' | 'voice-agent' | 'portal';

export interface ManageSection {
  id: SectionId;
  label: string;
  /** One line under the section title. */
  lede: string;
  /** Key into ManageRail's icon map. */
  icon: 'gauge' | 'sliders' | 'rocket' | 'microphone' | 'portal';
  /** Which plans get this section. */
  plans: Plan[];
}

const ALL: Plan[] = ['starter', 'growth', 'enterprise'];
/** Starter clients have no voice agent, no Twilio number, and no Retell prompt. */
const VOICE: Plan[] = ['growth', 'enterprise'];

export const MANAGE_SECTIONS: ManageSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    lede: 'Health, recent activity, and the things worth acting on.',
    icon: 'gauge',
    plans: ALL,
  },
  {
    id: 'environment',
    label: 'Environment',
    lede: 'Edit this site’s env vars, then push them to Vercel.',
    icon: 'sliders',
    plans: ALL,
  },
  {
    id: 'deployments',
    label: 'Deployments',
    lede: 'Recent builds, and a redeploy when env changes need to take effect.',
    icon: 'rocket',
    plans: ALL,
  },
  {
    id: 'voice-agent',
    label: 'Voice agent',
    lede: 'The prompt the Retell agent answers with.',
    icon: 'microphone',
    plans: VOICE,
  },
  {
    id: 'portal',
    label: 'Portal',
    lede: 'Which account this client signs into the portal with.',
    icon: 'portal',
    plans: ALL,
  },
];

export function sectionsForPlan(plan: Plan): ManageSection[] {
  return MANAGE_SECTIONS.filter((s) => s.plans.includes(plan));
}

/** Resolve a URL segment to a section this client actually has. */
export function findSection(plan: Plan, id: string): ManageSection | undefined {
  return sectionsForPlan(plan).find((s) => s.id === id);
}

export const DEFAULT_SECTION: SectionId = 'overview';
