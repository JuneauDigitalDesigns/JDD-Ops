import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plan, SiteEnv } from './types';

// ── Intake loading ──────────────────────────────────────────────────────────
// Mirrors onboard.js loadIntake: strip TS-only syntax and import the schema as a
// data: URL so we can read the same INTAKE/CONTENT the orchestrator reads. Pure
// read — no provisioning side effects.

/** Remove `interface … { … }` blocks honoring nested braces (copied from onboard.js). */
function stripInterfaceBlocks(src: string): string {
  const headerRe = /(?:export\s+)?interface\s+\w+[^{]*\{/g;
  let result = '';
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(src)) !== null) {
    const start = m.index;
    let depth = 0;
    let i = start + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    result += src.slice(lastIndex, start);
    lastIndex = i;
    headerRe.lastIndex = i;
  }
  result += src.slice(lastIndex);
  return result;
}

export interface RawSite {
  brand?: {
    name?: string;
    short?: string;
    palette?: Record<string, string>;
  };
  seo?: { canonical?: string };
  _meta?: { missing_fields?: string[]; missingFields?: string[]; selectedPlan?: Plan };
  [k: string]: unknown;
}

export interface RawIntake {
  plan: Plan;
  sites: RawSite[];
}

/**
 * Parse site.ts SOURCE (not a path) into { plan, sites }, or null if it can't be read.
 *
 * Split out from loadIntake because the deploy diff needs to parse the version of site.ts
 * that is COMMITTED — read via `git show origin/<branch>:src/data/site.ts` — which never
 * exists as a file on disk. The on-disk loader below is now just this plus a read.
 */
export async function parseIntakeSource(src: string): Promise<RawIntake | null> {
  try {
    const stripped = stripInterfaceBlocks(src)
      .replace(/:\s*SiteContent/g, '')
      .replace(/:\s*Intake/g, '')
      .replace(/^import .*$/gm, '')
      .replace(/^export type .*?;$/gms, '');
    const dataUrl = 'data:text/javascript;base64,' + Buffer.from(stripped).toString('base64');
    const mod = await import(/* webpackIgnore: true */ dataUrl);
    if (mod.INTAKE) return mod.INTAKE as RawIntake;
    if (mod.CONTENT) {
      const plan: Plan = mod.CONTENT?._meta?.selectedPlan ?? 'growth';
      return { plan, sites: [mod.CONTENT as RawSite] };
    }
    return null;
  } catch {
    return null;
  }
}

/** Load + normalize clients/{slug}/site.ts into { plan, sites } (or null if unreadable). */
export async function loadIntake(schemaPath: string): Promise<RawIntake | null> {
  if (!existsSync(schemaPath)) return null;
  try {
    return await parseIntakeSource(readFileSync(schemaPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Stamp the loaded client's plan onto the seed's `_meta.selectedPlan`, so the studio's
 * buildCategories() can auto-detect starter vs growth/enterprise and show the right
 * lead-capture components. loadIntake reports `plan` alongside the sites rather than
 * inside them, so a seed handed straight to the wizard would otherwise lose its tier.
 *
 * Returns RawSite; callers hand the result to the studio as SiteContent, which is the
 * same cast /api/build/load-client's consumer used to do.
 */
export function withPlan(seed: RawSite | null, plan: unknown): RawSite | null {
  if (!seed) return seed;
  if (plan !== 'starter' && plan !== 'growth' && plan !== 'enterprise') return seed;
  return { ...seed, _meta: { ...seed._meta, selectedPlan: plan } };
}

// ── .env.local parsing (mirrors onboard.js readEnvLocal) ─────────────────────
export function readEnvLocal(dir: string): SiteEnv {
  const envPath = resolve(dir, '.env.local');
  if (!existsSync(envPath)) return {};
  const out: SiteEnv = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (val) out[key] = val;
  }
  return out;
}
