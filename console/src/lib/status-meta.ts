// One source for how a ClientStatus is named and coloured.
//
// These maps were previously re-typed in the onboarding Kanban and StatusControl.tsx. Two copies
// of a label map is how "Wire callback" ends up meaning something subtly different in two places.
//
// Trimmed when the onboarding board was replaced by the leads funnel at /leads: STATUS_SHORT
// existed only for that board's narrow column headers, and STATUS_NEXT had already lost its last
// consumer before then. What's left is what the client index and StatusControl actually read.

import type { ClientStatus } from './types';

export const STATUS_LABEL: Record<ClientStatus, string> = {
  'needs-build': 'Needs build',
  ready: 'Ready to provision',
  provisioned: 'Wire callback',
  'portal-pending': 'Portal + checkpoints',
  live: 'Live',
  unknown: 'Unknown',
};

export const STATUS_COLOR: Record<ClientStatus, string> = {
  'needs-build': 'var(--warn)',
  ready: 'var(--accent)',
  provisioned: 'var(--accent)',
  'portal-pending': 'var(--ok)',
  live: 'var(--ok)',
  unknown: 'var(--fg-3)',
};
