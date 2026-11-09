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
