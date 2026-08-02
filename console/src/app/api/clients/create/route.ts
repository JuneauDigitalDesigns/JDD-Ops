import { NextResponse } from 'next/server';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveRepoRoot, isValidSlug, writeClientIntake, type IntakeEnvelope } from '@/lib/export';
import { VERTICAL_PRESETS, type VerticalId } from '@/lib/verticals';

// Create a client folder by hand — the escape hatch for someone who never completed signup
// and so never reached the KV intake queue. The client picker requires a client to exist on
// disk before it can be selected, so this writes clients/<slug>/site.ts immediately.
//
// Seeded from the vertical preset the build wizard would have loaded anyway, which is what
// makes the file a valid SiteContent from the first write rather than a stub the studio
// would have to defend against.
//
// Per CLAUDE.md we never invent values: the only field supplied is brand.name (typed by the
// operator). Everything else keeps its preset placeholder and stays listed in
// _meta.missing_fields — inherited from the preset, minus brand.name — so the intake step
// surfaces exactly what still needs a real answer.
export const dynamic = 'force-dynamic';

const PLANS = ['starter', 'growth', 'enterprise'] as const;
type PlanId = (typeof PLANS)[number];

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const slug = String(body.slug ?? '').trim();
    const name = String(body.name ?? '').trim();
    const plan = body.plan as PlanId;
    const vertical = body.vertical as VerticalId;

    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'Invalid slug — letters, numbers, - and _ only.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Display name is required.' }, { status: 400 });
    }
    if (!PLANS.includes(plan)) {
      return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
    }
    const preset = VERTICAL_PRESETS[vertical];
    if (!preset) {
      return NextResponse.json({ error: 'Unknown vertical.' }, { status: 400 });
    }

    const repoRoot = resolveRepoRoot();
    if (existsSync(resolve(repoRoot, 'clients', slug, 'site.ts'))) {
      return NextResponse.json(
        { error: `clients/${slug}/site.ts already exists — pick another slug.` },
        { status: 409 },
      );
    }

    const envelope: IntakeEnvelope = {
      plan,
      siteCount: 1,
      sites: [
        {
          ...preset,
          brand: { ...preset.brand, name, short: name },
          _meta: {
            ...preset._meta,
            generated_at: new Date().toISOString(),
            selectedPlan: plan,
            // brand.name is the one thing the operator just supplied.
            missing_fields: preset._meta.missing_fields.filter((f) => f !== 'brand.name'),
          },
        },
      ],
    };

    writeClientIntake(repoRoot, slug, envelope);
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not create client.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
