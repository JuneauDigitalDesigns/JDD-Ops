import { NextResponse } from 'next/server';
import { loadReconcileProbes } from '@/lib/reconcileProbes';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadManageTarget } from '@/lib/manageSites';
import { loadRetellApiKey } from '@/lib/opsSecrets';
import { appendAudit } from '@/lib/audit';

/**
 * Read and update a client's Retell agent prompt.
 *
 * Two facts drive the shape of this route:
 *
 * 1. The prompt lives on the agent's LLM, not the agent (retell-llm response engine —
 *    `general_prompt` passed to update-agent is ignored). So a push resolves the bound
 *    llm_id first. We prefer RETELL_LLM_ID from .env.local when onboard.js wrote one, and
 *    fall back to GET /get-agent — which is the path older clients actually take.
 *
 * 2. Disk is the source of truth for the editor, but GET now READS BACK from Retell as
 *    well and returns both. It used to write disk → Retell and never look the other way,
 *    so an edit made in the Retell dashboard was invisible here and would be silently
 *    overwritten by the next save. The editor shows the two side by side when they differ.
 *
 * Ports scripts/update-agent-prompt.js rather than shelling out to it: that script
 * resolves clients/{slug} against process.cwd() and pulls the key from `dotenv/config`,
 * neither of which holds inside a Next route running from console/.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RETELL_API = 'https://api.retellai.com';
const PROMPT_FILE = 'agent-prompt.txt';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const { ctx, resolved } = target;
  if (ctx.plan === 'starter') {
    return NextResponse.json({ error: 'Starter clients have no voice agent.' }, { status: 400 });
  }

  const path = resolve(resolved.dir, PROMPT_FILE);
  const exists = existsSync(path);
  const prompt = exists ? readFileSync(path, 'utf8') : '';

  /**
   * The prompt the agent is ACTUALLY answering with.
   *
   * Read-back was the documented gap in this editor: it wrote disk → Retell and never
   * looked the other way, so an edit made in the Retell dashboard was invisible here and
   * would be silently overwritten by the next save. The reconcile engine detects the drift,
   * but a finding that says "compare the two before you push" is useless without somewhere
   * to compare them — this is that somewhere.
   *
   * `?live=0` skips it. The editor asks for it on open; the save path does not need it and
   * should not pay two Retell round-trips for it.
   */
  let livePrompt: string | null = null;
  let liveError: string | null = null;

  if (url.searchParams.get('live') !== '0') {
    const agentId = resolved.env.RETELL_AGENT_ID;
    const apiKey = loadRetellApiKey();
    if (!agentId) liveError = 'No RETELL_AGENT_ID for this site.';
    else if (!apiKey) liveError = 'No RETELL_API_KEY in jdd-ops/.env.';
    else {
      try {
        const probes = await loadReconcileProbes();
        const probe = await probes.probeRetellAgent({
          apiKey,
          agentId,
          promptOnDisk: prompt,
          expectedWebhookUrl: null,
        });
        if (!probe.checked) liveError = 'Retell did not answer.';
        else if (probe.exists === false) liveError = `Retell does not recognise agent ${agentId}.`;
        else livePrompt = probe.livePrompt;
      } catch (err) {
        liveError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  return NextResponse.json({
    exists,
    prompt,
    agentId: resolved.env.RETELL_AGENT_ID ?? null,
    llmId: resolved.env.RETELL_LLM_ID ?? null,
    livePrompt,
    liveError,
    // Trimmed comparison, matching the probe: a trailing-newline difference between what
    // the editor wrote and what Retell stored is not drift anyone needs to see.
    inSync: livePrompt === null ? null : livePrompt.trim() === prompt.trim(),
  });
}

type PostBody = { slug?: string; site?: string; prompt?: string; push?: boolean };

/** Resolve the LLM the prompt actually lives on. */
async function resolveLlmId(
  agentId: string,
  known: string | undefined,
  headers: Record<string, string>,
): Promise<{ llmId: string } | { error: string }> {
  if (known) return { llmId: known };

  const res = await fetch(`${RETELL_API}/get-agent/${agentId}`, { headers, cache: 'no-store' });
  if (!res.ok) {
    return { error: `Retell get-agent ${agentId} returned ${res.status}.` };
  }
  const agent = (await res.json()) as { response_engine?: { llm_id?: string } };
  const llmId = agent.response_engine?.llm_id;
  if (!llmId) {
    return { error: `Agent ${agentId} is not backed by a retell-llm engine — can't update the prompt.` };
  }
  return { llmId };
}

export async function POST(req: Request) {
  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const target = await loadManageTarget(body.slug ?? null, body.site ?? null);
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });

  const { ctx, resolved } = target;
  if (ctx.plan === 'starter') {
    return NextResponse.json({ error: 'Starter clients have no voice agent.' }, { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) {
    return NextResponse.json({ error: 'Prompt is empty — refusing to write.' }, { status: 400 });
  }

  // Disk first, always: a push that fails must still leave the edit recoverable.
  const path = resolve(resolved.dir, PROMPT_FILE);
  try {
    writeFileSync(path, prompt, 'utf8');
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to write agent-prompt.txt' },
      { status: 500 },
    );
  }

  appendAudit({
    slug: ctx.slug,
    siteSlug: resolved.site.slug,
    action: 'agent.prompt.save',
    ok: true,
    summary: `Saved ${PROMPT_FILE} (${prompt.length.toLocaleString()} chars)`,
  });

  if (!body.push) {
    return NextResponse.json({ ok: true, saved: true, pushed: false, chars: prompt.length });
  }

  const apiKey = loadRetellApiKey();
  if (!apiKey) {
    return NextResponse.json({
      ok: true, // the disk write succeeded; only the push didn't happen
      saved: true,
      pushed: false,
      pushError: 'RETELL_API_KEY is not set in jdd-ops/.env — saved to disk only.',
    });
  }

  const agentId = resolved.env.RETELL_AGENT_ID;
  if (!agentId) {
    return NextResponse.json({
      ok: true,
      saved: true,
      pushed: false,
      pushError: 'No RETELL_AGENT_ID on this site — nothing to push to.',
    });
  }

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  try {
    const llm = await resolveLlmId(agentId, resolved.env.RETELL_LLM_ID, headers);
    if ('error' in llm) {
      appendAudit({
        slug: ctx.slug, siteSlug: resolved.site.slug, action: 'agent.prompt.push',
        ok: false, summary: llm.error,
      });
      return NextResponse.json({ ok: true, saved: true, pushed: false, pushError: llm.error });
    }

    const res = await fetch(`${RETELL_API}/update-retell-llm/${llm.llmId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ general_prompt: prompt }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      const message = `Retell update-retell-llm returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`;
      appendAudit({
        slug: ctx.slug, siteSlug: resolved.site.slug, action: 'agent.prompt.push',
        ok: false, summary: message,
      });
      return NextResponse.json({ ok: true, saved: true, pushed: false, pushError: message });
    }

    appendAudit({
      slug: ctx.slug,
      siteSlug: resolved.site.slug,
      action: 'agent.prompt.push',
      ok: true,
      summary: `Pushed prompt to Retell LLM ${llm.llmId}`,
      detail: { llmId: llm.llmId, agentId, chars: prompt.length },
    });
    return NextResponse.json({ ok: true, saved: true, pushed: true, llmId: llm.llmId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Retell push failed.';
    appendAudit({
      slug: ctx.slug, siteSlug: resolved.site.slug, action: 'agent.prompt.push',
      ok: false, summary: message,
    });
    return NextResponse.json({ ok: true, saved: true, pushed: false, pushError: message });
  }
}
