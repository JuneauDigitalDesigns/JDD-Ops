/**
 * Attaching a domain puts it on the site's lead-form Turnstile widget FIRST (operator decision,
 * 2026-11-09).
 *
 * Cloudflare won't render a widget on a host it doesn't list (error 110200). Before this, a domain
 * attached in /manage served its lead form with no human check: leads still arrived, but no AI
 * call was placed for any of them, and nothing anywhere said why.
 *
 * The routes can't be loaded here (they pull in server-only and the ops root through dynamic
 * imports), so the ORDER is asserted on the source, the same way shared-lib-upgrade asserts the
 * export's: the widget is updated before Vercel is asked, and a refusal returns before it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONSOLE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(CONSOLE, p), 'utf8').replace(/\r\n/g, '\n');

test('the domain is added to the widget before it is attached, and a refusal attaches nothing', () => {
  const src = read('src/app/api/manage/domains/route.ts');
  const post = src.slice(src.indexOf('export async function POST'));
  const widget = post.indexOf('addHostnamesToSiteWidget(');
  const refuse = post.indexOf('if (!widget.ok)');
  const attach = post.indexOf('addProjectDomain(resolved.site.slug, domain)');
  assert.ok(widget > -1, 'the widget is updated');
  assert.ok(refuse > widget && attach > refuse, 'widget, then refuse on failure, then attach');
  const refusal = post.slice(refuse, attach);
  assert.match(refusal, /return NextResponse\.json\(/, 'the refusal returns');
  assert.match(refusal, /status: 409/);
});

test('the console never moves a site to another widget or creates one: that needs a rebuild', () => {
  const src = read('src/lib/turnstilePool.ts');
  assert.match(src, /allowMove: false/);
  assert.match(src, /storeSecret: noSecrets/, 'the console never holds a widget secret');
  assert.doesNotMatch(src, /allowMove: true/);
});

test('the finding offers the fix only when the widget is one of the pool', () => {
  const src = read('src/lib/reconcile.ts');
  const block = src.slice(src.indexOf("id: 'turnstile.missingHostnames'"), src.indexOf("} else if (!a.vercel && shouldBeLive && !quiet)"));
  assert.match(block, /ts\.siteKeyKnown\s*\?\s*\{\s*fix:/);
  assert.match(block, /action: 'turnstile\.hostnames'/);
});
