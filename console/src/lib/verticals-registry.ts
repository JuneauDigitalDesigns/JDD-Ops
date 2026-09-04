import 'server-only';
import { existsSync, readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILT_IN_VERTICALS, mergeVerticalOverrides, type VerticalDef, type VerticalOverrides } from '@jdd/schema';

/**
 * Server-only layer over @jdd/schema's BUILT_IN_VERTICALS — reads console/.state/verticals.json
 * (the operator's per-machine edits + custom verticals) and merges it in.
 *
 * Deliberately NOT in lib/verticals.ts: that module is imported by 'use client' components
 * (VerticalPicker.tsx, BuildWizard.tsx) and gets bundled for the browser, where node:fs
 * cannot run. This file is for API routes and server components only — the same convention
 * lib/audit.ts and lib/state.ts already use for their own `.state/*.json` files
 * (resolve(process.cwd(), '.state'), gitignored via **\/.state/).
 */
const STATE_DIR = resolve(process.cwd(), '.state');
const VERTICALS_FILE = resolve(STATE_DIR, 'verticals.json');

function readOverrides(): VerticalOverrides | null {
  try {
    if (!existsSync(VERTICALS_FILE)) return null;
    return JSON.parse(readFileSync(VERTICALS_FILE, 'utf8')) as VerticalOverrides;
  } catch {
    return null;
  }
}

/** Atomic write: tmp then rename, matching lib/state.ts's writeState pattern. */
export function writeVerticalOverrides(overrides: VerticalOverrides): void {
  mkdirSync(STATE_DIR, { recursive: true });
  const tmp = resolve(STATE_DIR, `verticals.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(overrides, null, 2), 'utf8');
  renameSync(tmp, VERTICALS_FILE);
}

/** The six built-ins, with any operator overrides applied, plus any custom verticals. */
export function resolveVerticals(): VerticalDef[] {
  return mergeVerticalOverrides(BUILT_IN_VERTICALS, readOverrides());
}

/** Just the ids — what export/route.ts and clients/create/route.ts validate a vertical against. */
export function resolveVerticalIds(): string[] {
  return resolveVerticals().map((v) => v.id);
}

export function resolveVertical(id: string): VerticalDef | undefined {
  return resolveVerticals().find((v) => v.id === id);
}
