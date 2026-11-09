import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadManageTarget } from '@/lib/manageSites';
import { loadMasterLlmId, loadRetellApiKey } from '@/lib/opsSecrets';
import { appendAudit } from '@/lib/audit';
import { loadAiStatement } from '@/lib/aiStatement';
import { ensureBaseline, recordPromptVersion } from '@/lib/promptVersions';

/**
 * The per-client AI statement: a client who asks in writing has their agent say it's an AI near
 * the start of each call (contract v5.4). All the rules live in lib/ai-statement.js, shared with
 * the CLI and onboard.js; this route resolves the client, and records what happened.
 *
 * GET reads where the agent stands; with `want=on|off` it also returns the exact change.
 * POST applies a change the operator has seen, named by the hash of the live prompt in that view.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEB_ONLY = 'This client declined the receptionist — no voice agent.';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = await loadManageTarget(url.searchParams.get('slug'), url.searchParams.get('site'));
  if (!target.ok) return NextResponse.json({ error: target.error }, { status: target.status });
  const { ctx, resolved } = target;
  if (ctx.isWebOnly) return NextResponse.json({ error: WEB_ONLY }, { status: 400 });

  const param = url.searchParams.get('want');
  const mod = await loadAiStatement();
  const result = await mod.previewAiStatement({
    apiKey: loadRetellApiKey(),
    agentId: resolved.env.RETELL_AGENT_ID,
    masterLlmId: loadMasterLlmId(),
    dir: resolved.dir,
    fallbackBusiness: resolved.site.brandName,
    want: param === 'on' ? true : param === 'off' ? false : null,
  });
  return NextResponse.json(result);
}

type PostBody = { slug?: string; site?: string; enabled?: boolean; expectedHash?: string };

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
  if (ctx.isWebOnly) return NextResponse.json({ error: WEB_ONLY }, { status: 400 });
  if (typeof body.enabled !== 'boolean' || typeof body.expectedHash !== 'string') {
    return NextResponse.json({ error: 'Expected { enabled, expectedHash }.' }, { status: 400 });
  }

  // Keep the file's current text before anything can change it, as the editor's save does.
  const promptPath = resolve(resolved.dir, 'agent-prompt.txt');
  try {
    if (existsSync(promptPath)) {
      ensureBaseline({ slug: ctx.slug, siteSlug: resolved.site.slug, diskContent: readFileSync(promptPath, 'utf8') });
    }
  } catch {
    // A failed baseline must not block the change.
  }

  const audit = { slug: ctx.slug, siteSlug: resolved.site.slug, action: 'agent.ai_statement' as const };
  const verb = body.enabled ? 'on' : 'off';
  try {
    const mod = await loadAiStatement();
    const result = await mod.applyAiStatement({
      apiKey: loadRetellApiKey(),
      agentId: resolved.env.RETELL_AGENT_ID,
      masterLlmId: loadMasterLlmId(),
      dir: resolved.dir,
      fallbackBusiness: resolved.site.brandName,
      enabled: body.enabled,
      expectedHash: body.expectedHash,
    });
    if (!result.ok) {
      appendAudit({ ...audit, ok: false, summary: `AI statement not turned ${verb}: ${result.reason}` });
      return NextResponse.json(result, { status: 409 });
    }
    if (result.disk.content !== null && result.disk.changed) {
      recordPromptVersion({
        slug: ctx.slug,
        siteSlug: resolved.site.slug,
        trigger: result.liveInSyncWithDisk ? 'pushed' : 'saved',
        content: result.disk.content,
      });
    }
    appendAudit({
      ...audit,
      ok: true,
      summary: `AI statement turned ${verb} (Retell LLM ${result.llmId})${result.changed ? '' : ', the prompt already matched'}`,
      detail: {
        enabled: result.enabled,
        agentId: result.agentId,
        llmId: result.llmId,
        charsBefore: result.charsBefore,
        charsAfter: result.charsAfter,
        diskChanged: result.disk.changed,
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'AI statement change failed.';
    appendAudit({ ...audit, ok: false, summary: `AI statement not turned ${verb}: ${reason}` });
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }
}
