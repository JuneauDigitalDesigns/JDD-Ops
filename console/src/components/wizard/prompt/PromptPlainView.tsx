'use client';

/**
 * The compiled prompt, exactly as it will be sent to the model, read sideways.
 *
 * The text is the joined prompt, verbatim, as before: what the model receives is two strings, and
 * reviewing a prompt means reading the prompt. What changed (Xander, 2026-11-10, the approved
 * "Prompt v2" mockup) is how it fits the screen. It used to scroll down inside its pane, the one
 * place left in the intake that did. Now it flows into columns that fill the full width and run off
 * to the right: the mouse wheel moves it sideways, System prompt leaving to the left as User message
 * comes in from the right, and arrows at mid-height on either side move one column at a time.
 *
 * A trailing empty column is part of the flow, so the last column of text can always be moved out
 * from under the run box that floats in the bottom-right corner.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Copy } from '@phosphor-icons/react';
import { columnLayout, columnStep } from '@/lib/prompt-columns';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op, same as the JSON editor's copy */
    }
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 font-chromeMono text-2xs normal-case tracking-normal text-uiAccent transition-colors hover:text-uiInk"
    >
      {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />} {copied ? 'copied' : 'copy'}
    </button>
  );
}

/** Characters, not tokens. The real token count is the run box's cost estimate, which asks the
 *  server; this is just a size cue so a prompt that has quietly ballooned is visible. */
function sizeHint(text: string): string {
  const chars = text.length;
  return chars < 1000 ? `${chars} chars` : `${(chars / 1000).toFixed(1)}k chars`;
}

function PromptBlock({
  kicker, note, text, first,
}: {
  kicker: string;
  note: string;
  text: string;
  first?: boolean;
}) {
  return (
    // Each half starts at the top of a fresh column.
    <section style={first ? undefined : { breakBefore: 'column' }}>
      <div className="mb-1.5 flex flex-wrap items-baseline gap-3">
        <p className="kicker">{kicker}</p>
        <span className="font-chromeMono text-2xs text-uiFg3">{sizeHint(text)}</span>
        <CopyButton text={text} />
      </div>
      <p className="mb-3 text-2xs leading-relaxed text-uiInkSoft">{note}</p>
      {text.trim() ? (
        <pre className="whitespace-pre-wrap break-words font-chromeMono text-xs leading-relaxed text-uiFg">
          {text}
        </pre>
      ) : (
        <p className="rounded-lg border border-dashed border-uiCardRule p-4 text-xs italic text-uiFg3">
          Empty — every block feeding this half of the prompt is excluded.
        </p>
      )}
    </section>
  );
}

export default function PromptPlainView({ system, user }: { system: string; user: string }) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState(() => columnLayout(1296));
  const [edge, setEdge] = useState({ start: true, end: false });

  const readEdges = useCallback(() => {
    const t = trackRef.current;
    if (!t) return;
    const max = t.scrollWidth - t.clientWidth;
    setEdge({ start: t.scrollLeft <= 1, end: t.scrollLeft >= max - 1 });
  }, []);

  // Column count and width follow the track's width, so the columns always fill it exactly and
  // one arrow click lines the next column up with the left edge.
  useLayoutEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    const measure = () => { setLayout(columnLayout(t.clientWidth)); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(t);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { readEdges(); }, [layout, system, user, readEdges]);

  // The wheel moves the prompt sideways. React's onWheel is passive, so preventDefault needs a
  // native listener. A trackpad's own sideways swipe is left alone.
  useEffect(() => {
    const t = trackRef.current;
    if (!t) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      t.scrollLeft += e.deltaY;
    };
    t.addEventListener('wheel', onWheel, { passive: false });
    return () => t.removeEventListener('wheel', onWheel);
  }, []);

  const move = (dir: 1 | -1) => {
    const t = trackRef.current;
    if (!t) return;
    t.scrollTo({ left: columnStep(t.scrollLeft, layout, dir), behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <div className="relative h-full min-h-0">
      <div
        ref={trackRef}
        onScroll={readEdges}
        data-testid="prompt-track"
        className="no-scrollbar absolute inset-y-0 left-[72px] right-[72px] overflow-x-auto overflow-y-hidden"
      >
        <div
          className="h-full py-5"
          style={{
            columnWidth: `${layout.width}px`,
            columnGap: `${layout.gap}px`,
            columnFill: 'auto',
            columnRule: '1px solid var(--ui-card-rule, rgba(20,18,12,.1))',
          }}
        >
          <PromptBlock
            first
            kicker="System prompt"
            note="Sent once per request as the model's standing instructions — role, guardrails, forbidden words, output contract."
            text={system}
          />
          <PromptBlock
            kicker="User message"
            note="The per-run business message. Section instructions are sent two sections at a time; this shows the union of everything currently switched on, so a real request carries a subset of these lines."
            text={user}
          />
          {/* Room at the end, so the last column of text can move out from under the run box. */}
          <div aria-hidden style={{ breakBefore: 'column', height: 1 }} />
        </div>
      </div>

      <button
        type="button"
        aria-label="Previous column"
        onClick={() => move(-1)}
        disabled={edge.start}
        className="absolute left-4 top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full border border-uiCardRule bg-panel text-uiInk shadow-raised transition-opacity hover:border-uiAccent disabled:opacity-30"
      >
        <ArrowLeft size={18} />
      </button>
      <button
        type="button"
        aria-label="Next column"
        onClick={() => move(1)}
        disabled={edge.end}
        className="absolute right-4 top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 items-center justify-center rounded-full border border-uiCardRule bg-panel text-uiInk shadow-raised transition-opacity hover:border-uiAccent disabled:opacity-30"
      >
        <ArrowRight size={18} />
      </button>
    </div>
  );
}
