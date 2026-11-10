'use client';

/**
 * Step 2, Services: the client's services, and for each one the facts its own page is built
 * from (service-page-spec.md §3-§4). The panel holds FACTS. The card line and the page copy are
 * the copywriter's, shown read-only and edited in the Studio.
 *
 * Which services get their own page is @jdd/schema's gate (client-seo), never counted here:
 * lib/intake-todo.ts servicePageHint over lib/service-gate.ts.
 *
 * Tagging (a photo or a question to a service) stores the service's slug the first time
 * (`services.items.N.slug`), so a later rename never detaches it or moves its page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretLeft, CaretRight, CircleNotch, Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { serviceSlugs } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { servicePageHint } from '@/lib/intake-todo';
import { SERVICE_GATE } from '@/lib/service-gate';
import { Card, ChipListEditor, ToggleChips, Tag, INPUT, FIELD_LABEL } from './ui';

type Item = SiteContent['services']['items'][number];
type Project = SiteContent['work']['projects'][number];
type Question = { q: string; a: string; service?: string };

const PAGE_SIZE = 9;

export default function ServicesStep({
  content, setField, focusService,
}: {
  content: SiteContent;
  setField: SetField;
  /** A service Still to do jumped to. */
  focusService?: number;
}) {
  const items = content.services?.items ?? [];
  const [sel, setSel] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (focusService === undefined) return;
    setSel(focusService);
    setPage(Math.floor(focusService / PAGE_SIZE));
  }, [focusService]);

  const slugs = useMemo(() => serviceSlugs(content), [content]);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const shown = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const ownPages = items.filter((_, i) => servicePageHint(SERVICE_GATE, content, i).page).length;
  const i = Math.min(sel, Math.max(0, items.length - 1));
  const item = items[i];

  function addService() {
    const next: Item = { n: String(items.length + 1).padStart(2, '0'), t: 'New service', d: '', tag: '' };
    setField('services.items', [...items, next]);
    setSel(items.length);
    setPage(Math.floor(items.length / PAGE_SIZE));
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Services</h2>
        <span className="font-chromeMono text-2xs text-uiFg3">
          {items.length} service{items.length === 1 ? '' : 's'} · {ownPages} with their own page
        </span>
        <span className="text-xs text-uiFg3">
          Own page: {SERVICE_GATE.INCLUDED_MIN}+ included items or {SERVICE_GATE.TYPICAL_JOBS_MIN}+ typical jobs, plus one more fact.
        </span>
        <button type="button" onClick={addService} className="btn btn-sm ml-auto"><Plus size={12} /> Service</button>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-uiCardRule">
          <p className="text-sm text-uiFg3">No services listed.</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_420px]">
          <Card
            title="Services"
            right={pages > 1 && (
              <span className="flex items-center gap-1">
                <button type="button" aria-label="Previous services" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded p-0.5 text-uiFg3 hover:text-uiInk disabled:opacity-30"><CaretLeft size={12} /></button>
                <span className="font-chromeMono text-2xs text-uiFg3">{page + 1}/{pages}</span>
                <button type="button" aria-label="Next services" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded p-0.5 text-uiFg3 hover:text-uiInk disabled:opacity-30"><CaretRight size={12} /></button>
              </span>
            )}
          >
            <ul>
              {shown.map((it, k) => {
                const idx = page * PAGE_SIZE + k;
                const hint = servicePageHint(SERVICE_GATE, content, idx);
                const facts = SERVICE_GATE.servicePageFacts(content, idx);
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => setSel(idx)}
                      aria-current={idx === i ? 'true' : undefined}
                      className={[
                        'grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 border-l-[3px] px-3.5 py-2.5 text-left transition-colors',
                        idx === i ? 'border-uiAccent bg-uiSurface' : 'border-transparent hover:bg-uiSurface/60',
                      ].join(' ')}
                    >
                      <span className="truncate text-[14px] font-semibold text-uiInk">{it.t?.trim() || 'Untitled'}</span>
                      <span className="font-chromeMono text-2xs text-uiFg3" title="Facts given">{facts.count} facts</span>
                      <span className={`col-span-2 truncate text-xs ${hint.page ? 'text-uiFg3' : 'text-[#7d500f]'}`}>
                        {[it.tag, hint.page ? 'own page' : `section only, ${hint.short} short`].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {item && <ServicePanel key={i} content={content} setField={setField} index={i} item={item} slug={slugs[i] ?? ''} />}

          {item && <ServicePreview content={content} item={item} index={i} slug={slugs[i] ?? ''} />}
        </div>
      )}
    </div>
  );
}

