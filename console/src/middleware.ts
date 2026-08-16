import { NextResponse, type NextRequest } from 'next/server';

/**
 * Refuse every mutating API request that did not come from this machine.
 *
 * The console has no authentication of any kind and is never deployed. That is a deliberate
 * choice — it holds master credentials for six vendors and can tear a client's whole estate
 * down — but it means "runs on localhost" is the entire security model, and until now that
 * was enforced by a hand-copied `isLoopback()` in three route files out of twenty-six.
 *
 * The other twenty-three included `teardown`, `env` (which writes secrets), and
 * `plan/downgrade/execute` (which cancels infrastructure). A single `next start -H 0.0.0.0`,
 * a misconfigured tunnel, or an over-helpful dev-server flag would have exposed all of them.
 *
 * Doing it here rather than per-route is the point: a route added next month is covered
 * because it exists, not because someone remembered. The per-route checks stay where they
 * are — defence in depth costs nothing, and they return friendlier errors.
 *
 * GET is deliberately left alone. Reads are what the roster, the client shell and every
 * section render from, and gating them would break the app's own server components without
 * protecting anything that isn't already protected by the writes being blocked.
 */

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * `Host` is what the browser asked for, which is what we want: it tells us the request was
 * addressed to this machine as localhost rather than routed in from elsewhere. Deliberately
 * NOT `x-forwarded-for` — that is attacker-controlled, and trusting it would invert the
 * check on the exact request we most want to reject.
 */
function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  const lower = host.toLowerCase();
  // Bracketed IPv6 literal, e.g. [::1]:3040
  const hostname = lower.startsWith('[') ? lower.slice(0, lower.indexOf(']') + 1) : lower.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}

export function middleware(req: NextRequest) {
  if (!MUTATING.has(req.method)) return NextResponse.next();
  if (isLoopbackHost(req.headers.get('host'))) return NextResponse.next();

  return NextResponse.json(
    {
      error:
        'The JDD console accepts writes from localhost only. It has no authentication and ' +
        'holds master credentials, so it must not be reachable from anywhere else.',
    },
    { status: 403 },
  );
}

export const config = {
  matcher: '/api/:path*',
};
