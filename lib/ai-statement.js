/**
 * lib/ai-statement.js — the per-client AI statement: one managed line in the agent's prompt, and
 * the stored choice that keeps it there.
 *
 * Contract v5.4 promises that, on a client's written request, the agent will say near the start
 * of each call that it is an AI. A hand edit to one prompt cannot keep that promise, because a
 * prompt is rewritten by `npm run regenerate-prompt`, `npm run update-prompt`, the console's
 * editor and an onboard.js re-run. So the CHOICE is stored per client (per site for Enterprise),
 * beside agent-prompt.txt, and every one of those writers passes through `applyStoredAiStatement`.
 *
 *   clients/{slug}[/site-N]/ai-statement.json   { enabled, businessName, updatedAt }
 *
 * ── Why a line in the prompt, not the opening line ──────────────────────────
 *
 * `begin_message` is the approved recording disclosure, evidence that must stay word for word. It
 * also cannot reach outbound callbacks: /api/contact sends their opening per call, from code that
 * lives in each client repo. A line in the prompt reaches both directions and changes neither.
 * What it gives up: the model says it, so it is not guaranteed verbatim the way begin_message is.
 *
 * ── Why this shape of line ──────────────────────────────────────────────────
 *
 * It sits inside GREETING because `checkPromptParity` holds every prompt to exactly
 * PROMPT_SECTIONS: a "##" heading of its own would fail every agent that has it. No square
 * brackets, for the same check. It has to override the generated "you don't announce it
 * unprompted", which is in the live prompts, and it must never be edited out of them: turning the
 * statement off has to give back the client's prompt byte for byte. One line, found by a fixed
 * label, is what makes "removes only what was added" checkable.
 *
 * ── Live first, disk separately ─────────────────────────────────────────────
 *
 * `agent-prompt.txt` can lag the live prompt (the Retell dashboard, a push that never reached
 * disk). The control reads the LLM the agent is actually BOUND to and edits THAT text; the file
 * gets the same one-line edit to its own text. Neither is ever replaced by the other, so a
 * difference that existed before still exists afterwards, where the editor can show it.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { aiStatementSentence, recoverBusinessName } from './voice-consent.js';

export const AI_STATEMENT_FILE = 'ai-statement.json';
const PROMPT_FILE = 'agent-prompt.txt';
const RETELL_API = 'https://api.retellai.com';

const LABEL = 'AI STATEMENT (required on every call';
const ESCAPED_LABEL = LABEL.replace(/[()]/g, '\\$&');
// The line as it stands, and the line plus the blank line `addLine` puts after it.
const LINE_RE = () => new RegExp(`^${ESCAPED_LABEL}[^\\r\\n]*`, 'gm');
const BLOCK_RE = () => new RegExp(`^${ESCAPED_LABEL}[^\\r\\n]*(?:\\r?\\n){0,2}`, 'gm');
const SEPARATOR = '\n\n';

/** The whole instruction, exactly as it appears in a prompt. One line, always. */
export function aiStatementLine(businessName) {
  return `${LABEL}, at the client's written request): the first time you speak after the fixed opening line, begin with exactly this sentence, word for word, and say it only once in the call: "${aiStatementSentence(businessName)}" Then carry straight on with the rest of that turn. This overrides anything elsewhere in this prompt about not announcing that you are an AI or not repeating the business name.`;
}

