'use client';

import { createContext, useContext } from 'react';
import type { ClientContext } from '@/lib/types';

/**
 * Client identity for everything under /c/[slug].
 *
 * The shell layout loads ClientContext on the server and provides it here, so switching
 * tools costs zero fetches for "who am I looking at" — only the tool's own data loads.
 * That, plus App Router keeping the layout mounted across sibling segments, is the whole
 * reason the three tools are route segments rather than a client-side switch.
 *
 * `tools` carries availability as plain booleans + strings rather than the ClientContext
 * predicates that produced them: isManageable() and unmanageableReason() live in
 * `manageSites.ts`, which starts with `import 'server-only'` and therefore cannot be
 * imported by ClientChrome. The server layout evaluates them and passes the answers down.
 */
export interface ToolState {
  enabled: boolean;
  /** Why it's unavailable — shown as the disabled tab's tooltip. Null when enabled. */
  reason: string | null;
}

export interface ToolAvailability {
  build: ToolState;
  onboard: ToolState;
  manage: ToolState;
}

interface ClientShellValue {
  ctx: ClientContext;
  tools: ToolAvailability;
}

const Ctx = createContext<ClientShellValue | null>(null);

export function useClient(): ClientShellValue {
  const value = useContext(Ctx);
  if (!value) throw new Error('useClient must be used inside <ClientProvider>');
  return value;
}

export function ClientProvider({
  ctx,
  tools,
  children,
}: ClientShellValue & { children: React.ReactNode }) {
  return <Ctx.Provider value={{ ctx, tools }}>{children}</Ctx.Provider>;
}
