'use client';

import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import { FONT_OPTIONS } from '@/lib/fonts';

// Typography editing. Unlike the palette pane, specimens here ARE warranted: they preview
// fonts and weights that are *not* currently applied, which the live preview to the left
// cannot show by definition.
//
// What actually reaches the live preview:
//   • fontSans  — yes. typographyVars() now sets font-family on the preview subtree itself;
//                 previously nothing claimed body text so it inherited the console's chrome
//                 font and picking a body font did nothing visible.
//   • fontHeading — yes, via catalog headings' `font-heading` class → var(--font-heading).
//   • headingWeight / tracking / lineHeight — only where a catalog component doesn't set its
//     own. Most do: hero H2s carry things like `font-bold leading-[0.95] tracking-[-0.03em]`,
//     and those utilities outrank the low-specificity .studio-chrome :where(h1..h6) rule.
//     That is deliberate — a hero's tight leading is a design decision, not an accident, and
//     forcing brand values over it with !important would wreck the catalog. These values
//     still export to site.ts regardless, so the sliders' own specimen below is the reliable
//     way to judge them.

const WEIGHTS = [300, 400, 500, 600, 700, 800] as const;
const SPECIMEN_FALLBACK = 'Aa Hamburgefons';

function str(content: SiteContent, path: string): string {
  const v = getPath(content, path);
  return v === null || v === undefined ? '' : String(v);
}

function num(content: SiteContent, path: string, fallback: number): number {
  const v = getPath(content, path);
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="field-label">{children}</p>;
}

function FontSpecimenList({
  content, setField, path, label, filter, specimen,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
  filter: 'sans' | 'heading'; specimen: string;
}) {
  const current = str(content, path);
  const opts = FONT_OPTIONS.filter((o) => o.role === 'both' || o.role === filter);
  return (
    <div>
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {opts.map((o) => {
          const selected = o.stack === current;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setField(path, o.stack)}
              aria-pressed={selected}
              className={[
                'block w-full rounded-md border px-2.5 py-2 text-left transition-colors',
                selected
                  ? 'border-uiAccent ring-1 ring-uiAccent'
                  : 'border-uiRule hover:border-uiRuleStrong',
              ].join(' ')}
            >
              <span className="font-chromeMono text-2xs uppercase tracking-widest text-uiFg3">
                {o.label}
              </span>
              <span
                className="mt-0.5 block truncate text-lg leading-tight text-uiFg"
                style={{ fontFamily: o.stack }}
              >
                {specimen}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeightPicker({
  content, setField, path, label, family,
}: {
  content: SiteContent; setField: SetField; path: string; label: string; family: string;
}) {
  const current = num(content, path, 400);
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {WEIGHTS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setField(path, w)}
            aria-pressed={current === w}
            // Each option renders at the weight it selects.
            style={{ fontFamily: family || undefined, fontWeight: w }}
            className={[
              'min-w-[42px] rounded border px-1.5 py-1 text-sm transition-colors',
              current === w
                ? 'border-uiAccent text-uiAccent ring-1 ring-uiAccent'
                : 'border-uiRule text-uiFg2 hover:border-uiRuleStrong',
            ].join(' ')}
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function TypographyPane({
  content, setField,
}: {
  content: SiteContent; setField: SetField;
}) {
  const headingFont = str(content, 'brand.typography.fontHeading');
  const bodyFont = str(content, 'brand.typography.fontSans');
  const specimen = str(content, 'brand.name').trim() || SPECIMEN_FALLBACK;

  // headingTracking is authored as a string with an em suffix ("-0.01em"); the slider is
  // numeric, so it must write the suffix back or the schema shape silently changes.
  const tracking = num(content, 'brand.typography.headingTracking', 0);
  const lineHeight = num(content, 'brand.typography.headingLineHeight', 1.2);
  const headingWeight = num(content, 'brand.typography.headingWeight', 700);

  return (
    <div className="space-y-5 px-4 py-4">
      <FontSpecimenList
        content={content} setField={setField}
        path="brand.typography.fontHeading" label="Heading font" filter="heading" specimen={specimen}
      />
      <FontSpecimenList
        content={content} setField={setField}
        path="brand.typography.fontSans" label="Body font" filter="sans" specimen={specimen}
      />

      <WeightPicker
        content={content} setField={setField}
        path="brand.typography.headingWeight" label="Heading weight" family={headingFont}
      />
      <WeightPicker
        content={content} setField={setField}
        path="brand.typography.bodyWeight" label="Body weight" family={bodyFont}
      />

      <div>
        <Label>Heading tracking · {tracking}em</Label>
        <input
          type="range"
          min={-0.06} max={0.12} step={0.005}
          value={tracking}
          onChange={(e) => setField('brand.typography.headingTracking', `${e.target.value}em`)}
          className="w-full accent-uiAccent"
        />
      </div>

      <div>
        <Label>Heading line-height · {lineHeight}</Label>
        <input
          type="range"
          min={0.9} max={1.8} step={0.05}
          value={lineHeight}
          onChange={(e) => setField('brand.typography.headingLineHeight', Number(e.target.value))}
          className="w-full accent-uiAccent"
        />
      </div>

      {/* A focused specimen — the live preview shows these in context, this shows them
          isolated. It needs no label; it demonstrates itself. */}
      <div className="rounded-md border border-uiRule p-3">
        <p
          className="text-uiFg"
          style={{
            fontFamily: headingFont || undefined,
            fontWeight: headingWeight,
            letterSpacing: `${tracking}em`,
            lineHeight,
            fontSize: 22,
          }}
        >
          {specimen}
        </p>
      </div>
    </div>
  );
}
