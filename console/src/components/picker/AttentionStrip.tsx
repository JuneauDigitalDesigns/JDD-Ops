'use client';

import Link from 'next/link';
import { Warning } from '@phosphor-icons/react';
import type { AttentionItem } from '@/lib/attention';

/**
 * What's wrong right now, above everything else.
 *
 * Renders NOTHING when nothing is wrong. That is the whole design: a permanent "all good"
 * panel would spend the top of the screen every single day reporting the normal case, and
 * within a week you'd stop reading the area entirely — which is exactly when you need it to
 * catch your eye. Quiet by default, loud when it matters.
 *
 * Rows link to /c/{slug} rather than to a specific tool: the client shell already routes to
 * whichever tool suits the client's state, and a down site could need Manage or a redeploy.
 */
export default function AttentionStrip({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;

  return (
    <section
      className="border-b px-6 py-4 md:px-10"
      style={{ borderColor: 'var(--warn)', background: 'var(--warn-glow)' }}
      aria-label="Needs attention"
    >
      <div className="mx-auto w-full max-w-[980px]">
        <div className="mb-2 flex items-center gap-2">
          <Warning size={14} weight="fill" style={{ color: 'var(--warn)' }} />
          <h2 className="kicker" style={{ color: 'var(--warn)' }}>
            Needs attention · {items.length}
          </h2>
        </div>

        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/c/${item.slug}`}
                className="group flex items-baseline gap-2 text-sm transition-colors"
              >
                <span className="font-display font-medium text-fg transition-colors group-hover:text-accent">
                  {item.brandName}
                </span>
                <span
                  className="text-xs"
                  style={{ color: item.kind === 'down' ? 'var(--danger)' : 'var(--fg-2)' }}
                >
                  {item.reason}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
