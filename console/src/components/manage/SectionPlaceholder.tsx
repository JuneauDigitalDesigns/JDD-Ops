'use client';

import { Lock } from '@phosphor-icons/react';

export default function SectionPlaceholder({ title, message }: { title: string; message?: string }) {
  return (
    <div className="mx-auto w-full max-w-[900px] px-8 py-16 lg:px-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: 'var(--surface)', color: 'var(--fg-3)' }}
        >
          <Lock size={22} weight="fill" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-display text-base font-semibold text-fg">{title}</p>
          <p className="text-xs text-fg3">
            {message ?? 'Available once the client completes onboarding.'}
          </p>
        </div>
      </div>
    </div>
  );
}
