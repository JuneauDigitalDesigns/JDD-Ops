// Lawn's hero-picker-to-contact prefill (PLAN D8, EXEC T6.2). Two independent guarantees:
//   1. The frequency param is mapped through a FIXED WHITELIST, never echoed raw — this string
//      ends up seeding a message field that reaches an owner email.
//   2. LeadForm.initialMessage actually seeds the textarea's initial value and the field stays
//      fully editable (not readOnly) — confirmed by rendering the real component.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeadForm } from '@jdd/ui/LeadForm';

// LeadForm.tsx compiles with tsconfig `jsx: "preserve"` (it's meant to be transformed by each
// consumer's own Next.js pipeline, which applies the automatic JSX runtime regardless of this
// dependency's own local tsconfig). Run directly under tsx outside that pipeline, its JSX falls
// back to classic-runtime React.createElement calls resolved as a bare global — real in Next
// builds (classic runtime historically required exactly this), absent here, so it's set by hand.
globalThis.React = React;

// FREQUENCY_MESSAGES is read by regex from LawnContact.tsx's source rather than imported —
// importing the module pulls in @/data/site's runtime `export * from '@jdd/schema'`, which
// resolves via a CJS codepath somewhere in the chain and fails with ERR_PACKAGE_PATH_NOT_EXPORTED
// under the plain node test runner. Same technique catalog-invariants.test.mjs and vertical-
// templates.test.mjs already use for export.ts/CATALOG for the identical reason.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lawnContactSrc = readFileSync(
  path.join(ROOT, 'src/components/catalog/contact/LawnContact.tsx'),
  'utf8',
);
const objLit = /FREQUENCY_MESSAGES: Record<string, string> = (\{[\s\S]*?\n\});/.exec(lawnContactSrc)[1];
// Wrapped in parens: a bare `{...}` at the start of an eval'd statement parses as a block, not
// an object literal.
// eslint-disable-next-line no-eval -- trusted, repo-local source file, not user input
const FREQUENCY_MESSAGES = eval(`(${objLit})`);

test('known frequency keys map to their exact prefill text', () => {
  assert.equal(FREQUENCY_MESSAGES.weekly, 'Weekly mowing — quarter-acre');
  assert.equal(FREQUENCY_MESSAGES.biweekly, 'Bi-weekly mowing — quarter-acre');
  assert.equal(FREQUENCY_MESSAGES.onetime, 'One-time cleanup');
});

test('an unmapped or missing key yields undefined, never the raw param echoed', () => {
  // The call site does `FREQUENCY_MESSAGES[params.get('frequency') ?? ''] ?? ''` — this test
  // pins the half that matters: the lookup itself has no fallback that could leak arbitrary
  // user-controlled text (e.g. from a hand-crafted ?frequency=<script> or similar) into a
  // message that reaches an owner email.
  assert.equal(FREQUENCY_MESSAGES['<script>alert(1)</script>'], undefined);
  assert.equal(FREQUENCY_MESSAGES[''], undefined);
  assert.equal(FREQUENCY_MESSAGES.WEEKLY, undefined); // case-sensitive, no fuzzy match
});

test('LeadForm.initialMessage seeds the textarea and the field stays editable', () => {
  const seeded = renderToStaticMarkup(
    createElement(LeadForm, { withMessage: true, initialMessage: 'Weekly mowing — quarter-acre', submitLabel: 'Go' }),
  );
  assert.ok(seeded.includes('Weekly mowing — quarter-acre'), 'seeded value missing from rendered textarea');
  assert.ok(!seeded.includes('readonly'), 'textarea must stay editable, not readOnly');
  assert.ok(seeded.includes('<textarea'), 'withMessage must render a textarea');
});

test('LeadForm without initialMessage renders an empty textarea (default unaffected)', () => {
  const unseeded = renderToStaticMarkup(createElement(LeadForm, { withMessage: true, submitLabel: 'Go' }));
  assert.ok(!unseeded.includes('Weekly mowing'), 'unseeded form must not carry stray prefill text');
});

test('an existing LeadForm call site with no initialMessage prop is byte-for-byte unaffected', () => {
  // Confirms the new optional prop defaulting to '' doesn't change any existing render.
  const a = renderToStaticMarkup(createElement(LeadForm, { submitLabel: 'Go' }));
  const b = renderToStaticMarkup(createElement(LeadForm, { submitLabel: 'Go', initialMessage: '' }));
  assert.equal(a, b);
});
