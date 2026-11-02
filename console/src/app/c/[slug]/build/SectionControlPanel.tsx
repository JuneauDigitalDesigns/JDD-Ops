'use client';

// The per-section control center. Opens on a ~3s hover-dwell over a section in the live preview
// (see SectionShell in PageStudio) and is that section's full editing surface: palette (accent +
// background as an OVERRIDE LAYER on the global brand), typography (heading weight + section scale),
// surface skin, variant swap, and resets.
//
// Rendered INSIDE the preview iframe (it's part of the portaled editable node tree), so it uses the
// same chrome utility classes the iframe already carries (bg-panel, border-rule, …) and positions
// itself absolutely within the section wrapper — never a window-fixed popover, whose coordinates
// would be wrong across the iframe boundary.
//
// WRITE DISCIPLINE: every change writes the WHOLE `sectionStyles.<key>` object via setField, never a
// leaf path. setField only strips descendant edits for array writes, so a leaf-path write could be
// resurrected by a stale key after a reset. Whole-object writes also cleanly override an imported
// value on a re-opened client. See BuildWizard.setField / lib/merge.

import { useMemo } from 'react';
import { X, ArrowCounterClockwise } from '@phosphor-icons/react';
import { PALETTE_PRESETS } from '@jdd/schema';
import type { SiteContent, SectionStyle } from '@/data/site';
import type { SkinId } from '@/lib/skins';
import { getPath } from '@/lib/merge';
import type { VariantEntry } from './categories';

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Distinct accent swatches from the named presets (deduped, brand accent pinned first). */
function accentPresets(brandAccent: string): string[] {
  const out: string[] = [];
  const push = (h: string) => { if (HEX.test(h) && !out.includes(h)) out.push(h); };
  push(brandAccent);
  for (const p of PALETTE_PRESETS) push(p.source.accent);
  return out.slice(0, 8);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-2xs font-medium uppercase tracking-wide text-fg3">{label}</span>
      {children}
    </div>
  );
}

