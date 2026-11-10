// Opening hours in the five vertical footers. extensions.hours is usually { all: "Mon to Fri 8am
// to 5pm" } (client-seo, 2026-11-10), and every footer printed its keys as labels, so a real site
// would have shown "all" beside its hours. "all" is a key, not a label: the hours stand alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FOOTERS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/components/catalog/footer');
const read = (f) => readFileSync(path.join(FOOTERS, f), 'utf8').replace(/\r\n/g, '\n');

test('no vertical footer prints the "all" key of its opening hours as a label', () => {
  for (const v of ['Hvac', 'Roofing', 'Plumbing', 'Lawn', 'Detail']) {
    const src = read(`${v}Footer.tsx`);
    if (!src.includes('extensions.hours')) continue;
    const isAllDays = /const isAllDays = \(d: string\) => (\/\^all\$\/i)\.test\(d\.trim\(\)\);/.exec(src);
    assert.ok(isAllDays, `${v}Footer: knows the "all" key`);
    const re = new RegExp(isAllDays[1].slice(1, -2), 'i');
    for (const key of ['all', 'All', ' ALL ']) assert.ok(re.test(key.trim()), `${v}Footer: "${key}" counts as every day`);
    assert.ok(!re.test('Mon to Fri'), `${v}Footer: a real day label still shows`);
    // Every label in the hours list is guarded; none is printed bare.
    assert.doesNotMatch(src, /^\s*<dt[^>]*>\{d\}<\/dt>\s*$/m, `${v}Footer: an hours key printed without the guard`);
    assert.match(src, /\{!isAllDays\(d\) && <dt[^>]*>\{d\}<\/dt>\}/, `${v}Footer: the label hides for "all"`);
  }
});
