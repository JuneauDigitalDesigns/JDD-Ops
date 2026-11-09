/**
 * The console's half of recording the terms on a phone close (Xander, 2026-11-09).
 * `attachRecording` is the real sequence and the real hashing; only the three outside calls are
 * supplied. The agency's half, the gate included, is in its own `close-recording.test.mjs`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { attachRecording } from '../src/lib/recordingUpload.ts';
import { config } from '../src/middleware.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const wizard = read('../src/components/close/CloseWizard.tsx');

const streamOf = (...chunks) =>
  new ReadableStream({
    start(c) {
      for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk));
      c.close();
    },
  });

const META = { fileName: 'terms.mp4', contentType: 'video/mp4', sizeBytes: 11 };

function deps(over = {}) {
  const calls = { stored: null, completed: null, opts: null };
  return {
    calls,
    begin: async () => ({ status: 200, body: { pathname: 'recordings/a/b.mp4', uploadToken: 'vercel_blob_client_x' } }),
    store: async (pathname, stream, opts) => {
      calls.stored = await new Response(stream).text();
      calls.opts = { pathname, ...opts };
    },
    complete: async (input) => {
      calls.completed = input;
      return { status: 200, body: { ok: true } };
    },
    ...over,
  };
}

test('the hash recorded is of the bytes that went to the store', async () => {
  const d = deps();
  const out = await attachRecording(streamOf('hello ', 'world'), META, d);
  assert.equal(out.status, 200);
  assert.equal(d.calls.stored, 'hello world', 'the file reached the store unchanged');
  assert.deepEqual(d.calls.opts, { pathname: 'recordings/a/b.mp4', token: 'vercel_blob_client_x', contentType: 'video/mp4' });
  assert.equal(d.calls.completed.sha256, createHash('sha256').update('hello world').digest('hex'));
});

test('a short upload attaches nothing', async () => {
  const d = deps();
  const out = await attachRecording(streamOf('hello'), META, d);
  assert.equal(out.status, 400);
  assert.equal(d.calls.completed, null);
});

test('a store failure attaches nothing', async () => {
  const d = deps({ store: async () => { throw new Error('store down'); } });
  const out = await attachRecording(streamOf('hello world'), META, d);
  assert.equal(out.status, 502);
  assert.equal(d.calls.completed, null);
});

test("the agency's refusal comes back as it was, before any upload", async () => {
  const d = deps({ begin: async () => ({ status: 409, body: { error: 'A recording is already attached to this agreement.' } }) });
  const out = await attachRecording(streamOf('hello world'), META, d);
  assert.equal(out.status, 409);
  assert.match(out.body.error, /already attached/);
  assert.equal(d.calls.stored, null);
});

test('only the upload route skips the middleware, and it checks loopback itself', () => {
  // The middleware buffers the whole body in memory to hand it on, so a video can't go through it.
  const matches = (path) => new RegExp(`^${config.matcher}$`).test(path);
  assert.equal(matches('/api/manage/agreement/upload/ord_1'), false);
  for (const covered of ['/api/manage/agreement', '/api/manage/teardown', '/api/manage/env', '/api/sales/orders/o/accept-terms']) {
    assert.equal(matches(covered), true, covered);
  }
  const route = read('../src/app/api/manage/agreement/upload/[orderId]/route.ts');
  const handler = route.slice(route.indexOf('export async function POST'));
  assert.match(handler.split('\n')[1], /isLoopback\(req\)/, 'the first thing the handler does');
});

test('the wizard sends the consent tick and waits on Recording stopped', () => {
  assert.match(wizard, /recordingConsentAt: consentAt/);
  assert.match(wizard, /disabled=\{busy \|\| !consentAt \|\| !agreed \|\| !read\.every\(Boolean\)\}/);
  assert.match(wizard, /disabled=\{busy \|\| \(needsStop && !stopped\)\}/);
  assert.match(wizard, /recording-stopped/);
  const proxy = read('../src/app/api/sales/orders/[id]/[action]/route.ts');
  assert.match(proxy, /'recording-stopped'/, 'the console can reach it');
});

test('the approved labels and helper line are the words on screen', () => {
  for (const label of ['Recording notice', 'Client consented to recording', 'Recording stopped', 'To attach']) {
    assert.ok(wizard.includes(label), label);
  }
  assert.ok(wizard.includes('Receives the portal login, as well as the agreement.'));
});

test('payment refused for a running recording goes back to the tick, not a dead end', () => {
  assert.match(wizard, /data\.code === 'recording-running'/);
  assert.match(wizard, /onRecordingRunning=\{\(\) => setStep\('terms'\)\}/);
});
