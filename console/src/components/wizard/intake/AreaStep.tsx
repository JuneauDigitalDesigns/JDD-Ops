'use client';

/**
 * Step 3, Area & profiles: the towns served, whether the street address appears on the site,
 * the mobile radius, and the business's own profiles on other sites. All client facts.
 *
 * Service area is capped at 20 towns: Google Business Profile allows 20 service areas, and the
 * site mirrors the profile. Profiles are only ones that exist (no placeholders); the footer and
 * the structured data's sameAs read them (client-seo).
 */
import { PROFILE_KINDS, type ProfileKind } from '@jdd/schema';
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

      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
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
