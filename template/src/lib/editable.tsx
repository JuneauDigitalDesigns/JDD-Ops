// No-op passthrough of the studio's inline-editing primitive.
//
// Catalog component source (copied verbatim from the studio at export time) imports
// `E` / `useEditing` / `EditProvider` from `@/lib/editable`. In a client repo there is no
// editing UI, so these resolve to inert versions: <E> renders its children, useEditing() is
// always false, and <EditProvider> is a fragment. This keeps the copied components building
// unchanged without shipping any editing scaffolding to the live site.

import type { ReactNode } from 'react';

export function E({ children }: { p?: string; children: ReactNode; fit?: boolean }) {
  return <>{children}</>;
}

export function useEditing(): boolean {
  return false;
}

export function EditProvider({ children }: { setField?: unknown; children: ReactNode }) {
  return <>{children}</>;
}
