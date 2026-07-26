'use client';
// Ambient per-client context for block renderers.
//
// BlockView is shared by /onboard (per-client runbook) and /setup (Part A, static and
// client-agnostic). The new `diagram` block needs the client's env values to bind its nodes,
// but threading `ctx` through BlockView's props would force /setup to invent a fake one.
// So: an optional context. /onboard provides it; /setup doesn't, and BlockView's diagram case
// renders nothing rather than crashing. Part A emits no diagram blocks, so that path is
// unreachable today — this just keeps it honest if someone adds one.

import { createContext, useContext } from 'react';
import type { RunState } from '@/lib/onboard-parse';
import type { ClientContext, OpsConfig } from '@/lib/types';

export interface RunbookCtxValue {
  ctx: ClientContext;
  config: OpsConfig;
  /** The in-flight (or last) provisioning run, if any — the pipeline diagram binds to this. */
  run: RunState | null;
  running: boolean;
}

const Ctx = createContext<RunbookCtxValue | null>(null);

export const RunbookProvider = Ctx.Provider;

/** Null outside a per-client runbook (i.e. on /setup). Callers must handle null. */
export function useRunbookCtx(): RunbookCtxValue | null {
  return useContext(Ctx);
}
