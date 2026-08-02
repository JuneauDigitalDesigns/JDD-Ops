'use client';

export { ToolBarSlot as default } from './shell/slots';

/**
 * `NavSlot` is now an alias for <ToolBarSlot>.
 *
 * It used to portal a route's chrome into the console BAR (#console-nav-slot), which is how
 * the bar ended up carrying wizard step pills, undo/redo, Back, Next and Deploy alongside
 * app and client identity. Those are actions, not wayfinding, so the target moved down to
 * the per-tool strip — see <ToolBar>.
 *
 * Kept as a re-export rather than deleted so the four call sites read naturally: a route
 * still says "put my chrome in the slot" and doesn't need to care which strip that is.
 */
