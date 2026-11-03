// next/font must survive Google's extensionless /l/font?kit=… URLs.
//
// About one Google Fonts response in twenty lists them, and Next 14.2's loader threw
// `Cannot read properties of null (reading '1')` on each one: roughly every other console
// build failed, on Windows and in CI. scripts/patch-next-font.mjs backports Next 16's fallback
// at postinstall; see its header.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ORIGINAL, PATCHED, LOADER, patchSource } from '../scripts/patch-next-font.mjs';

// The two URL shapes Google actually returned for Oswald 600 on 2026-11-03, plus the other
// extensions the loader's regex accepts.
const SLASH_L = 'https://fonts.gstatic.com/l/font?kit=TK3IWkUHHAIjg75cFRf3bXL8LICs1y9o40pKlN4NNSeSASz7FmlbHYjMdZwl&skey=653237e53512d0de&v=v57';
const PLAIN = 'https://fonts.gstatic.com/s/oswald/v57/TK3IWkUHHAIjg75cFRf3bXL8LICs1_Fv40pKlN4NNSeSASz7FmlbHYjedg.woff2';

const extOf = (line, googleFontFileUrl) =>
  new Function('googleFontFileUrl', `${line}\nreturn ext;`)(googleFontFileUrl);

test('the unpatched line is the one that throws on an /l/font URL', () => {
  assert.throws(() => extOf(ORIGINAL, SLASH_L), /reading '1'/);
});

test('the patched line names /l/font files woff2 and keeps real extensions', () => {
  assert.equal(extOf(PATCHED, SLASH_L), 'woff2');
  assert.equal(extOf(PATCHED, PLAIN), 'woff2');
  assert.equal(extOf(PATCHED, 'https://example.test/a.ttf'), 'ttf');
  assert.equal(extOf(PATCHED, 'https://example.test/a.woff?v=1'), 'woff');
});

test('patchSource is idempotent and refuses a loader it does not recognise', () => {
  const once = patchSource(`a\n${ORIGINAL}\nb`);
  assert.equal(once.state, 'patched');
  assert.equal(patchSource(once.src).state, 'already');
  assert.equal(patchSource('const ext = somethingElse;').state, 'unknown');
});

test('the installed Next loader carries the patch (postinstall ran)', () => {
  assert.ok(readFileSync(LOADER, 'utf8').includes(PATCHED),
    'run `npm install` in console/, or `node scripts/patch-next-font.mjs`');
});