function ServicePanel({
  content, setField, index, item, slug,
}: {
  content: SiteContent;
  setField: SetField;
  index: number;
  item: Item;
  slug: string;
}) {
  const base = `services.items.${index}`;
  const hint = servicePageHint(SERVICE_GATE, content, index);
  const area = content.extensions?.serviceArea ?? [];
  const brandsCarried = content.extensions?.brandsCarried ?? [];
  const projects = content.work?.projects ?? [];
  const questions = (content.extensions?.customerQuestions ?? []) as Question[];

  /** Store the slug the first time anything is tagged to this service (spec §2). */
  function ensureSlug() {
    if (!item.slug && slug) setField(`${base}.slug`, slug);
  }

  const myPhotos = projects.map((p, k) => ({ p, k })).filter(({ p }) => p.service && p.service === slug);
  const myQuestions = questions.map((q, k) => ({ q, k })).filter(({ q }) => q.service && q.service === slug);

  function setBrands(next: string[]) {
    setField(`${base}.brands`, next);
    // A brand picked on a service is a brand the business carries (onboarding-facts' rule).
    const missing = next.filter((b) => !brandsCarried.some((c) => c.toLowerCase() === b.toLowerCase()));
    if (missing.length) setField('extensions.brandsCarried', [...brandsCarried, ...missing]);
  }

  function setQuestions(next: Question[]) {
    setField('extensions.customerQuestions', next);
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-uiCardRule bg-uiBg">
      <header className="flex shrink-0 flex-wrap items-center gap-2.5 border-b border-uiCardRule/70 px-4 py-2.5">
        <label className="sr-only" htmlFor={`${base}.t`}>Service name</label>
        <input
          id={`${base}.t`}
          value={item.t ?? ''}
          onChange={(e) => setField(`${base}.t`, e.target.value)}
          className="min-w-0 flex-1 bg-transparent font-display text-[24px] font-bold leading-none text-uiInk outline-none focus:underline"
        />
        <label className="flex items-center gap-1.5 text-2xs text-uiFg3">
          Tag
          <input value={item.tag ?? ''} onChange={(e) => setField(`${base}.tag`, e.target.value)} className={`${INPUT} h-7 w-28`} />
        </label>
        <label className="flex items-center gap-1.5 text-2xs text-uiFg3">
          From
          <input
            value={item.priceFrom ?? ''}
            placeholder="Not given"
            onChange={(e) => setField(`${base}.priceFrom`, e.target.value.trim() ? e.target.value : null)}
            className={`${INPUT} h-7 w-28`}
          />
        </label>
        {hint.page
          ? <Tag tone="teal" title="Qualifies for its own page">Own page · /services/{slug}</Tag>
          : <Tag tone="warn" title={hint.text}>Section only · {hint.short} short</Tag>}
      </header>

      <div className="grid min-h-0 flex-1 md:grid-cols-3">
        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
          <div>
            <p className={FIELD_LABEL}>What&apos;s included</p>
            <ChipListEditor
              values={item.included ?? []}
              onChange={(v) => setField(`${base}.included`, v)}
              placeholder="One item"
              inputId={`${base}.included`}
            />
          </div>
          <div>
            <p className={FIELD_LABEL}>Brands for this service</p>
            <ToggleChips
              options={brandsCarried}
              selected={item.brands ?? []}
              onChange={setBrands}
              emptyNote="No brands carried yet (Business step)."
            />
          </div>
          <JobPhotos
            name={item.t}
            photos={myPhotos}
            onAdd={(p) => { ensureSlug(); setField('work.projects', [...projects, { ...p, service: slug }]); }}
            onCaption={(k, caption) => setField('work.projects', projects.map((p, j) => (j === k ? { ...p, caption, image: p.image ? { ...p.image, alt: caption } : p.image } : p)))}
            onRemove={(k) => setField('work.projects', projects.filter((_, j) => j !== k))}
          />
        </div>

        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-uiCardRule/50 p-4 md:border-l md:border-t-0">
          <div>
            <p className={FIELD_LABEL}>Typical jobs</p>
            <ChipListEditor
              values={item.typicalJobs ?? []}
              onChange={(v) => setField(`${base}.typicalJobs`, v)}
              addLabel="Job"
              placeholder="A job or problem, in the customer's words"
              inputId={`${base}.typicalJobs`}
            />
          </div>
        </div>

        <div className="no-scrollbar flex min-h-0 flex-col gap-4 overflow-y-auto border-t border-uiCardRule/50 p-4 md:border-l md:border-t-0">
          <div>
            <p className={FIELD_LABEL}>Areas for this service <Tag>Optional</Tag></p>
            <ToggleChips
              options={area}
              selected={item.areas ?? []}
              onChange={(v) => setField(`${base}.areas`, v)}
              emptyNote="No service area yet (Area & profiles step)."
            />
            <p className="mt-1.5 text-2xs leading-relaxed text-uiFg3">
              Towns ticked here show as an areas block on its page. None ticked: no areas block.
            </p>
          </div>
          <div>
            <p className={FIELD_LABEL}>Customer questions</p>
            <ul className="space-y-2">
              {myQuestions.map(({ q, k }) => (
                <li key={k} className="space-y-1 rounded-lg border border-uiCardRule/70 bg-panel p-2">
                  <div className="flex gap-1.5">
                    <input
                      aria-label="Question"
                      value={q.q}
                      onChange={(e) => setQuestions(questions.map((x, j) => (j === k ? { ...x, q: e.target.value } : x)))}
                      className={`${INPUT} h-7`}
                    />
                    <button type="button" aria-label="Remove question" onClick={() => setQuestions(questions.filter((_, j) => j !== k))} className="shrink-0 rounded p-1 text-uiFg3 hover:text-uiInk"><Trash size={13} /></button>
                  </div>
                  <input
                    aria-label="The client's answer"
                    value={q.a}
                    placeholder="Answer: not given"
                    onChange={(e) => setQuestions(questions.map((x, j) => (j === k ? { ...x, a: e.target.value } : x)))}
                    className={`${INPUT} h-7 text-xs`}
                  />
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-sm mt-2"
              onClick={() => { ensureSlug(); setQuestions([...questions, { q: '', a: '', service: slug }]); }}
            >
              <Plus size={12} /> Question
            </button>
          </div>
        </div>
      </div>

      {/* The copywriter's output, below the facts on a laptop. A wide screen shows it as its
          own column (ServicePreview) instead. */}
      <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-4 border-t border-uiCardRule/70 bg-uiSurface/40 px-4 py-3 2xl:hidden">
        <Tag title="Written at generation; edited in the Studio">Copywriter</Tag>
        <div className="min-w-0">
          <p className="font-chromeMono text-[10px] uppercase tracking-[0.12em] text-uiFg3">Card line</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-uiFg2">{item.d?.trim() || <span className="italic text-uiFg3">Not written yet</span>}</p>
        </div>
        <div className="min-w-0">
          <p className="font-chromeMono text-[10px] uppercase tracking-[0.12em] text-uiFg3">{hint.page ? 'Its own page' : 'Services page section'}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-uiFg2">
            {item.page?.intro?.trim() || item.detail?.trim() || <span className="italic text-uiFg3">Written from the facts above at the next run; edited in the Studio.</span>}
          </p>
        </div>
      </div>
    </section>
  );
}

function JobPhotos({
  name, photos, onAdd, onCaption, onRemove,
}: {
  name: string;
  photos: Array<{ p: Project; k: number }>;
  onAdd: (p: Project) => void;
  onCaption: (k: number, caption: string) => void;
  onRemove: (k: number) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/build/upload', { method: 'POST', body: fd });
      const d = (await r.json()) as { ref?: string };
      if (!d.ref) return;
      // A caption is required: it is the photo's alt text. The service name until one is typed.
      const caption = name?.trim() || 'Job photo';
      onAdd({ t: name, loc: '', yr: null, scope: name, size: '', caption, image: { url: d.ref, alt: caption } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className={FIELD_LABEL}>Job photos</p>
      <ul className="space-y-1.5">
        {photos.map(({ p, k }) => {
          const url = p.image?.url ?? '';
          const src = url && !url.startsWith('upload://') && /^https?:|^\//.test(url) ? url : null;
          return (
            <li key={k} className="flex items-center gap-2">
              <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-uiSurface font-chromeMono text-[9px] text-uiFg3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : 'staged'}
              </span>
              <input
                aria-label="Caption (alt text)"
                value={p.caption}
                onChange={(e) => onCaption(k, e.target.value || name || 'Job photo')}
                className={`${INPUT} h-7 text-xs`}
              />
              <button type="button" aria-label="Remove photo" onClick={() => onRemove(k)} className="shrink-0 rounded p-1 text-uiFg3 hover:text-uiInk"><Trash size={13} /></button>
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="btn btn-sm mt-2 disabled:opacity-50">
        {busy ? <CircleNotch size={12} className="animate-spin" /> : <UploadSimple size={12} />} Photo
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }}
      />
      <p className="mt-1.5 text-2xs text-uiFg3">Real jobs only.</p>
    </div>
  );
}

/** The copywriter's output for this service from the last run. Read-only: edited in the Studio. */
function ServicePreview({ content, item, index, slug }: { content: SiteContent; item: Item; index: number; slug: string }) {
  const hint = servicePageHint(SERVICE_GATE, content, index);
  return (
    <Card title="On the site" right={<Tag>Last run</Tag>} className="hidden 2xl:flex" bodyClassName="space-y-3 p-3.5">
      <div className="rounded-lg border border-uiCardRule/70 bg-panel p-3.5">
        <p className="font-chromeMono text-[10px] uppercase tracking-[0.14em] text-uiFg3">Service card</p>
        <p className="mt-1.5 font-display text-xl font-bold text-uiInk">{item.t}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-uiFg2">{item.d?.trim() || <span className="italic text-uiFg3">Not written yet</span>}</p>
      </div>
      <div className="rounded-lg border border-uiCardRule/70 bg-panel p-3.5">
        <p className="font-chromeMono text-[10px] uppercase tracking-[0.14em] text-uiFg3">
          {hint.page ? `Own page · /services/${slug}` : 'Services page section'}
        </p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-uiFg2">
          {item.page?.intro?.trim() || item.detail?.trim() || <span className="italic text-uiFg3">Not written yet</span>}
        </p>
        {(item.included ?? []).length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-[13px] leading-relaxed text-uiFg2">
            {(item.included ?? []).map((x) => <li key={x}>{x}</li>)}
          </ul>
        )}
      </div>
      <p className="text-2xs leading-relaxed text-uiFg3">Changes above apply at the next run. Text edits happen in the Studio.</p>
    </Card>
  );
}
