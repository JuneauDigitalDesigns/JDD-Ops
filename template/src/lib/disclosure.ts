'use client';
/**
 * The open/close behaviour the vertical navs share for their Services menu and phone menu
 * (Xander 2026-11-10: "Yes, build it", with a real phone menu). Each nav keeps its own markup and
 * styling; this owns only the behaviour, so all five behave the same:
 *   - the button carries aria-expanded / aria-controls; the panel is `hidden` when closed, so its
 *     links are still in the server HTML for crawlers;
 *   - opening from the button moves focus to the panel's first link;
 *   - Escape closes and returns focus to the button;
 *   - focus leaving the menu (tabbing out, clicking elsewhere) closes it;
 *   - `hover: true` also opens on pointer hover, without moving focus (the desktop dropdown).
 *
 * KEEP IN STEP: byte-identical in console/src/lib and template/src/lib
 * (console/test/service-pages.test.mjs).
 */
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react';

export function useDisclosure({ hover = false }: { hover?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [focusFirst, setFocusFirst] = useState(false);
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    setFocusFirst(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (open && focusFirst) panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
  }, [open, focusFirst]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const button = {
    ref: buttonRef,
    type: 'button' as const,
    'aria-expanded': open,
    'aria-controls': id,
    onClick: () => {
      if (open) return close(true);
      setFocusFirst(true);
      setOpen(true);
    },
  };
  const panel = { ref: panelRef, id, hidden: !open };
  const root = {
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        close(true);
      }
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      const next = e.relatedTarget as Node | null;
      if (open && next && !e.currentTarget.contains(next)) close(false);
    },
    ...(hover
      ? {
          onMouseEnter: () => {
            clearTimeout(timer.current);
            setOpen(true);
          },
          onMouseLeave: () => {
            timer.current = setTimeout(() => close(false), 120);
          },
        }
      : {}),
  };
  return { open, close, button, panel, root };
}
