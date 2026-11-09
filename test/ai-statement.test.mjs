/**
 * The per-client AI statement: the line goes in, comes out byte for byte, and stays through
 * everything that rewrites a prompt.
 *
 * **The risk this encodes.** Contract v5.4 promises the statement on a client's written request.
 * The launch audit's worry was the only way to do that being a hand edit, which the next
 * `regenerate-prompt`, `update-prompt`, console save or onboard.js run would silently lose. These
 * tests run the real writers against recorded prompts (test/fixtures/retell/live-prompts.json).
 * Retell and Anthropic are stood in for only by a replay of those recorded prompts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  addAiStatement,
  AI_STATEMENT_FILE,
  aiStatementLine,
  applyAiStatement,
  applyStoredAiStatement,
  hashPrompt,
  inspectAiStatement,
  previewAiStatement,
  promptDiff,
  readAiStatementSetting,
  removeAiStatement,
} from '../lib/ai-statement.js';
import { checkAiStatement, checkLiveAgentSetup, checkPromptParity } from '../lib/onboard-checks.js';
import { aiStatementSentence, buildPostCallAnalysisData, inboundOpeningLine, PROMPT_SECTIONS, VOICEMAIL_OPTION } from '../lib/voice-consent.js';
import { generateRetellPrompt } from '../onboard.js';
import { loadFixture } from './helpers/fixtures.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const recorded = loadFixture('retell/live-prompts.json');
const { live_growth: growth, live_starter: starter, generated_growth: newGrowth, generated_starter: newStarter } = recorded;
const ALL = { growth, starter, newGrowth, newStarter };

const MASTER = 'llm_master_template';
const OWN = 'llm_client_own';
const AGENT = 'agent_recorded';

const tempDir = () => mkdtempSync(join(tmpdir(), 'ai-statement-'));
const setting = (dir, body) => writeFileSync(join(dir, AI_STATEMENT_FILE), JSON.stringify(body), 'utf8');

/** Replay Retell around a recorded prompt; keep every PATCH. */
async function withRetell({ prompt, business = growth.business, llmId = OWN, patchStatus = 200, driftOnRead = null }, run) {
  const state = { prompt, patches: [] };
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if ((init.method ?? 'GET') === 'PATCH') {
      state.patches.push({ url: u, body: JSON.parse(init.body) });
      if (patchStatus !== 200) return new Response('refused', { status: patchStatus });
      state.prompt = JSON.parse(init.body).general_prompt;
      return new Response('{}', { status: 200 });
    }
    if (u.includes('/get-agent/')) return Response.json({ response_engine: { type: 'retell-llm', llm_id: llmId } });
    if (u.includes('/get-retell-llm/')) {
      return Response.json({ llm_id: llmId, general_prompt: driftOnRead ?? state.prompt, begin_message: inboundOpeningLine(business) });
    }
    return new Response('unexpected', { status: 500 });
  };
  try {
    return { result: await run(), state };
  } finally {
    globalThis.fetch = real;
  }
}
const args = (dir, extra) => ({ apiKey: 'k', agentId: AGENT, masterLlmId: MASTER, dir, fallbackBusiness: 'From The Site', ...extra });

test('the sentence is exactly what the operator approved on 2026-11-09', () => {
  assert.equal(aiStatementSentence('Your HVAC Co.'), "Just so you know, I'm an AI assistant for Your HVAC Co.");
  assert.ok(aiStatementLine('Your HVAC Co.').includes(`"${aiStatementSentence('Your HVAC Co.')}"`));
});

test('off gives back the prompt byte for byte, on every recorded prompt', () => {
  for (const [name, x] of Object.entries(ALL)) {
    const on = addAiStatement(x.prompt, x.business);
    assert.notEqual(on, x.prompt, name);
    assert.equal(removeAiStatement(on), x.prompt, `${name}: turning it off changed something else`);
  }
});

