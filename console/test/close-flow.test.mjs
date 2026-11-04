// The pure guards around "close a client on a sales call".
//
// The resume step and the readiness lights are tested once, in @jdd/schema, where they live —
// the wizard, the roster and the agency all import that single implementation. What lives here
// are the two rules the console applies on its own before it ever calls the agency.
//
// Run: npm test   (node's built-in runner, via tsx for the .ts imports)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSiteId } from '../src/lib/siteId.ts';
import { isLoopback } from '../src/lib/loopback.ts';

test('checkSiteId: an underscore is refused', () => {
  // Vercel REMOVES characters that aren't valid in a DNS label, so `rivera_plumbing` serves at
  // `riveraplumbing.vercel.app`. Three call sites once derived the host with `_ → -` and pointed
  // a client's voiceUrl at a hostname that does not resolve. A Site ID chosen on a call is locked
  // for good, so it must never be able to carry one.
  assert.ok(checkSiteId('rivera_plumbing'));
  assert.ok(checkSiteId('Rivera-Plumbing'));
  assert.ok(checkSiteId('rivera--plumbing'));
  assert.ok(checkSiteId('-rivera'));
  assert.ok(checkSiteId(''));
  assert.equal(checkSiteId('rivera-plumbing'), null);
  assert.equal(checkSiteId('rivera2'), null);
});

test('isLoopback: only this machine may drive the close routes', () => {
  // The console has no auth; these routes open payment links and create accounts through the
  // agency. A request addressed to any other host is refused even though the server only binds
  // locally — an assumption isn't a control.
  const req = (host) => new Request('http://x/api/sales/orders', { headers: { host } });
  for (const host of ['localhost:3040', '127.0.0.1:3040', '[::1]:3040', 'console.localhost']) {
    assert.equal(isLoopback(req(host)), true, host);
  }
  for (const host of ['juneaudigitaldesigns.com', 'localhost.evil.com', '10.0.0.5:3040', '']) {
    assert.equal(isLoopback(req(host)), false, host);
  }
});

// ── No client without payment ──────────────────────────────────────────────
//
// Xander, 2026-11-03: the manual "Convert to Client" made a client from a lead with no payment
// taken and no onboarding steps sent — "a gap, not a feature". A lead now becomes a client only
// through the close wizard once payment clears (or the Leads sweep for a client who paid later
// from their link). These read the source tree: the routes and lib are server-only and cannot be
// imported outside Next, and what matters is that no path exists at all.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|mjs|js)$/.test(name) ? [path] : [];
  });
}
const rel = (p) => relative(SRC, p).split(sep).join('/');

test('the unpaid convert endpoint is gone', () => {
  assert.equal(existsSync(join(SRC, 'app/api/leads/convert/route.ts')), false);
  assert.equal(existsSync(join(SRC, 'components/leads/ConvertDialog.tsx')), false);
});

test('no UI or route reaches a convert endpoint except the paid close', () => {
  const callers = sourceFiles(SRC)
    .filter((f) => /\/api\/leads\/convert|Convert to Client|ConvertDialog/.test(readFileSync(f, 'utf8')))
    .map(rel);
  assert.deepEqual(callers, []);
});

test('only the paid close and the existing-client reconcile may call convertLead', () => {
  // closeConvert: the wizard's Setup step and the Leads sweep, both after payment.
  // leadConversion: defines it, and reconcileWon marks a lead won when a client folder already
  // exists (a client who bought self-serve) — it never creates a client.
  const callers = sourceFiles(SRC)
    .filter((f) => /\bconvertLead\(/.test(readFileSync(f, 'utf8')))
    .map(rel)
    .sort();
  assert.deepEqual(callers, ['lib/closeConvert.ts', 'lib/leadConversion.ts']);
  assert.match(
    readFileSync(join(SRC, 'lib/closeConvert.ts'), 'utf8'),
    /if \(!isOrderPaid\(order\.status\)\)/,
    'convertPaidOrder must refuse an order that is not paid',
  );
});
