// Intake autosave (Xander, 2026-11-10): "whatever gets typed into any of these fields should just
// be saved immediately", and a failed save shows. The wizard's server writes used to be
// fire-and-forget (`.catch(() => {})`): a failed save left nothing anywhere to see.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createAutosaver, combineStatus } from '../src/lib/autosave.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const settle = () => new Promise((r) => setImmediate(r));

function fakeTimers() {
  let now = 0;
  let id = 0;
  const due = new Map();
  return {
    setTimeout: (fn, ms) => { due.set(++id, { fn, at: now + ms }); return id; },
    clearTimeout: (i) => { due.delete(i); },
    async advance(ms) {
      now += ms;
      for (const [i, t] of [...due]) if (t.at <= now) { due.delete(i); t.fn(); }
      await settle(); await settle();
    },
    pending: () => due.size,
  };
}

test('many quick changes send once, with the latest value', async () => {
  const timers = fakeTimers();
  const sent = [];
  const s = createAutosaver(async (v) => { sent.push(v); }, { delayMs: 700, timers });
  s.schedule('a'); s.schedule('ab'); s.schedule('abc');
  assert.equal(s.status().state, 'pending');
  await timers.advance(699);
  assert.deepEqual(sent, []);
  await timers.advance(1);
  assert.deepEqual(sent, ['abc']);
  assert.equal(s.status().state, 'saved');
});

test('a failed save is reported, retried on a backoff, and clears when it succeeds', async () => {
  const timers = fakeTimers();
  let fail = true;
  const sent = [];
  const s = createAutosaver(async (v) => { if (fail) throw new Error('HTTP 500'); sent.push(v); }, { delayMs: 10, retryMs: [100, 500], timers });
  const seen = [];
  s.subscribe((st) => seen.push(st.state));
  s.schedule('x');
  await timers.advance(10);
  assert.equal(s.status().state, 'error');
  assert.equal(s.status().error, 'HTTP 500');
  assert.equal(s.status().failures, 1);
  // A change while failing keeps the failure visible and is what the retry sends.
  s.schedule('xy');
  assert.equal(s.status().state, 'error');
  fail = false;
  await timers.advance(100);
  assert.deepEqual(sent, ['xy']);
  assert.equal(s.status().state, 'saved');
  assert.equal(s.status().failures, 0);
  assert.ok(seen.includes('saving'));
});

test('flush sends now with keepalive, skipping the debounce (tab close)', async () => {
  const timers = fakeTimers();
  const calls = [];
  const s = createAutosaver(async (v, o) => { calls.push([v, o.keepalive]); }, { delayMs: 700, timers });
  s.schedule('typed');
  await s.flush({ keepalive: true });
  assert.deepEqual(calls, [['typed', true]]);
  assert.equal(timers.pending(), 0, 'the debounced send is cancelled, not repeated');
});

test('a change during a send goes right after it; nothing is dropped', async () => {
  const timers = fakeTimers();
  const sent = [];
  let release;
  const s = createAutosaver((v) => new Promise((r) => { sent.push(v); release = r; }), { delayMs: 5, timers });
  s.schedule('one');
  await timers.advance(5);
  assert.deepEqual(sent, ['one']);
  s.schedule('two');
  const flushing = s.flush();
  release();
  await settle();
  release?.();
  await flushing;
  assert.deepEqual(sent, ['one', 'two']);
});

test('one indicator shows the worst of the saves', () => {
  assert.equal(combineStatus({ state: 'saved', failures: 0 }, { state: 'error', failures: 1 }).state, 'error');
  assert.equal(combineStatus({ state: 'saved', failures: 0 }, { state: 'pending', failures: 0 }).state, 'pending');
});

test('the wizard saves through the autosaver, reports failures, and flushes on tab close', () => {
  const src = readFileSync(path.join(ROOT, 'src/app/c/[slug]/build/BuildWizard.tsx'), 'utf8');
  assert.doesNotMatch(src, /\.catch\(\(\) => \{ \/\* best-effort \*\/ \}\)/, 'no fire-and-forget saves left');
  assert.match(src, /createAutosaver[\s\S]*'\/api\/build\/save-draft'/);
  assert.match(src, /createAutosaver[\s\S]*'\/api\/build\/save-brief'/);
  assert.match(src, /addEventListener\('pagehide'/);
});