/** One palette slot: preset strip + freeform picker + hex + revert-to-global. */
function SlotEditor({
  label, value, global, presets, onChange, onClear,
}: {
  label: string;
  value: string | undefined;      // the per-section override, if any
  global: string;                 // the inherited global value (shown when unset)
  presets: string[];
  onChange: (hex: string) => void;
  onClear: () => void;
}) {
  const shown = value && HEX.test(value) ? value : (HEX.test(global) ? global : '#000000');
  return (
    <Row label={label}>
      <div className="flex flex-wrap gap-1">
        {presets.map((hex) => (
          <button
            key={hex}
            type="button"
            title={hex}
            onClick={() => onChange(hex)}
            className={[
              'h-5 w-5 rounded-full border transition-transform hover:scale-110',
              value && value.toLowerCase() === hex.toLowerCase() ? 'border-fg ring-1 ring-fg' : 'border-rule',
            ].join(' ')}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="relative h-6 w-6 overflow-hidden rounded border border-rule">
          <span className="absolute inset-0" style={{ backgroundColor: shown }} />
          <input
            type="color"
            value={shown}
            onChange={(e) => onChange(e.target.value)}
            aria-label={label}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <input
          type="text"
          value={value ?? ''}
          placeholder={`${global} (global)`}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 bg-transparent font-chromeMono text-xs text-fg2 outline-none placeholder:text-fg3/60 focus:text-accent"
        />
        {value !== undefined && (
          <button type="button" onClick={onClear} title="Revert to global" className="rounded p-0.5 text-fg3 hover:text-fg">
            <ArrowCounterClockwise size={12} />
          </button>
        )}
      </div>
    </Row>
  );
}

export default function SectionControlPanel({
  content, styleKey, variantName, category, activeSkin,
  setField, onSetSkin, onSetVariant, onClose,
  onPointerEnter, onPointerLeave,
}: {
  content: SiteContent;
  styleKey: string;
  variantName: string;
  category?: { label: string; variants: VariantEntry[] };
  activeSkin: SkinId;
  setField: (path: string, value: unknown) => void;
  onSetSkin: (skin: SkinId) => void;
  onSetVariant: (name: string) => void;
  onClose: () => void;
  /** Optional keep-alive hooks. Usually unneeded: the panel renders as a descendant of the
   *  SectionShell wrapper, so that wrapper's pointerleave doesn't fire while the pointer is over
   *  the panel. Kept for callers that anchor the panel outside the section's subtree. */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  const cur = (getPath(content, `sectionStyles.${styleKey}`) as SectionStyle | undefined) ?? {};
  const palette = content.brand.palette;

  const accents = useMemo(() => accentPresets(palette.accent), [palette.accent]);
  const accent2s = useMemo(() => accentPresets(palette.accent2 ?? palette.accent), [palette.accent2, palette.accent]);

  // Retained for the skin/variant rows below, which are gated off (category is not passed) now
  // that whole-site templates own structure — a section's only per-section edit is its accent.
  const variant = category?.variants.find((v) => v.name === variantName);
  const skins = variant?.skins ?? [];

  // Whole-object write — the one edit key per section. Undefined slots are pruned so the object
  // shrinks back toward {} as slots are reverted.
  const write = (patch: Partial<SectionStyle>) => {
    const next: SectionStyle = { ...cur, ...patch };
    (Object.keys(next) as (keyof SectionStyle)[]).forEach((k) => {
      if (next[k] === undefined || next[k] === '') delete next[k];
    });
    setField(`sectionStyles.${styleKey}`, next);
  };

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="pointer-events-auto absolute right-3 top-3 z-30 max-h-[520px] w-[248px] overflow-y-auto rounded-xl border border-rule bg-panel/95 p-3 text-fg shadow-floating backdrop-blur"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-fg">{category?.label ?? 'Section'}</span>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-0.5 text-fg3 hover:text-fg">
          <X size={14} />
        </button>
      </div>

      <div className="space-y-3">
        <SlotEditor
          label="Accent" value={cur.accent} global={palette.accent} presets={accents}
          onChange={(hex) => write({ accent: hex })} onClear={() => write({ accent: undefined })}
        />
        <SlotEditor
          label="Accent 2" value={cur.accent2} global={palette.accent2 ?? palette.accent} presets={accent2s}
          onChange={(hex) => write({ accent2: hex })} onClear={() => write({ accent2: undefined })}
        />
        {/* Per-section background / heading-weight / scale controls were removed: a whole-site
            template owns the palette and structure, so the only per-section edit is the accent.
            This is also what stops a section from diverging into an off-template background. */}

        {skins.length >= 2 && (
          <Row label="Surface">
            <div className="flex flex-wrap gap-1">
              {skins.map((sk) => (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => onSetSkin(sk.id)}
                  className={[
                    'rounded-full px-2.5 py-0.5 text-xs transition-colors',
                    sk.id === activeSkin ? 'bg-fg text-bg' : 'text-fg3 hover:text-fg',
                  ].join(' ')}
                >
                  {sk.label}
                </button>
              ))}
            </div>
          </Row>
        )}

        {category && category.variants.length >= 2 && (
          <Row label="Layout">
            <div className="flex flex-col gap-1">
              {category.variants.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  onClick={() => onSetVariant(v.name)}
                  className={[
                    'rounded-md px-2 py-1 text-left text-xs transition-colors',
                    v.name === variantName ? 'bg-surface font-medium text-fg' : 'text-fg3 hover:bg-surface hover:text-fg',
                  ].join(' ')}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </Row>
        )}

        <button
          type="button"
          onClick={() => setField(`sectionStyles.${styleKey}`, {})}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-rule px-2 py-1 text-2xs text-fg3 hover:text-fg"
        >
          <ArrowCounterClockwise size={11} /> Reset section styles
        </button>
      </div>
    </div>
  );
}
