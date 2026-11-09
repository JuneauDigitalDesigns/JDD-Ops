// The client roster's count line. No imports: tests load it directly.

/**
 * "3 clients", "2 of 3", plus how many test clients the roster is hiding.
 *
 * The test client is hidden by a per-browser toggle (localStorage `console:fixtures`). A browser
 * that has never set it — an Incognito window, a new profile — saw one unfamiliar client and a
 * count that claimed it was everything, and read that as a different, "test" console. Same
 * server, same clients/ folder: only the filter differed, and the page never said so.
 */
export function rosterCountLabel(shown: number, total: number, hiddenTest = 0): string {
  const base = shown === total ? `${total} client${total === 1 ? '' : 's'}` : `${shown} of ${total}`;
  if (hiddenTest <= 0) return base;
  return `${base} · ${hiddenTest} test client${hiddenTest === 1 ? '' : 's'} hidden`;
}
