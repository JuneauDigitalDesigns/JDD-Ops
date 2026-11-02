'use client';

/**
 * The compiled prompt, exactly as it will be sent to the model.
 *
 * Replaces AnnotatedPromptDocument, which rendered the prompt as a table of labelled
 * paragraph rows. That made each block's contribution traceable but misrepresented the
 * artefact: what the model receives is two strings, and a reader scanning a two-column grid of
 * boxed segments cannot tell how those strings actually read — where a paragraph break falls,
 * whether a sentence lands twice, whether the whole thing is coherent top to bottom. Reviewing
 * a prompt means reading the prompt.
 *
 * So this is the joined text, verbatim, in a <pre>. The per-segment jump-back links are gone;
 * the Brief stepper is how you get to a block now, and it is one click away. Copy buttons are
 * here because the obvious next move after reading a prompt you distrust is to try it
 * somewhere else.
 */
import { useCallback, useState } from 'react';
import { Check, Copy } from '@phosphor-icons/react';

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
      className="inline-flex items-center gap-1 font-chromeMono text-2xs text-uiInkSoft transition-colors hover:text-uiInk"
    >
      {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />} {copied ? 'copied' : 'copy'}
    </button>
  );
}

/** Characters, not tokens. The real token count is the Prompt stage's cost estimate, which
 *  asks the server; this is just a size cue so a prompt that has quietly ballooned is visible. */
function sizeHint(text: string): string {
  const chars = text.length;
  return chars < 1000 ? `${chars} chars` : `${(chars / 1000).toFixed(1)}k chars`;
}

function PromptBlock({
  kicker, note, text,
}: {
  kicker: string;
  note: string;
  text: string;
}) {
  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="kicker">{kicker}</p>
        <div className="flex items-center gap-3">
          <span className="font-chromeMono text-2xs text-uiFg3">{sizeHint(text)}</span>
          <CopyButton text={text} />
        </div>
      </div>
      <p className="mb-2 text-2xs leading-relaxed text-uiInkSoft">{note}</p>
      {text.trim() ? (
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-uiCardRule bg-uiBg p-4 font-chromeMono text-xs leading-relaxed text-uiFg shadow-raised">
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
  return (
    <div className="space-y-8">
      <PromptBlock
        kicker="System prompt"
        note="Sent once per request as the model's standing instructions — role, guardrails, forbidden words, output contract."
        text={system}
      />
      <PromptBlock
        kicker="User message"
        note="The per-run business message. Section instructions are sent two sections at a time; this shows the union of everything currently ticked, so a real request carries a subset of these lines."
        text={user}
      />
    </div>
  );
}
