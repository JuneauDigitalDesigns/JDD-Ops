'use client';

import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import { contrast, readableOn } from '@/lib/palette';

// Palette editing. Deliberately has NO preview card of its own: <main> to the left already
// renders the real site under paletteVars(effective.brand), so a miniature duplicate here
// would be redundant and less honest than the actual page. This pane is swatches only.

const TOKENS = [
  { path: 'brand.palette.accent', label: 'Accent' },
  { path: 'brand.palette.accentFg', label: 'Accent text' },
  { path: 'brand.palette.bg', label: 'Background' },
  { path: 'brand.palette.bgSoft', label: 'Background soft' },
  { path: 'brand.palette.ink', label: 'Ink' },
  { path: 'brand.palette.inkSoft', label: 'Ink soft' },
  { path: 'brand.palette.rule', label: 'Rule / border' },
] as const;

function str(content: SiteContent, path: string): string {
  const v = getPath(content, path);
  return v === null || v === undefined ? '' : String(v);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** AA readout for a fg/bg pairing. Amber below 4.5:1. */
function ContrastNote({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  if (!HEX.test(fg) || !HEX.test(bg)) return null;
  const ratio = contrast(fg, bg);
  const pass = ratio >= 4.5;
  return (
    <p
      className={[
        'mt-1 font-chromeMono text-kicker',
        pass ? 'text-uiFg3' : 'rounded bg-amber-100 px-1 py-0.5 text-amber-800',
      ].join(' ')}
    >
      {label} {ratio.toFixed(1)}:1 {pass ? 'AA' : 'below AA'}
    </p>
  );
}

function Swatch({
  content, setField, path, label, action,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
  action?: { label: string; onClick: () => void };
}) {
  const val = str(content, path);
  const safe = HEX.test(val) ? val : '#000000';
  return (
    <div className="rounded-lg border border-uiRule p-2.5 transition-colors hover:border-uiAccent/50">
      {/* The whole swatch is the picker — the native input sits transparent on top, so the
          gesture is "click the colour", not "type a hex code". */}
      <div className="relative h-16 w-full overflow-hidden rounded-md border border-uiRuleStrong">
        <div className="absolute inset-0" style={{ backgroundColor: safe }} />
        <input
          type="color"
          value={safe}
          onChange={(e) => setField(path, e.target.value)}
          aria-label={label}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="truncate text-label font-medium text-uiFg2">{label}</span>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="shrink-0 rounded border border-uiRuleStrong px-1.5 py-0.5 text-2xs font-medium text-uiFg2 hover:border-uiAccent hover:text-uiAccent"
          >
            {action.label}
          </button>
        )}
      </div>
      {/* Hex stays available for exact values, but it is now the secondary affordance. */}
      <input
        type="text"
        value={val}
        onChange={(e) => setField(path, e.target.value)}
        aria-label={`${label} hex`}
        data-field-path={path}
        className="mt-0.5 w-full bg-transparent font-chromeMono text-xs text-uiFg3 outline-none focus:text-uiAccent"
      />
    </div>
  );
}

export default function PalettePane({
  content, setField,
}: {
  content: SiteContent; setField: SetField;
}) {
  const accent = str(content, 'brand.palette.accent');
  const accentFg = str(content, 'brand.palette.accentFg');
  const ink = str(content, 'brand.palette.ink');
  const bg = str(content, 'brand.palette.bg');

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="grid grid-cols-2 gap-2">
        {TOKENS.map((t) => (
          <Swatch
            key={t.path}
            content={content}
            setField={setField}
            path={t.path}
            label={t.label}
            action={
              t.path === 'brand.palette.accentFg' && HEX.test(accent)
                ? {
                    label: 'Auto',
                    // Same derivation paletteVars() falls back to when accentFg is unset.
                    onClick: () => setField(t.path, readableOn(accent, HEX.test(ink) ? ink : undefined)),
                  }
                : undefined
            }
          />
        ))}
      </div>

      <div className="rounded-lg border border-uiRule px-3 py-2">
        <p className="kicker">Contrast</p>
        <ContrastNote fg={accentFg} bg={accent} label="Accent text on accent" />
        <ContrastNote fg={ink} bg={bg} label="Ink on background" />
      </div>
    </div>
  );
}
