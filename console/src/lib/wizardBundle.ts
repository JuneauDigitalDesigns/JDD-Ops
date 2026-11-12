// Which saved copy of a client's studio work to open with. No imports: tests load it directly.

/** A wizard bundle carries the time it was saved; bundles saved before this field have none. */
export type Stamped = { savedAt?: number };

/**
 * The newer of this browser's bundle and the server draft.
 *
 * The bundle is saved twice on every change: to this browser's localStorage, and (debounced) to
 * clients/{slug}/.draft.json. Hydration used to prefer localStorage outright, so a browser
 * holding an OLDER copy (another window, another profile, last week's session) opened with its
 * old template and then saved that over the newer server draft. The template picked elsewhere
 * was gone, with nothing on screen to say it had ever existed.
 *
 * Ties and unstamped bundles keep the old preference for this browser's copy.
 */
export function newerBundle<T extends Stamped>(local: T | null | undefined, server: T | null | undefined): T | null {
  if (!local) return server ?? null;
  if (!server) return local;
  return (server.savedAt ?? 0) > (local.savedAt ?? 0) ? server : local;
}

/**
 * Which copy of a client's work opens: a saved draft, the client's repo, or a fresh start.
 *
 * A client with a repo the studio can read back used to open from the repo on every load ("disk
 * wins"), with the edit and generated layers emptied. That was meant for a client exported from
 * the console, so a stale browser copy could never pose as the live site. But onboard.js gives
 * every client a repo whose page.tsx reads back, so the rule fired for clients nobody had exported
 * from the console, and every reload threw away the intake's typed facts (edits) and the copy run
 * (generated), both already saved (Xander, 2026-11-12: "the business facts are not being saved on
 * a reload. And copy generation is also not being saved if you get to the studio step and you
 * haven't exported the project yet").
 *
 * So the repo wins only over work saved BEFORE it was last written (`exportedAt`, the time the
 * console's export or onboard.js last wrote it). A draft saved after that is newer work and opens
 * as saved. An unstamped draft can't show it is newer, and an unknown repo time keeps the repo.
 */
export function startingBundle<T extends Stamped>(o: {
  saved: T | null | undefined;
  server: T | null | undefined;
  /** The client has a repo the studio reads back (a manifest or a parseable home page). */
  exported: boolean;
  /** Epoch ms the repo was last written, or null when unknown. */
  exportedAt: number | null;
}): { from: 'draft' | 'disk' | 'fresh'; bundle: T | null } {
  const draft = newerBundle(o.saved, o.server);
  if (o.exported) {
    const newer = draft && o.exportedAt !== null && (draft.savedAt ?? 0) > o.exportedAt;
    return newer ? { from: 'draft', bundle: draft } : { from: 'disk', bundle: null };
  }
  return draft ? { from: 'draft', bundle: draft } : { from: 'fresh', bundle: null };
}