test('turning it on adds one line and a blank line, and rewrites nothing', () => {
  for (const x of Object.values(ALL)) {
    const d = promptDiff(x.prompt, addAiStatement(x.prompt, x.business));
    assert.deepEqual(d.removed, []);
    assert.deepEqual(d.added, [aiStatementLine(x.business), '']);
  }
});

test('an agent with the statement on still passes every fixed check', () => {
  for (const [name, x] of Object.entries(ALL)) {
    const prompt = addAiStatement(x.prompt, x.business);
    const parity = checkPromptParity({ prompt, business: x.business, callbacks: x.callbacks });
    assert.equal(parity.ok, true, `${name}: ${parity.detail}`);
    assert.deepEqual([...prompt.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]), PROMPT_SECTIONS, name);
    const llm = { llm_id: OWN, begin_message: inboundOpeningLine(x.business), general_prompt: prompt };
    const agent = { post_call_analysis_data: buildPostCallAnalysisData(x.business), voicemail_option: VOICEMAIL_OPTION };
    const live = checkLiveAgentSetup({ agent, llm, masterLlmId: MASTER });
    if (name === 'growth' || name === 'starter') assert.equal(live.ok, true, `${name}: ${live.detail}`);
  }
});

test('it lands at the top of GREETING, and overrides the generated "not unprompted" rule', () => {
  // These recorded prompts really say "You do not announce that you're an AI unprompted".
  assert.match(starter.prompt, /do not announce that you're an AI unprompted/);
  const lines = addAiStatement(starter.prompt, starter.business).split('\n');
  const at = lines.indexOf(aiStatementLine(starter.business));
  assert.equal(lines[at - 2], '## GREETING');
  assert.match(lines[at], /overrides anything elsewhere in this prompt about not announcing that you are an AI/);
});

test('a prompt with no GREETING section still gets it, and still gives it back', () => {
  const p = 'You answer the phone for a plumber.\n\nBe nice.';
  const on = addAiStatement(p, 'Acme');
  assert.ok(on.startsWith(aiStatementLine('Acme')));
  assert.equal(removeAiStatement(on), p);
});

test('adding twice is one line; a changed line is replaced, not doubled', () => {
  const once = addAiStatement(growth.prompt, growth.business);
  assert.equal(addAiStatement(once, growth.business), once);
  const edited = once.replace('word for word', 'roughly');
  assert.equal(inspectAiStatement(edited, growth.business), 'altered');
  assert.equal(addAiStatement(edited, growth.business), once);
});

test('the stored choice puts the line back when a rewrite loses it, and is per folder', () => {
  const site1 = tempDir();
  const site2 = tempDir();
  setting(site1, { enabled: true, businessName: growth.business });
  const carried = applyStoredAiStatement(growth.prompt, site1);
  assert.equal(carried.change, 'added');
  assert.equal(inspectAiStatement(carried.prompt, growth.business), 'intact');
  assert.equal(applyStoredAiStatement(carried.prompt, site1).change, null);
  // The next site of the same client never asked.
  assert.equal(applyStoredAiStatement(growth.prompt, site2).prompt, growth.prompt);
  assert.equal(applyStoredAiStatement(growth.prompt, site2).change, null);
});

test('off removes a line left behind', () => {
  const dir = tempDir();
  setting(dir, { enabled: false });
  const carried = applyStoredAiStatement(addAiStatement(growth.prompt, growth.business), dir);
  assert.equal(carried.change, 'removed');
  assert.equal(carried.prompt, growth.prompt);
});

test('a setting that cannot be read refuses; it is never treated as off', () => {
  const on = addAiStatement(growth.prompt, growth.business);
  for (const bad of ['{not json', JSON.stringify({ enabled: 'yes' }), JSON.stringify({ enabled: true })]) {
    const dir = tempDir();
    writeFileSync(join(dir, AI_STATEMENT_FILE), bad, 'utf8');
    assert.equal(readAiStatementSetting(dir).unreadable, true, bad);
    assert.throws(() => applyStoredAiStatement(on, dir), /unreadable/, bad);
    assert.equal(checkAiStatement({ prompt: on, setting: readAiStatementSetting(dir) }).ok, false, bad);
  }
});

/* ── The control ───────────────────────────────────────────────────────── */

test('it edits the LIVE prompt of the bound LLM, not the stale file, and shows the exact change', async () => {
  const dir = tempDir();
  const stale = `${growth.prompt}\n\nOLD TEXT ONLY ON DISK`;
  writeFileSync(join(dir, 'agent-prompt.txt'), stale, 'utf8');

  const { result: preview } = await withRetell({ prompt: growth.prompt }, () => previewAiStatement(args(dir, { want: true })));
  assert.equal(preview.llmId, OWN);
  assert.equal(preview.enabled, false);
  assert.deepEqual(preview.proposal.diff.added, [aiStatementLine(growth.business), '']);

  const { result, state } = await withRetell({ prompt: growth.prompt }, () =>
    applyAiStatement(args(dir, { enabled: true, expectedHash: preview.proposal.hash })),
  );
  assert.equal(result.ok, true);
  assert.equal(state.patches.length, 1);
  assert.match(state.patches[0].url, new RegExp(`update-retell-llm/${OWN}$`));
  assert.deepEqual(Object.keys(state.patches[0].body), ['general_prompt']);
  assert.equal(state.prompt, addAiStatement(growth.prompt, growth.business));
  assert.doesNotMatch(state.prompt, /OLD TEXT ONLY ON DISK/);

  // The file got the same edit to its own text, so the difference it already had is still there.
  assert.equal(readFileSync(join(dir, 'agent-prompt.txt'), 'utf8'), addAiStatement(stale, growth.business));
  assert.equal(result.liveInSyncWithDisk, false);
  const stored = readAiStatementSetting(dir);
  assert.equal(stored.enabled, true);
  assert.equal(stored.businessName, growth.business, 'the name comes from the opening line, not the site fallback');
});

test('on then off leaves the live prompt and the file byte for byte as they were', async () => {
  const dir = tempDir();
  writeFileSync(join(dir, 'agent-prompt.txt'), growth.prompt, 'utf8');
  let live = growth.prompt;
  for (const enabled of [true, false]) {
    const { result, state } = await withRetell({ prompt: live }, () =>
      applyAiStatement(args(dir, { enabled, expectedHash: hashPrompt(live) })),
    );
    assert.equal(result.ok, true);
    live = state.prompt;
  }
  assert.equal(live, growth.prompt);
  assert.equal(readFileSync(join(dir, 'agent-prompt.txt'), 'utf8'), growth.prompt);
  assert.equal(readAiStatementSetting(dir).enabled, false);
});

test('it refuses an agent bound to the master LLM, and writes nothing', async () => {
  const dir = tempDir();
  const { result, state } = await withRetell({ prompt: growth.prompt, llmId: MASTER }, () =>
    applyAiStatement(args(dir, { enabled: true, expectedHash: hashPrompt(growth.prompt) })),
  );
  assert.equal(result.ok, false);
  assert.equal(result.masterBound, true);
  assert.equal(state.patches.length, 0);
  assert.equal(existsSync(join(dir, AI_STATEMENT_FILE)), false);
  const { result: preview } = await withRetell({ prompt: growth.prompt, llmId: MASTER }, () => previewAiStatement(args(dir, { want: true })));
  assert.equal(preview.masterBound, true);
});

test('it refuses when it cannot tell which LLM is the master', async () => {
  const dir = tempDir();
  const { result, state } = await withRetell({ prompt: growth.prompt }, () =>
    applyAiStatement(args(dir, { masterLlmId: null, enabled: true, expectedHash: hashPrompt(growth.prompt) })),
  );
  assert.equal(result.ok, false);
  assert.match(result.reason, /master LLM/);
  assert.equal(state.patches.length, 0);
});

test('a live prompt that moved after the preview is not overwritten', async () => {
  const dir = tempDir();
  const { result, state } = await withRetell({ prompt: `${growth.prompt}\nEdited in the dashboard.` }, () =>
    applyAiStatement(args(dir, { enabled: true, expectedHash: hashPrompt(growth.prompt) })),
  );
  assert.equal(result.conflict, true);
  assert.equal(state.patches.length, 0);
  assert.equal(existsSync(join(dir, AI_STATEMENT_FILE)), false);
});

test('a refused push leaves the stored choice as it was', async () => {
  const fresh = tempDir();
  const first = await withRetell({ prompt: growth.prompt, patchStatus: 500 }, () =>
    applyAiStatement(args(fresh, { enabled: true, expectedHash: hashPrompt(growth.prompt) })),
  );
  assert.equal(first.result.ok, false);
  assert.equal(existsSync(join(fresh, AI_STATEMENT_FILE)), false);

  const wasOn = tempDir();
  setting(wasOn, { enabled: true, businessName: growth.business });
  const on = addAiStatement(growth.prompt, growth.business);
  const second = await withRetell({ prompt: on, patchStatus: 500 }, () =>
    applyAiStatement(args(wasOn, { enabled: false, expectedHash: hashPrompt(on) })),
  );
  assert.equal(second.result.ok, false);
  assert.equal(readAiStatementSetting(wasOn).enabled, true);
});

test('a write that does not read back as sent is reported, never called done', async () => {
  const dir = tempDir();
  const { result } = await withRetell({ prompt: growth.prompt, driftOnRead: growth.prompt }, () =>
    applyAiStatement(args(dir, { enabled: true, expectedHash: hashPrompt(growth.prompt) })),
  );
  assert.equal(result.ok, false);
  assert.equal(result.unverified, true);
});

/* ── verify-agents ─────────────────────────────────────────────────────── */

test('verify-agents reports on, off, missing, changed and left behind', () => {
  const on = { enabled: true, businessName: growth.business };
  const off = { enabled: false };
  const withLine = addAiStatement(growth.prompt, growth.business);
  const check = (prompt, s, disclosedBusiness = growth.business) => checkAiStatement({ prompt, setting: s, disclosedBusiness });

  const intact = check(withLine, on);
  assert.equal(intact.ok, true);
  assert.match(intact.detail, /on and intact/);
  const none = check(growth.prompt, off);
  assert.equal(none.ok, true);
  assert.match(none.detail, /^off$/);

  assert.match(check(growth.prompt, on).detail, /does not have it/);
  assert.equal(check(growth.prompt, on).ok, false);
  assert.match(check(withLine.replace('word for word', 'roughly'), on).detail, /was changed/);
  assert.equal(check(withLine, off).ok, false);
  assert.match(check(withLine, on, 'Renamed Co.').detail, /opening line names "Renamed Co\."/);
  assert.equal(check(null, on).ok, null, 'an unread prompt is "could not check", never a pass');
  assert.doesNotMatch(check(growth.prompt, on).detail, /FAIL:/);
});

test('verify-agents runs the check on each agent from its own folder', () => {
  const src = readFileSync(resolve(ROOT, 'scripts/verify-agents.js'), 'utf8');
  assert.match(src, /checkAiStatement\(\{/);
  assert.match(src, /setting: readAiStatementSetting\(dir\)/);
  assert.match(src, /aiStatement\.ok !== true/);
});

/* ── The writers ───────────────────────────────────────────────────────── */

const intakeSite = { brand: { name: growth.business }, services: { items: [] } };

async function withAnthropic(prompt, run) {
  const real = globalThis.fetch;
  const key = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'recorded';
  globalThis.fetch = async () =>
    Response.json({ id: 'msg', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', content: [{ type: 'text', text: prompt }], usage: { input_tokens: 1, output_tokens: 1 } });
  try {
    return await run();
  } finally {
    globalThis.fetch = real;
    if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = key;
  }
}

test('regenerate-prompt: a freshly generated prompt keeps the statement', async () => {
  const dir = tempDir();
  setting(dir, { enabled: true, businessName: growth.business });
  const out = await withAnthropic(growth.prompt, () => generateRetellPrompt(intakeSite, dir, 'x', { regenerate: true, callbacks: true }));
  assert.equal(inspectAiStatement(out, growth.business), 'intact');
  assert.equal(readFileSync(join(dir, 'agent-prompt.txt'), 'utf8'), out);
  assert.equal(removeAiStatement(out), growth.prompt);
});

test('regenerate-prompt: a client who never asked gets the generator output untouched', async () => {
  const dir = tempDir();
  const out = await withAnthropic(growth.prompt, () => generateRetellPrompt(intakeSite, dir, 'x', { regenerate: true, callbacks: true }));
  assert.equal(out, growth.prompt);
});

test('an onboard.js re-run keeps the statement on the prompt it reuses', async () => {
  const dir = tempDir();
  writeFileSync(join(dir, '.env.local'), `RETELL_AGENT_ID=${AGENT}\n`, 'utf8');
  writeFileSync(join(dir, 'agent-prompt.txt'), growth.prompt, 'utf8');
  setting(dir, { enabled: true, businessName: growth.business });
  const out = await generateRetellPrompt(intakeSite, dir, 'x', {});
  assert.equal(inspectAiStatement(out, growth.business), 'intact');
  assert.equal(readFileSync(join(dir, 'agent-prompt.txt'), 'utf8'), out);
});

const STUB = `
import { appendFileSync } from 'node:fs';
const log = process.env.FETCH_LOG;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if ((init.method ?? 'GET') === 'PATCH') appendFileSync(log, JSON.stringify({ url: u, body: JSON.parse(init.body) }) + '\\n');
  if (u.includes('/get-agent/')) return Response.json({ agent_name: process.env.BUSINESS, response_engine: { llm_id: 'llm_client_own' } });
  return Response.json({});
};
`;

/** The real script, in a throwaway clients/ tree, with only Retell's network replaced. */
function runUpdatePrompt({ prompt, stored }) {
  const cwd = tempDir();
  const dir = join(cwd, 'clients', 'acme');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.env.local'), `RETELL_AGENT_ID=${AGENT}\n`, 'utf8');
  writeFileSync(join(dir, 'agent-prompt.txt'), prompt, 'utf8');
  if (stored) setting(dir, stored);
  const stub = join(cwd, 'stub.mjs');
  const log = join(cwd, 'fetch.log');
  writeFileSync(stub, STUB, 'utf8');
  const stdout = execFileSync(process.execPath, ['--import', pathToFileURL(stub).href, resolve(ROOT, 'scripts/update-agent-prompt.js'), '--slug', 'acme'], {
    cwd,
    env: { ...process.env, FETCH_LOG: log, BUSINESS: growth.business, RETELL_API_KEY: 'k', RETELL_LLM_ID: MASTER },
    encoding: 'utf8',
  });
  const patches = readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const llmPush = patches.find((p) => p.url.includes('update-retell-llm'));
  return { stdout, llmPush, disk: readFileSync(join(dir, 'agent-prompt.txt'), 'utf8') };
}

test('update-prompt: a file that lost the line still pushes it, and the file gets it back', () => {
  const { llmPush, disk, stdout } = runUpdatePrompt({ prompt: growth.prompt, stored: { enabled: true, businessName: growth.business } });
  assert.equal(inspectAiStatement(llmPush.body.general_prompt, growth.business), 'intact');
  assert.equal(llmPush.body.begin_message, inboundOpeningLine(growth.business), 'the approved opening line is untouched');
  assert.equal(disk.trim(), llmPush.body.general_prompt);
  assert.match(stdout, /AI statement added/);
});

test('update-prompt: a client who never asked is pushed exactly as before', () => {
  const { llmPush, disk } = runUpdatePrompt({ prompt: growth.prompt });
  assert.equal(llmPush.body.general_prompt, growth.prompt.trim());
  assert.equal(disk, growth.prompt);
});