/** A name safe to put inside the one-line, bracket-free instruction. null if it isn't. */
function usableBusinessName(name) {
  const n = typeof name === 'string' ? name.trim() : '';
  return n && !/[\r\n"[\]]/.test(n) ? n : null;
}

/**
 * 'absent' | 'intact' | 'altered'. Intact means exactly one line, exactly as `businessName` would
 * have it. With no name to compare against, a line that is there reads as 'altered'.
 */
export function inspectAiStatement(prompt, businessName) {
  const lines = (typeof prompt === 'string' ? prompt : '').match(LINE_RE()) ?? [];
  if (lines.length === 0) return 'absent';
  return lines.length === 1 && businessName && lines[0] === aiStatementLine(businessName) ? 'intact' : 'altered';
}

/** Take the line(s) out, and nothing else. Exact inverse of `addAiStatement` on an unedited prompt. */
export function removeAiStatement(prompt) {
  return prompt.replace(BLOCK_RE(), '');
}

/**
 * The start of GREETING's first line of text, or 0 for a prompt with no such section (one written
 * before PROMPT_SECTIONS existed): the instruction stands on its own, so the top is still correct.
 */
function insertionPoint(prompt) {
  const heading = /^##[ \t]+[*_`]*GREETING[*_`]*[ \t]*\r?$/im.exec(prompt);
  if (!heading) return 0;
  let at = heading.index + heading[0].length;
  while (prompt[at] === '\n' || prompt[at] === '\r') at++;
  return at < prompt.length ? at : 0;
}

/** Add the line, replacing any earlier copy of it. Everything else stays as it was. */
export function addAiStatement(prompt, businessName) {
  const bare = removeAiStatement(prompt);
  const at = insertionPoint(bare);
  return `${bare.slice(0, at)}${aiStatementLine(businessName)}${SEPARATOR}${bare.slice(at)}`;
}

/** Bring one prompt in line with one stored choice. `change` is null when it already was. */
export function reconcileAiStatement(prompt, setting) {
  const state = inspectAiStatement(prompt, setting.enabled ? setting.businessName : null);
  if (setting.enabled) {
    if (state === 'intact') return { prompt, change: null };
    return { prompt: addAiStatement(prompt, setting.businessName), change: state === 'absent' ? 'added' : 'repaired' };
  }
  if (state === 'absent') return { prompt, change: null };
  return { prompt: removeAiStatement(prompt), change: 'removed' };
}

/**
 * The stored choice for one client folder (clients/{slug} or clients/{slug}/site-N).
 *
 * A file that exists and can't be understood is `unreadable`, never "off". Read as off, the next
 * push would strip the statement from a client who asked for it in writing: the exact quiet loss
 * this file exists to prevent.
 */
export function readAiStatementSetting(dir) {
  const path = resolve(dir, AI_STATEMENT_FILE);
  const off = { enabled: false, businessName: null, updatedAt: null };
  if (!existsSync(path)) return { ...off, recorded: false, unreadable: false };
  const broken = (why) => ({ ...off, recorded: true, unreadable: true, reason: `${path} ${why} — fix or delete it before changing this agent's prompt` });
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return broken('is not valid JSON');
  }
  if (typeof raw?.enabled !== 'boolean') return broken('has no true/false "enabled"');
  if (!raw.enabled) return { ...off, updatedAt: raw.updatedAt ?? null, recorded: true, unreadable: false };
  const businessName = usableBusinessName(raw.businessName);
  if (!businessName) return broken('is on but has no usable "businessName"');
  return { enabled: true, businessName, updatedAt: raw.updatedAt ?? null, recorded: true, unreadable: false };
}

function writeSetting(dir, enabled, businessName) {
  const path = resolve(dir, AI_STATEMENT_FILE);
  const tmp = `${path}.${process.pid}.tmp`;
  const body = { enabled, ...(enabled ? { businessName } : {}), updatedAt: new Date().toISOString() };
  writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
}

/**
 * The one call every prompt writer makes before a prompt reaches disk or Retell.
 * Throws on an unreadable setting: refusing a push is recoverable, a lost statement is not visible.
 */
export function applyStoredAiStatement(prompt, dir) {
  const setting = readAiStatementSetting(dir);
  if (setting.unreadable) throw new Error(`AI statement setting unreadable: ${setting.reason}`);
  return { ...reconcileAiStatement(prompt, setting), setting };
}

export function hashPrompt(prompt) {
  return createHash('sha256').update(prompt, 'utf8').digest('hex');
}

/**
 * The exact change, as one hunk. One line moves, so the common head and tail are the whole diff;
 * a general line diff would only add ways for what is shown to differ from what is sent.
 */
