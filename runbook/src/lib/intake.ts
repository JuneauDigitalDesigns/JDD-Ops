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

/** Load + normalize clients/{slug}/site.ts into { plan, sites } (or null if unreadable). */
export async function loadIntake(schemaPath: string): Promise<RawIntake | null> {
  if (!existsSync(schemaPath)) return null;
  try {
    const src = readFileSync(schemaPath, 'utf8');
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
