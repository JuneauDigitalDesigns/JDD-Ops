'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// A small panel pinned beside an anchor rect, closing on outside-click, Escape, and scroll.
// Positioning mirrors StyleToolbar (which anchors to a focused <E> rect) so the studio has
// ONE way to float a panel next to something, not several. Rendered in a portal on <body>
// so an ancestor's overflow/transform can't clip or mis-position it.
//
// Shared by the nav-link section picker and the icon picker.
export default function AnchoredPopover({
  rect,
  onClose,
  children,
  width = 260,
  align = 'left',
}: {
  /** The element to anchor to, in viewport coords (getBoundingClientRect()). */
  rect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  /** Which edge of the panel aligns to the anchor's left edge. */
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    // A scroll moves the anchor out from under us; the rect would go stale, so close.
    function onScroll() {
      onClose();
    }
    window.addEventListener('keydown', onKey);
    // Capture phase so a click inside a scroll container still counts as outside.
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  // Prefer below the anchor; flip above if it would overflow the viewport bottom.
  const gap = 6;
  const estHeight = 320;
  const below = rect.bottom + gap;
  const top = below + estHeight > window.innerHeight ? Math.max(12, rect.top - gap - estHeight) : below;
  const rawLeft = align === 'right' ? rect.right - width : rect.left;
  const left = Math.min(Math.max(rawLeft, 12), window.innerWidth - width - 12);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={{ position: 'fixed', top, left, width, zIndex: 80 }}
      className="max-h-[320px] overflow-y-auto rounded-xl border border-rule bg-panel p-2 shadow-overlay"
    >
      {children}
    </div>,
    document.body,
  );
}
