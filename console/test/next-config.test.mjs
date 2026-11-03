// `next build` must stay able to finish.
//
// It never did: one webpack worker sat in @vercel/nft's file tracer for 20+ minutes on every
// revision, globbing `<console>/**/*/site.ts` and friends through node_modules and the full repo
// copies under console/.claude/worktrees. Nothing errored; the build just never ended, and CI
// only runs `npm test`, so nobody saw it. The fix is `outputFileTracing: false` in
// next.config.js (the console is never deployed, so nothing reads the traces). See the comment
// there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('next.config.js keeps file tracing off', () => {
  const config = require('../next.config.js');
  assert.equal(config.outputFileTracing, false,
    'outputFileTracing must stay false, or `next build` hangs in the nft glob again');
});

test('Next is still a version that honours outputFileTracing', () => {
  // Next 15 removes the option and ignores it. An upgrade must replace it with
  // outputFileTracingExcludes covering the globs, or the hang comes back with no error.
  const { version } = require('next/package.json');
  assert.equal(Number(version.split('.')[0]), 14,
    `next@${version}: outputFileTracing is gone, replace it before upgrading (see next.config.js)`);
});
