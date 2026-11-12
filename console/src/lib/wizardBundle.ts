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
 * Which saved copy an EXPORTED client opens with, or null for "the repo's content" (Xander
 * 2026-11-12: "those photos are not making it from the intake wizard into the studio").
 *
 * An exported client used to open from the repo every time, with `edits: {}`, and the server draft
 * was never read. But a successful export deletes clients/{slug}/.draft.json (export route), so a
 * server draft that exists is work done since the last export, or the work of an export that
 * failed: the only copy of it. `_e2e_test_growth` lost every intake edit that way, its uploaded
 * photos included: four staged in console/.uploads at 21:35 and 21:39, an export at 22:13 that
 * failed (its repo site.ts is still the template's), and a reload that opened the repo.
 *
 * So a server draft wins (the newer of it and this browser's copy). With none, the repo wins as
 * before: a copy in this browser alone may be from before the export, and must not present itself
 * as the live site.
 */
export function exportedClientDraft<T extends Stamped>(local: T | null | undefined, server: T | null | undefined): T | null {
  if (!server) return null;
  return newerBundle(local, server);
}
