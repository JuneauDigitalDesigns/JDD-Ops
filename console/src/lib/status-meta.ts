// One source for how a ClientStatus is named and coloured.
//
// These maps were previously re-typed in ClientBoard.tsx and StatusControl.tsx. Two copies of a
// label map is how "Wire callback" ends up meaning something subtly different in two places.

import type { ClientStatus } from './types';

export const STATUS_LABEL: Record<ClientStatus, string> = {
  'needs-build': 'Needs build',
  ready: 'Ready to provision',
  provisioned: 'Wire callback',
  'portal-pending': 'Portal + checkpoints',
  live: 'Live',
  unknown: 'Unknown',
};

/** Short forms for the Kanban column headers, where a 240px column can't hold the full label. */
export const STATUS_SHORT: Record<ClientStatus, string> = {
  'needs-build': 'Needs build',
  ready: 'Ready',
  provisioned: 'Wire callback',
  'portal-pending': 'Portal',
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

/** The next action implied by each stage — what you'd do to move a client out of the column. */
export const STATUS_NEXT: Record<ClientStatus, string> = {
  'needs-build': '→ Build',
  ready: '→ Provision',
  provisioned: '→ Wire callback',
  'portal-pending': '→ Finish portal',
  live: 'Live',
  unknown: '',
};
