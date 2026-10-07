'use client';
// ─────────────────────────────────────────────────────────────────────────────
// StickyCallBar — the highest-ROI conversion element (decision 27), so it gets the
// most design attention of anything on the site. Mobile only: the nav already
// carries a tappable number at every breakpoint (SPEC §4), so a desktop duplicate
// is noise. It shows the DIGITS, not the word "Call" (the number is itself a trust
// signal), with a short assurance line beneath, on a 56px minimum tap target.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';

export default function StickyCallBar({
  phone,
  phoneHref,
  assurance = null,
  badge = null,
}: {
  phone: string;
  phoneHref: string;
  assurance?: string | null;
  badge?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  const [reduce, setReduce] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(0);

  // Appear only after the hero has scrolled past: one IntersectionObserver on `#top`
  // (the id HeroSplit sets on its <section>), never a scroll listener. If `#top` is
  // absent (a hero variant without that id), fall back to always-visible so the bar
  // can never silently disappear.
  useEffect(() => {
    setReduce(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const top = document.getElementById('top');
    if (!top) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting), { threshold: 0 });
    io.observe(top);
    return () => io.disconnect();
  }, []);

  // Measure our own height so the sibling spacer can reserve exactly that much at the
  // bottom of <body>, keeping the bar from ever covering the footer's last row.
  useEffect(() => {
    if (barRef.current) setBarH(barRef.current.offsetHeight);
  }, [assurance, badge, visible]);

  // A client mid-intake with no phone yet must not ship a dead tel: link.
  if (!phoneHref) return null;

  // Urgency tone (a fixed alert red) only when the badge reads as availability.
  // Otherwise neutral: --urgent is never decorative (SPEC §2).
  const urgent = !!badge && /24\s*\/?\s*7|open now|same[-\s]?day|emergency/i.test(badge);

  return (
    <>
      {/* Spacer: reserves the bar's height at the end of <body> while it is visible. */}
      <div aria-hidden className="lg:hidden" style={{ height: visible ? barH : 0 }} />
      <div
        ref={barRef}
        role="region"
        aria-label="Call us"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-rule bg-bg shadow-[0_-10px_30px_-14px_rgba(28,16,9,0.35)] lg:hidden"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          // Entrance is one CSS transform transition, disabled under reduced motion
          // (then the bar simply appears). No stillFor here: that takes a SkinId and
          // this element has no skin.
          transition: reduce ? 'none' : 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
          {badge && (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-fine font-bold"
              style={
                urgent
                  ? { color: 'var(--urgent)', borderColor: 'var(--urgent)' }
                  : { color: 'var(--ink-soft)', borderColor: 'var(--rule)' }
              }
            >
              {badge}
            </span>
          )}
          <a
            href={phoneHref}
            aria-label={`Call ${phone}`}
            className="ml-auto flex min-h-[56px] flex-col justify-center rounded-control bg-accent px-5 py-2 text-accentFg shadow-slab"
          >
            <span className="text-lead font-extrabold leading-none tracking-[-0.01em]">{phone}</span>
            {assurance && <span className="mt-0.5 text-fine leading-tight">{assurance}</span>}
          </a>
        </div>
      </div>
    </>
  );
}
