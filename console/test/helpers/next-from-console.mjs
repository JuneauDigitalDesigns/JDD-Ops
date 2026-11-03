/**
 * Resolve `next/*` from the console's own install, for tests that import route code living
 * OUTSIDE the console (jdd-ops/lib/site-routes/*.ts, written verbatim into client repos).
 *
 * Those files import `next/server`, but the ops root has no `next` dependency, so a plain import
 * from there fails in CI. Pointing the resolution at the console's `next` runs the route against
 * the REAL NextResponse rather than a stand-in.
 */
const CONSOLE_PKG = new URL('../../package.json', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'next' || specifier.startsWith('next/')) {
    return next(specifier, { ...context, parentURL: CONSOLE_PKG });
  }
  return next(specifier, context);
}