export function promptDiff(before, after, context = 2) {
  const a = before.split('\n');
  const b = after.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  return {
    line: head + 1,
    contextBefore: a.slice(Math.max(0, head - context), head),
    removed: a.slice(head, a.length - tail),
    added: b.slice(head, b.length - tail),
    contextAfter: a.slice(a.length - tail, a.length - tail + context),
  };
}

const refuse = (reason, extra = {}) => ({ ok: false, reason, ...extra });

async function retellGet(path, apiKey) {
  try {
    const res = await fetch(`${RETELL_API}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    return { ok: res.ok, status: res.status, body: res.ok ? await res.json() : null };
  } catch (err) {
    return { ok: false, status: 0, body: null, error: err?.message ?? String(err) };
  }
}

/**
 * The agent, and the LLM it is actually bound to. Fails closed on the master: a write here would
 * put one client's statement into every future client's template. If the master can't be told
 * apart (its id is missing from the root .env), that is a refusal too, not a pass.
 */
async function readBoundLlm({ apiKey, agentId, masterLlmId }) {
  if (!apiKey) return refuse('RETELL_API_KEY is not set in jdd-ops/.env.');
  if (!agentId) return refuse('No RETELL_AGENT_ID for this site.');
  if (!masterLlmId) return refuse("RETELL_LLM_ID is not set in jdd-ops/.env, so the master LLM can't be told apart from this agent's. Refusing.");

  const agent = await retellGet(`/get-agent/${agentId}`, apiKey);
  if (agent.status === 404) return refuse(`Retell does not recognise agent ${agentId}.`);
  if (!agent.ok) return refuse(`Retell get-agent returned ${agent.status || agent.error}.`);
  const llmId = agent.body?.response_engine?.llm_id;
  if (!llmId) return refuse(`Agent ${agentId} is not backed by a retell-llm engine, so it has no prompt to add to.`);
  if (llmId === masterLlmId) {
    return refuse(`Agent ${agentId} is bound to the MASTER Retell LLM (${llmId}). Refusing: this would rewrite every client's template. Bind it to its own LLM first.`, { masterBound: true });
  }
  const llm = await retellGet(`/get-retell-llm/${llmId}`, apiKey);
  if (!llm.ok) return refuse(`Retell get-retell-llm returned ${llm.status || llm.error}.`);
  const prompt = llm.body?.general_prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) return refuse(`LLM ${llmId} has no prompt to add to.`);
  return { ok: true, llmId, prompt, business: recoverBusinessName(llm.body?.begin_message) };
}

/**
 * Everything both the preview and the write start from. The name comes from the recording
 * disclosure, the same place verify-agents reads it (`agent_name` was "Master Agent" on the growth
 * fixture), so the statement names the business the caller has just heard.
 */
async function loadState({ apiKey, agentId, masterLlmId, dir, fallbackBusiness }) {
  const setting = readAiStatementSetting(dir);
  if (setting.unreadable) return refuse(setting.reason);
  const live = await readBoundLlm({ apiKey, agentId, masterLlmId });
  if (!live.ok) return live;
  return { ok: true, setting, live, business: usableBusinessName(live.business) ?? usableBusinessName(fallbackBusiness) };
}

function plan({ live, business }, enabled) {
  if (enabled && !business) {
    return refuse("Couldn't work out the business name from this agent's opening line or the client's site.");
  }
  return { ok: true, after: enabled ? addAiStatement(live.prompt, business) : removeAiStatement(live.prompt) };
}

/**
 * Where this agent stands, and, with `want` set, exactly what turning it on or off would change.
 * Read-only.
 */
