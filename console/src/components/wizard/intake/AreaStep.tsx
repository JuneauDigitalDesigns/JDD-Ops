'use client';

/**
 * Step 3, Area & profiles: the towns served, whether the street address appears on the site,
 * the mobile radius, and the business's own profiles on other sites. All client facts.
 *
 * Service area is capped at 20 towns: Google Business Profile allows 20 service areas, and the
 * site mirrors the profile. Profiles are only ones that exist (no placeholders); the footer and
 * the structured data's sameAs read them (client-seo).
 */
import { useState } from 'react';
import { PROFILE_KINDS, TOP_TOWNS_MAX, type ProfileKind } from '@jdd/schema';
import { Trash, ArrowSquareOut } from '@phosphor-icons/react';
import { townPageRows, toggleTopTown, isSourceUrl, addTownNote, type TownNote } from '@/lib/intake-towns';
import { townChoices } from '@/lib/service-areas';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { sourceOf, type SourceContext } from '@/lib/intake-sources';
import { Card, ChipListEditor, SourceChip, Tag, INPUT, FIELD_LABEL } from './ui';

const KIND_LABEL: Record<ProfileKind, string> = {
  google: 'Google', facebook: 'Facebook', yelp: 'Yelp', bbb: 'BBB', angi: 'Angi',
  nextdoor: 'Nextdoor', instagram: 'Instagram', other: 'Other',
};

type Profile = { kind: ProfileKind; url: string; label?: string };

