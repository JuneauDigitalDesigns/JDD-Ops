/**
 * The console's prompt writers keep the client's AI statement.
 *
 * The editor is the writer an operator uses most, and restoring an older version through it would
 * have put back a prompt from before the client asked. Source-level, like resume.test.mjs: these
 * routes run inside Next and write to a live agent. The rules themselves are tested against
 * recorded prompts in test/ai-statement.test.mjs.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONSOLE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(CONSOLE, p), 'utf8');
const EDITOR = read('src/app/api/manage/agent-prompt/route.ts');
const CONTROL = read('src/app/api/manage/agent-prompt/ai-statement/route.ts');

test('the editor applies the stored choice before anything reaches disk or Retell', () => {
  const carried = EDITOR.indexOf('applyStoredAiStatement(submitted, resolved.dir)');
  assert.notEqual(carried, -1);
  assert.match(EDITOR, /prompt = carried\.prompt;/, 'what is written is the carried text, not what was typed');
  assert.ok(carried < EDITOR.indexOf('writeFileSync(path, prompt'), 'applied before the disk write');
  assert.ok(carried < EDITOR.indexOf('update-retell-llm'), 'applied before the push');
  assert.doesNotMatch(EDITOR, /writeFileSync\(path, submitted/);
  assert.doesNotMatch(EDITOR, /general_prompt: submitted/);
});

test('both editors show what was written, not what was typed', () => {
  for (const f of ['src/components/manage/VoiceAgentSection.tsx', 'src/components/onboard/PromptTuner.tsx']) {
    assert.match(read(f), /const written = body\.prompt \?\? prompt;/, f);
  }
});

test('the editor refuses to push onto the master LLM', () => {
  assert.match(EDITOR, /llm\.llmId === loadMasterLlmId\(\)/);
});

test('the master id comes from jdd-ops/.env only, never the environment', () => {
  const src = read('src/lib/opsSecrets.ts');
  const body = src.slice(src.indexOf('export function loadMasterLlmId'), src.indexOf('}', src.indexOf('export function loadMasterLlmId')));
  assert.match(body, /parseEnvFile\(resolve\(opsRoot\(\), '\.env'\)\)\.RETELL_LLM_ID/);
  assert.doesNotMatch(body, /process\.env/);
});

test('every outcome of the control is in the audit log', () => {
  const audits = CONTROL.match(/appendAudit\(/g) ?? [];
  assert.equal(audits.length, 3, 'refused, applied and failed');
  assert.match(CONTROL, /action: 'agent\.ai_statement'/);
  assert.match(read('src/lib/audit.ts'), /'agent\.ai_statement'/);
});

test('the console restates no wording: the sentence comes from lib/voice-consent.js', () => {
  assert.doesNotMatch(read('src/components/manage/AiStatementPanel.tsx'), /Just so you know/);
  assert.doesNotMatch(CONTROL, /Just so you know/);
});
