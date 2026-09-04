'use client';

import { useState } from 'react';
import type { CopyBrief } from '@jdd/schema';
import { Globe, CircleNotch, Check, Warning } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import type { WebsiteBlock } from '@/lib/copy-brief/types';
import { setBlockEnabled, setBlockOverride, setWebsiteUrl } from '@/lib/copy-brief/mutations';
import { BlockHeader, FieldLabel, OverrideInput, OverrideTextarea } from '../BlockPrimitives';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

/** Scan-site's fact-field name → the SiteContent path it applies to. All under brand.* —
 *  the fields a website naturally reveals; richer facts (serviceArea, trustBadges) aren't
 *  reliably scrapeable and are left for the operator to fill in from the notes by hand. */
const FACT_PATH: Record<string, string> = {
  name: 'brand.name', tagline: 'brand.tagline', phone: 'brand.phone', email: 'brand.email',
  address: 'brand.address', license: 'brand.license', established: 'brand.established',
};
const FACT_LABEL: Record<string, string> = {
  name: 'Business name', tagline: 'Tagline', phone: 'Phone', email: 'Email',
  address: 'Address', license: 'License', established: 'Established',
};

type ScanState =
  | { kind: 'idle' }
  | { kind: 'scanning' }
  | { kind: 'error'; message: string };

export default function WebsiteBlockEditor({
  block, content, setField, onUpdate,
}: {
  block: WebsiteBlock;
  content: SiteContent;
  setField: SetField;
  onUpdate: Update;
}) {
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });
  const [facts, setFacts] = useState<Record<string, string> | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function runScan() {
    if (!block.url.trim()) return;
    setScan({ kind: 'scanning' });
    setFacts(null);
    setApplied(new Set());
    try {
      const res = await fetch('/api/build/scan-site', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: block.url }),
      });
      const data = (await res.json()) as { notes?: string; facts?: Record<string, string>; error?: string };
      if (!res.ok || !data.notes) {
        setScan({ kind: 'error', message: data.error ?? 'Scan failed.' });
        return;
      }
      onUpdate((b) => setBlockOverride(b, 'website', 'notes', data.notes));
      setFacts(Object.keys(data.facts ?? {}).length ? data.facts! : null);
      setScan({ kind: 'idle' });
    } catch {
      setScan({ kind: 'error', message: 'Could not reach the scan service.' });
    }
  }

  function applyFact(key: string, value: string) {
    const path = FACT_PATH[key];
    if (!path) return;
    setField(path, value);
    setApplied((prev) => new Set(prev).add(key));
  }

  const scanning = scan.kind === 'scanning';

  return (
    <div>
      <BlockHeader
        label={block.label}
        channel={block.channel}
        enabled={block.enabled}
        onToggleEnabled={(v) => onUpdate((b) => setBlockEnabled(b, 'website', v))}
      />
      <div className="mb-4">
        <FieldLabel>
          <span className="inline-flex items-center gap-1.5"><Globe size={13} /> Existing website</span>
        </FieldLabel>
        <div className="flex gap-2">
          <div className="flex-1">
            <OverrideInput
              value={block.url}
              onChange={(v) => onUpdate((b) => setWebsiteUrl(b, v))}
              placeholder="theirbusiness.com"
            />
          </div>
          <button type="button" onClick={runScan} disabled={scanning || !block.url.trim()} className="btn btn-sm shrink-0">
            {scanning ? <CircleNotch size={14} className="animate-spin" /> : 'Scan'}
          </button>
        </div>
        {scan.kind === 'error' && (
          <p className="mt-1.5 flex items-center gap-1.5 text-2xs text-danger"><Warning size={12} /> {scan.message}</p>
        )}
      </div>

      {facts && (
        <div className="mb-4 rounded-lg border border-uiCardRule p-3">
          <p className="mb-2 font-chromeMono text-2xs uppercase tracking-wide text-uiInkSoft">
            {Object.keys(facts).length} fact{Object.keys(facts).length === 1 ? '' : 's'} found on the site
          </p>
          <div className="space-y-1.5">
            {Object.entries(facts).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-uiInkSoft">{FACT_LABEL[key] ?? key}</span>
                <span className="min-w-0 flex-1 truncate text-uiFg2">{value}</span>
                {applied.has(key) ? (
                  <span className="mono flex shrink-0 items-center gap-1 text-2xs text-ok"><Check size={12} /> applied</span>
                ) : (
                  <button type="button" onClick={() => applyFact(key, value)} className="mono shrink-0 text-2xs text-uiAccent hover:text-uiInk">
                    Apply
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <FieldLabel>{block.notes.label}</FieldLabel>
        </div>
        <OverrideTextarea
          value={block.notes.text}
          onChange={(v) => onUpdate((b) => setBlockOverride(b, 'website', 'notes', v || undefined))}
          rows={6}
          placeholder="Scan the site above, or paste notes here by hand."
        />
      </div>
    </div>
  );
}