export default function AreaStep({
  content, sources, setField,
}: {
  content: SiteContent;
  sources: SourceContext;
  setField: SetField;
}) {
  const ext = content.extensions ?? ({} as SiteContent['extensions']);
  const towns = ext.serviceArea ?? [];
  const sab = ext.serviceAreaBusiness;
  const profiles = (ext.profiles ?? []) as Profile[];
  // Local SEO (Xander, 2026-11-12, approved as the canvas's row 8): the client's top towns, each
  // town's progress towards a page of its own, and the operator's sourced notes (lib/intake-towns.ts).
  const own = townChoices(towns);
  const top = ((ext as { topTowns?: string[] | null }).topTowns ?? []) as string[];
  const notes = ((ext as { townNotes?: TownNote[] | null }).townNotes ?? []) as TownNote[];
  const rows = townPageRows(content);
  const [noteDraft, setNoteDraft] = useState<TownNote>({ town: '', text: '', sourceUrl: '' });
  const nextNotes = addTownNote(content, notes, noteDraft);
  const canAdd = nextNotes !== null;

  function setProfile(kind: ProfileKind, url: string, label?: string) {
    const rest = profiles.filter((p) => p.kind !== kind);
    const next = url.trim() ? [...rest, { kind, url, ...(label ? { label } : {}) }] : rest;
    next.sort((a, b) => PROFILE_KINDS.indexOf(a.kind) - PROFILE_KINDS.indexOf(b.kind));
    setField('extensions.profiles', next.length ? next : null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Area &amp; profiles</h2>
        <span className="text-xs text-uiFg3">Towns served, the address on the site, and profiles on other sites.</span>
      </div>

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_300px]">
        <Card
          title="Service area"
          right={<><SourceChip source={sourceOf(sources, 'extensions.serviceArea')} /><span className="font-chromeMono text-2xs text-uiFg3">{towns.length} / 20 towns</span></>}
          bodyClassName="space-y-5 p-4"
        >
          <ChipListEditor
            values={towns}
            onChange={(v) => setField('extensions.serviceArea', v.length ? v : null)}
            placeholder="Add a town"
            addLabel="Add"
            max={20}
            inputId="extensions.serviceArea"
          />

          <div>
            <p className={FIELD_LABEL}>
              Top 3 towns <SourceChip source={sourceOf(sources, 'extensions.topTowns')} />
            </p>
            <div className="flex flex-wrap gap-1.5">
              {own.map((t) => {
                const n = top.indexOf(t);
                const on = n >= 0;
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && top.length >= TOP_TOWNS_MAX}
                    onClick={() => {
                      const next = toggleTopTown(content, top, t);
                      setField('extensions.topTowns', next.length ? next : null);
                    }}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] transition-colors disabled:opacity-40 ${on
                      ? 'border border-[rgba(31,111,120,.45)] bg-[rgba(31,111,120,.12)] font-semibold text-[#174f56]'
                      : 'border border-dashed border-uiCardRule text-uiFg3 hover:text-uiInk'}`}
                  >
                    {on && <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[#1f6f78] font-chromeMono text-[10.5px] text-[#f4ecd8]">{n + 1}</span>}
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {rows.length > 0 && (
            <div>
              <p className={FIELD_LABEL}>Town pages</p>
              <ul className="overflow-hidden rounded-[10px] border border-uiCardRule/70 bg-panel" data-testid="town-pages">
                {rows.map((r) => (
                  <li key={r.town} className="flex justify-between gap-3 border-t border-uiCardRule/40 px-3 py-1.5 text-[13px] first:border-t-0">
                    <span className="text-uiInk">{r.town}</span>
                    <span className={`font-chromeMono text-[11px] ${r.status === 'own' ? 'text-ok' : r.status === 'main' ? 'text-uiFg3' : 'text-[#7d500f]'}`}>{r.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset>
            <legend className={FIELD_LABEL}>
              Street address on the site
              {typeof sab !== 'boolean' && <SourceChip source={sourceOf(sources, 'extensions.serviceAreaBusiness')} />}
            </legend>
            <div className="inline-flex overflow-hidden rounded-lg border border-ruleStrong" role="radiogroup" aria-label="Street address on the site">
              {[
                { v: false, label: 'Shown' },
                { v: true, label: 'Hidden (service-area business)' },
              ].map((o) => (
                <button
                  key={String(o.v)}
                  type="button"
                  role="radio"
                  aria-checked={sab === o.v}
                  onClick={() => setField('extensions.serviceAreaBusiness', o.v)}
                  className={`h-8 px-3 text-[13px] ${sab === o.v ? 'bg-accent font-semibold text-accentInk' : 'bg-panel text-uiFg2 hover:text-uiInk'} border-l border-ruleStrong first:border-l-0`}
                  style={sab === o.v ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-2xs leading-relaxed text-uiFg3">
              Hidden: the site shows city, state and ZIP only, as Google asks of a service-area business.
            </p>
          </fieldset>

          <label className="block max-w-xs">
            <span className={FIELD_LABEL}>Mobile radius, miles <Tag>Optional</Tag></span>
            <input
              value={ext.serviceRadiusMiles ?? ''}
              placeholder="Not given"
              onChange={(e) => setField('extensions.serviceRadiusMiles', e.target.value.trim() ? e.target.value : null)}
              data-field-path="extensions.serviceRadiusMiles"
              className={INPUT}
            />
          </label>
        </Card>

        <Card
          title="Town notes"
          right={<span className="font-chromeMono text-2xs text-uiFg3">{notes.length}</span>}
          bodyClassName="flex flex-col gap-3 p-4"
        >
          {notes.map((n, k) => (
            <div key={k} className="flex shrink-0 flex-col gap-1.5 rounded-[10px] border border-uiCardRule/70 bg-panel px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full border border-[rgba(31,111,120,.45)] bg-[rgba(31,111,120,.12)] px-2.5 text-[12.5px] font-semibold text-[#174f56]">{n.town}</span>
                <button
                  type="button"
                  aria-label="Remove note"
                  onClick={() => { const next = notes.filter((_, j) => j !== k); setField('extensions.townNotes', next.length ? next : null); }}
                  className="ml-auto rounded p-1 text-uiFg3 hover:text-uiInk"
                >
                  <Trash size={13} />
                </button>
              </div>
              <p className="text-[13.5px] leading-snug text-uiInk">{n.text}</p>
              <a href={n.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 truncate font-chromeMono text-[11.5px] text-uiAccent">
                <ArrowSquareOut size={12} className="shrink-0" /> {n.sourceUrl.replace(/^https?:\/\//, '')}
              </a>
            </div>
          ))}
          <div className="flex shrink-0 flex-col gap-2.5 border-t border-uiCardRule/60 pt-3">
            <label className="block max-w-[240px]">
              <span className={FIELD_LABEL}>Town</span>
              <select value={noteDraft.town} onChange={(e) => setNoteDraft({ ...noteDraft, town: e.target.value })} className={INPUT}>
                <option value="">None</option>
                {own.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Note</span>
              <textarea
                value={noteDraft.text}
                onChange={(e) => setNoteDraft({ ...noteDraft, text: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-ruleStrong bg-panel px-2.5 py-1.5 text-[13.5px] text-fg outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>Source link <Tag tone="warn">Required</Tag></span>
              <input
                value={noteDraft.sourceUrl}
                placeholder="https://"
                onChange={(e) => setNoteDraft({ ...noteDraft, sourceUrl: e.target.value })}
                aria-invalid={noteDraft.sourceUrl.trim() !== '' && !isSourceUrl(noteDraft.sourceUrl)}
                className={`${INPUT} ${noteDraft.sourceUrl.trim() && !isSourceUrl(noteDraft.sourceUrl) ? 'border-danger' : ''}`}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => { if (nextNotes) { setField('extensions.townNotes', nextNotes); setNoteDraft({ town: noteDraft.town, text: '', sourceUrl: '' }); } }}
                className="btn btn-sm btn-primary disabled:opacity-40"
              >
                Add note
              </button>
            </div>
          </div>
        </Card>

        <Card
          title="Profiles"
          right={<span className="font-chromeMono text-2xs text-uiFg3">{profiles.length} / {PROFILE_KINDS.length}</span>}
          bodyClassName="divide-y divide-uiCardRule/40"
        >
          {PROFILE_KINDS.map((kind) => {
            const p = profiles.find((x) => x.kind === kind);
            return (
              <div key={kind} className="grid grid-cols-[26px_88px_minmax(0,1fr)] items-center gap-2 px-3.5 py-2">
                <span aria-hidden className="flex h-[26px] w-[26px] items-center justify-center rounded-md bg-uiSurface font-chromeMono text-[10px] font-medium text-uiFg2">
                  {KIND_LABEL[kind].slice(0, 1)}
                </span>
                <label htmlFor={`profile-${kind}`} className="text-[13px] font-semibold text-uiInk">{KIND_LABEL[kind]}</label>
                <input
                  id={`profile-${kind}`}
                  value={p?.url ?? ''}
                  placeholder="Not given"
                  onChange={(e) => setProfile(kind, e.target.value, p?.label)}
                  className={`${INPUT} h-7 text-[12.5px]`}
                />
              </div>
            );
          })}
          <p className="px-3.5 py-2.5 text-2xs leading-relaxed text-uiFg3">
            Only profiles that exist. Shown in the footer and listed in the site&apos;s structured data.
          </p>
        </Card>
      </div>
    </div>
  );
}