export async function previewAiStatement({ apiKey, agentId, masterLlmId, dir, fallbackBusiness, want = null }) {
  const state = await loadState({ apiKey, agentId, masterLlmId, dir, fallbackBusiness });
  if (!state.ok) return state;
  const { setting, live, business } = state;

  const named = setting.enabled ? setting.businessName : business;
  const liveState = inspectAiStatement(live.prompt, named);
  const out = {
    ok: true,
    agentId,
    llmId: live.llmId,
    enabled: setting.enabled,
    live: liveState,
    drift: setting.enabled ? liveState !== 'intact' : liveState !== 'absent',
    sentence: named ? aiStatementSentence(named) : null,
    proposal: null,
  };
  if (typeof want !== 'boolean') return out;

  const planned = plan(state, want);
  if (!planned.ok) return planned;
  return {
    ...out,
    proposal: {
      enabled: want,
      changed: planned.after !== live.prompt,
      hash: hashPrompt(live.prompt),
      charsBefore: live.prompt.length,
      charsAfter: planned.after.length,
      diff: promptDiff(live.prompt, planned.after),
    },
  };
}

/**
 * Turn the statement on or off for one agent.
 *
 * `expectedHash` is the live prompt the operator was shown. If it has changed since, nothing is
 * written, because what they approved is no longer what would be sent.
 *
 * The choice is stored BEFORE the push and restored if the push fails. Stored first, a crash can
 * only leave "on" recorded for an agent still missing the line, which verify-agents reports and
 * the next push repairs; the other order can leave a live line that the next push silently strips.
 */
export async function applyAiStatement({ apiKey, agentId, masterLlmId, dir, fallbackBusiness, enabled, expectedHash }) {
  const state = await loadState({ apiKey, agentId, masterLlmId, dir, fallbackBusiness });
  if (!state.ok) return state;
  const { live, business } = state;

  if (!expectedHash || expectedHash !== hashPrompt(live.prompt)) {
    return refuse('The live prompt changed after this preview. Nothing was written; review the change again.', { conflict: true });
  }
  const planned = plan(state, enabled);
  if (!planned.ok) return planned;
  const { after } = planned;
  const changed = after !== live.prompt;

  const path = resolve(dir, AI_STATEMENT_FILE);
  const previous = existsSync(path) ? readFileSync(path, 'utf8') : null;
  const restore = () => (previous === null ? rmSync(path, { force: true }) : writeFileSync(path, previous, 'utf8'));
  try {
    writeSetting(dir, enabled, business);
  } catch (err) {
    return refuse(`Couldn't store the choice, so the agent was not changed: ${err?.message ?? err}`);
  }

  if (changed) {
    let failure = null;
    try {
      const res = await fetch(`${RETELL_API}/update-retell-llm/${live.llmId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ general_prompt: after }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) failure = `Retell update-retell-llm returned ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`;
    } catch (err) {
      failure = `Retell update-retell-llm failed: ${err?.message ?? err}`;
    }
    if (failure) {
      restore();
      return refuse(`${failure}. The agent and the stored choice are unchanged.`);
    }
    const back = await retellGet(`/get-retell-llm/${live.llmId}`, apiKey);
    if (!back.ok || back.body?.general_prompt?.trim() !== after.trim()) {
      return refuse(`Retell accepted the update but LLM ${live.llmId} did not read back as sent${back.ok ? '' : ` (get-retell-llm ${back.status || back.error})`}. Check the live agent before relying on this.`, { unverified: true });
    }
  }

  // The file gets the same edit to its OWN text; it is never replaced with the live prompt.
  const disk = { changed: false, content: null, error: null };
  const promptPath = resolve(dir, PROMPT_FILE);
  try {
    if (existsSync(promptPath)) {
      const current = readFileSync(promptPath, 'utf8');
      disk.content = enabled ? addAiStatement(current, business) : removeAiStatement(current);
      disk.changed = disk.content !== current;
      if (disk.changed) writeFileSync(promptPath, disk.content, 'utf8');
    }
  } catch (err) {
    disk.error = err?.message ?? String(err);
  }

  return { ok: true, enabled, changed, agentId, llmId: live.llmId, charsBefore: live.prompt.length, charsAfter: after.length, liveInSyncWithDisk: disk.content === null ? null : disk.content.trim() === after.trim(), disk };
}
