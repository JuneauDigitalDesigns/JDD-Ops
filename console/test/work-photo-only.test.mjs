// A job photo is a work.projects entry (service-page-spec.md §4): intake and onboarding add
// photo-only projects tagged to a service, with t / caption / image and blank loc, size, yr and
// scope. BuildWizard un-hides the Work section as soon as projects exist, so these reach the
// generic Work sections. Each must omit a blank field (PLAN D5), never print a label over nothing:
// BeforeAfter printed "Location" and "Size" headings above empty values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = (rel) => readFileSync(fileURLToPath(new URL(`../src/components/catalog/work/${rel}`, import.meta.url)), 'utf8');

test('BeforeAfter prints the Location and Size labels only when there is a value', () => {
  const s = src('BeforeAfter.tsx');
  assert.match(s, /\{featured\.loc && \(\s*<div><span[^>]*>Location<\/span>/, 'Location label is not behind featured.loc');
  assert.match(s, /\{featured\.size && \(\s*<div><span[^>]*>Size<\/span>/, 'Size label is not behind featured.size');
});

test('no Work section renders an empty scope or location element', () => {
  for (const f of ['BeforeAfter.tsx', 'RecentJobsGrid.tsx', 'WorkSpotlight.tsx']) {
    const s = src(f);
    // Every <E p="work.projects.N.scope"> / .loc must sit behind a truthiness guard on the same field.
    for (const field of ['scope', 'loc']) {
      const uses = s.match(new RegExp(`<E p=[^>]*\\.${field}[\`"]\\}?>`, 'g')) ?? [];
      const bare = s.match(new RegExp(`\\{(?:current|featured|p)\\.${field}\\}`, 'g')) ?? [];
      for (const use of [...uses, ...bare]) {
        const i = s.indexOf(use);
        const before = s.slice(Math.max(0, i - 260), i);
        assert.ok(new RegExp(`\\.${field} &&`).test(before), `${f}: ${field} rendered without a guard (${use})`);
      }
    }
  }
});
