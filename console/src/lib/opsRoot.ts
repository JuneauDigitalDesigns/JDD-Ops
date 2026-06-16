import 'server-only';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Walk up from the app's cwd until we find the jdd-ops root — the directory that holds
// onboard.js (alongside clients/ and template/). Depth-independent: the unified console
// app resolves the same root no matter where it sits under jdd-ops, so neither the studio
// nor the runbook code has to hard-code how many "../" levels deep it lives.
export function findOpsRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'onboard.js'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate the jdd-ops root (no onboard.js found walking up from ${start}). ` +
      `Run the console from inside the jdd-ops tree.`,
  );
}
