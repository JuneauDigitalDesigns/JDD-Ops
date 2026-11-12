// Xander, 2026-11-12: "When we have a new sign up, I wanted to say ready for build instead." A
// self-serve sign-up waiting on the Clients page reads "Ready for build", not "New signup".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const card = readFileSync(path.join(ROOT, 'src/components/picker/IntakeCard.tsx'), 'utf8');

test('a new sign-up card says "Ready for build"', () => {
  assert.match(card, />\s*Ready for build\s*</);
  assert.doesNotMatch(card, /New signup/);
});
