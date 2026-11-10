// The Intake's step registry (redesign approved 2026-11-10). Saved bundles carry the step id of
// whatever layout saved them, so every old id must land on the step that now holds its content,
// and once the intake has run, reopening it lands on Still to do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { INTAKE_STEPS, migrateStepId, landingStepId, LAST_STEP_ID } from '../src/lib/intake-steps.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('eleven steps, ending on Still to do', () => {
  assert.deepEqual(INTAKE_STEPS.map((s) => s.id), [
    'business', 'services', 'area', 'reviews', 'words', 'voice', 'positioning', 'structure', 'prompt', 'review', 'todo',
  ]);
  assert.equal(INTAKE_STEPS.at(-1).id, LAST_STEP_ID);
});

test('legacy step ids from every earlier layout land on a real step', () => {
  // Three sub-stages (before 2026-10), then the 8-step layout with 'intake' and 'sections'.
  assert.equal(migrateStepId('brief'), 'business');
  assert.equal(migrateStepId('intake'), 'business');
  assert.equal(migrateStepId('sections'), 'structure');
  for (const kept of ['words', 'voice', 'positioning', 'structure', 'prompt', 'review']) {
    assert.equal(migrateStepId(kept), kept);
  }
  assert.equal(migrateStepId('no-such-step'), 'business');
  assert.equal(migrateStepId(undefined), 'business');
});

test('once the intake has run, it reopens on Still to do; before that, where it was', () => {
  assert.equal(landingStepId('services', '2026-11-09T14:32:00.000Z'), 'todo');
  assert.equal(landingStepId('intake', '2026-11-09T14:32:00.000Z'), 'todo');
  assert.equal(landingStepId('services', undefined), 'services');
  assert.equal(landingStepId('sections', null), 'structure');
});

test('the facts block is never a step: the Business step owns those paths', () => {
  for (const s of INTAKE_STEPS) assert.ok(!(s.blockIds ?? []).includes('facts'), s.id);
});

test('Structure holds the counts and the section instructions on one step', () => {
  const s = INTAKE_STEPS.find((x) => x.id === 'structure');
  assert.deepEqual(s.blockIds, ['structure', 'sections', 'custom']);
});

test('the Structure step has no testimonials count to render (PR #51)', () => {
  // resolve.ts builds the counts the Structure step shows; a 'testimonials' entry there would
  // tell the copywriter how many reviews to invent.
  const src = readFileSync(path.join(ROOT, 'src/lib/copy-brief/resolve.ts'), 'utf8');
  const block = src.slice(src.indexOf('function resolveStructure'), src.indexOf('function resolveSections'));
  assert.doesNotMatch(block, /key:\s*'testimonials'/);
});

test('Approve sits on Still to do and stamps lastRunAt, which is what reopening reads', () => {
  const step = readFileSync(path.join(ROOT, 'src/components/wizard/IntakeStep.tsx'), 'utf8');
  assert.match(step, /lastRunAt: new Date\(\)\.toISOString\(\)/);
  assert.match(step, /landingStepId\(stage, brief\.lastRunAt\)/);
  const shell = readFileSync(path.join(ROOT, 'src/components/wizard/brief/IntakeShell.tsx'), 'utf8');
  assert.match(shell, /<TodoStep[\s\S]*onApprove=\{onApprove\}/);
});

test('the landing rule also runs at hydration, not only on IntakeStep mount', () => {
  // Found in the browser, 2026-11-10: on a fresh page load IntakeStep mounts BEFORE BuildWizard
  // applies the saved bundle, so its mount check read the empty initial brief, missed lastRunAt
  // and the intake reopened on whatever step was saved. applyBundle must apply the rule too.
  const src = readFileSync(path.join(ROOT, 'src/app/c/[slug]/build/BuildWizard.tsx'), 'utf8');
  const apply = src.slice(src.indexOf('const applyBundle = useCallback'), src.indexOf('setCopyModel(b.copyModel'));
  assert.match(apply, /setIntakeStage\(landingStepId\(b\.intakeStage, nextBrief\.lastRunAt\)\)/);
});
