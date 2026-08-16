#!/usr/bin/env node
/**
 * scripts/backfill-agent-limits.js — set max_call_duration_ms on existing Retell agents.
 *
 * onboard.js sets this on every agent it creates from now on. Agents provisioned
 * before that still carry Retell's 60-minute default, which is the exposure this
 * closes: one stuck or looping call costs ~$5.91 at 60 minutes versus ~$0.99 at 10.
 * Measured median call length on this account is 91 seconds.
 *
 * This is a per-call ceiling, not the monthly plan allowance — that is enforced
 * separately against accumulated usage.
 *
 * Usage:
 *   node scripts/backfill-agent-limits.js --dry-run        # preview, change nothing
 *   node scripts/backfill-agent-limits.js                  # apply to every agent
 *   node scripts/backfill-agent-limits.js --value 900000   # use a different ceiling
 *   node scripts/backfill-agent-limits.js --agent <id>     # one agent (repeatable)
 *   node scripts/backfill-agent-limits.js --skip <id>      # exclude an agent (repeatable)
 *
 * Idempotent: agents already at the target value are reported and left alone, so
 * re-running is free. One agent failing does not abort the rest.
 */

import 'dotenv/config';

// Keep in sync with MAX_CALL_DURATION_MS in onboard.js.
const DEFAULT_MAX_CALL_DURATION_MS = 600_000;

function fail(msg, err) {
  console.error(`backfill-agent-limits: ${msg}`);
  if (err) console.error(err);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dryRun: false, value: DEFAULT_MAX_CALL_DURATION_MS, only: [], skip: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--value' && argv[i + 1]) {
      args.value = Number(argv[++i]);
      if (!Number.isFinite(args.value) || args.value <= 0) fail(`--value must be a positive number of milliseconds`);
    } else if (a === '--agent' && argv[i + 1]) args.only.push(argv[++i]);
    else if (a === '--skip' && argv[i + 1]) args.skip.push(argv[++i]);
    else if (a.startsWith('--')) fail(`unknown flag ${a}`);
  }
  return args;
}

const mins = (ms) => `${(ms / 60000).toFixed(1)}m`;

async function main() {
  const { dryRun, value, only, skip } = parseArgs(process.argv);
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) fail('RETELL_API_KEY not set in .env');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  const listRes = await fetch('https://api.retellai.com/list-agents', { headers });
  if (!listRes.ok) fail(`Retell list-agents returned ${listRes.status}: ${await listRes.text().catch(() => '')}`);
  const all = await listRes.json();
  if (!Array.isArray(all)) fail(`Unexpected list-agents response: ${JSON.stringify(all).slice(0, 200)}`);

  // list-agents returns one row per agent VERSION, not per agent — a single agent
  // edited 19 times comes back 19 times, under whatever name it carried at the time.
  // Collapse to the highest version per agent_id, which is what an unversioned
  // update-agent call targets. Without this the script would PATCH the same agent
  // once per historical version.
  const latest = new Map();
  for (const row of all) {
    const prev = latest.get(row.agent_id);
    if (!prev || (row.version ?? 0) > (prev.version ?? 0)) latest.set(row.agent_id, row);
  }

  const agents = [...latest.values()]
    .filter((a) => (only.length ? only.includes(a.agent_id) : true))
    .filter((a) => !skip.includes(a.agent_id));

  console.log(
    `list-agents returned ${all.length} version rows across ${latest.size} distinct agent(s).`,
  );

  if (!agents.length) fail('No agents matched. Check --agent / --skip values against list-agents.');

  console.log(
    `${dryRun ? '[dry run] ' : ''}Target max_call_duration_ms = ${value} (${mins(value)}) across ${agents.length} agent(s)\n`,
  );

  let changed = 0, already = 0, failed = 0;

  for (const a of agents) {
    const id = a.agent_id;
    const name = a.agent_name || '(unnamed)';
    const current = a.max_call_duration_ms;

    if (current === value) {
      already++;
      console.log(`  = ${id}  ${name} — already ${mins(value)}`);
      continue;
    }

    const from = current === undefined ? 'unset' : `${mins(current)}`;
    if (dryRun) {
      changed++;
      console.log(`  ~ ${id}  ${name} — would change ${from} → ${mins(value)}`);
      continue;
    }

    try {
      const res = await fetch(`https://api.retellai.com/update-agent/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ max_call_duration_ms: value }),
      });
      if (!res.ok) {
        failed++;
        console.error(`  ! ${id}  ${name} — ${res.status}: ${await res.text().catch(() => '<unreadable>')}`);
        continue;
      }
      changed++;
      console.log(`  ✓ ${id}  ${name} — ${from} → ${mins(value)}`);
    } catch (err) {
      // One bad agent must not abort the batch.
      failed++;
      console.error(`  ! ${id}  ${name} — ${err.message}`);
    }
  }

  console.log(
    `\n${dryRun ? 'Would change' : 'Changed'}: ${changed} · already correct: ${already} · failed: ${failed}`,
  );
  if (failed) process.exit(1);
}

main().catch((err) => fail('unhandled error', err));
