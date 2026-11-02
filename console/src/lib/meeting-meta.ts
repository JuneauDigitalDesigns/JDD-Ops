// One source for how a MeetingKind / MeetingStatus is named and coloured.
//
// Same shape and same reasoning as lead-meta.ts: these maps are imported by the grid, the bar,
// the form and the modal, and two copies of a label map is how a value ends up meaning something
// subtly different in two places.
//
// No JSX here — this module is a plain lib imported by several components, so the Phosphor icon
// COMPONENTS stay in the components (see KIND_ICON_NAME for the mapping the components resolve),
// exactly as lead-meta keeps its source icons out.

import type { MeetingKind, MeetingStatus } from './meetingTypes';

export const KIND_LABEL: Record<MeetingKind, string> = {
  call: 'Phone call',
  video: 'Video meeting',
};

/** Bar stripe + icon colour. Call is the house teal; video is the green used for 'won'/'ok'. */
export const KIND_COLOR: Record<MeetingKind, string> = {
  call: 'var(--accent)',
  video: 'var(--ok)',
};

/** Which Phosphor icon each kind resolves to in the components. */
export const KIND_ICON_NAME: Record<MeetingKind, 'Phone' | 'VideoCamera'> = {
  call: 'Phone',
  video: 'VideoCamera',
};

export const STATUS_LABEL: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  done: 'Done',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
};

/**
 * How each status changes a bar's appearance. `scheduled` is the full-colour default; the rest
 * read as history or trouble:
 *   done      → dimmed, it happened and is behind you
 *   cancelled → dimmed + struck through
 *   no-show   → danger-tinted stripe (overridden in the bar), the one that wants attention
 */
export const STATUS_DIM: Record<MeetingStatus, number> = {
  scheduled: 1,
  done: 0.5,
  cancelled: 0.6,
  'no-show': 1,
};

export const STATUS_STRIKE: Record<MeetingStatus, boolean> = {
  scheduled: false,
  done: false,
  cancelled: true,
  'no-show': false,
};
