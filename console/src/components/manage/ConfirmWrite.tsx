'use client';

import { useEffect } from 'react';
import type { EnvMode } from '@/lib/types';

export interface ConfirmWriteRequest {
  /** Short action name, e.g. "Attach portal account". */
  title: string;
  /** What will happen, in plain words. */
  effect: string;
  /** Client the write targets. */
  client: string;
  /** Optional extra line for destructive actions. */
  danger?: boolean;
}

/**
 * Shared confirm-before-write dialog for production/destructive actions. Rendered once by
 * ManageProvider; panels reach it through `useManage().confirmWrite(...)`, which resolves
 * true immediately when the console is wired to the test environment.
 */
export default function ConfirmWrite({
  request,
  envMode,
  onResolve,
}: {
  request: ConfirmWriteRequest;
  envMode: EnvMode;
  onResolve: (ok: boolean) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onResolve(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onResolve]);

  const label = envMode === 'mixed' ? 'MIXED ENVIRONMENT' : 'PRODUCTION';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-write-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(20, 18, 12, 0.45)' }}
      onClick={() => onResolve(false)}
    >
      <div
        className="w-full max-w-md rounded-lg border p-5"
        style={{
          background: 'var(--panel)',
          borderColor: request.danger || envMode === 'mixed' ? 'var(--danger)' : 'var(--rule-strong)',
          color: 'var(--fg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="text-[11px] font-semibold uppercase"
          style={{
            letterSpacing: 'var(--tracking-widest)',
            color: envMode === 'mixed' ? 'var(--danger)' : 'var(--warn)',
          }}
        >
          {label}, live customer data
        </p>
        <h2 id="confirm-write-title" className="mt-2 text-base font-semibold">
          {request.title}
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--fg-2)' }}>
          Client: <span className="font-mono" style={{ color: 'var(--fg)' }}>{request.client}</span>
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--fg-2)' }}>
          {request.effect}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onResolve(false)}
            className="rounded-md border px-3 text-sm"
            style={{
              height: 'var(--control-h)',
              borderColor: 'var(--rule-strong)',
              background: 'transparent',
              color: 'var(--fg)',
            }}
            autoFocus
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onResolve(true)}
            className="rounded-md px-3 text-sm font-medium"
            style={{
              height: 'var(--control-h)',
              background: request.danger ? 'var(--danger)' : 'var(--accent-2)',
              color: 'var(--on-accent-2)',
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
