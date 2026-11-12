'use client';

/**
 * Step 2, Services, guided (Xander, 2026-11-10: the one-panel version was "a little bit
 * confusing ... not really sure what's being asked"; approved Services v2 mockup, "Build it").
 *
 * One service at a time, one part per screen: Basics, Included in the job, Problems it fixes,
 * Towns & brands, Photos, Customer questions, then a Summary and on to the next service. The
 * headers are the explanation (no help text added), and "Where it shows" beside each part
 * highlights where that part appears on the client's site.
 *
 * Unchanged underneath: every field autosaves as typed; which services get their own page is
 * @jdd/schema's gate (lib/service-gate.ts), never counted here; tagging a photo or a question
 * stores the service's slug the first time, so a rename never detaches it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CaretLeft, CaretRight, CheckCircle, CircleNotch, Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { serviceSlugs, menuFor, serviceSuggestions } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { servicePageHint } from '@/lib/intake-todo';
import { SERVICE_GATE } from '@/lib/service-gate';
import { serviceAreasToStore } from '@/lib/service-areas';
import { previewSrc } from '@/lib/stagedUploads';
import {
  SERVICE_PARTS, BASICS_LABEL, DURATION_CHOICES, partsDone, partsProgress, nextPart, prevPart, categorySuggestions,
  type ServicePartId,
} from '@/lib/service-parts';
import { Card, ChipListEditor, ToggleChips, Tag, INPUT } from './ui';

type Item = SiteContent['services']['items'][number];
type Project = SiteContent['work']['projects'][number];
type Question = { q: string; a: string; service?: string };

const PAGE_SIZE = 9;
const BIG_INPUT = 'h-11 w-full rounded-[10px] border border-ruleStrong bg-panel px-3 text-[15px] text-fg outline-none focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-glow)]';

export default function ServicesStep({
  content, setField, focusService, vertical, onDone,
}: {
  content: SiteContent;
  setField: SetField;
  /** A service Still to do jumped to: it opens on its Summary. */
  focusService?: number;
  /** The vertical, for its own service categories. */
  vertical?: string;
  /** After the last service's Summary: on to the next intake step. */
  onDone: () => void;
}) {
  const items = content.services?.items ?? [];
  const [sel, setSel] = useState(0);
  const [part, setPart] = useState<ServicePartId>('basics');
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (focusService === undefined) return;
    setSel(focusService);
    setPart('summary');
    setPage(Math.floor(focusService / PAGE_SIZE));
  }, [focusService]);

  const slugs = useMemo(() => serviceSlugs(content), [content]);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const shown = items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const i = Math.min(sel, Math.max(0, items.length - 1));
  const item = items[i];

  function open(idx: number, p: ServicePartId = 'basics') {
    setSel(idx);
    setPart(p);
    setPage(Math.floor(idx / PAGE_SIZE));
  }

  function addService() {
    const next: Item = { n: String(items.length + 1).padStart(2, '0'), t: 'New service', d: '', tag: '' };
    setField('services.items', [...items, next]);
    open(items.length);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Services</h2>
        <span className="font-chromeMono text-2xs text-uiFg3">
          {items.length} service{items.length === 1 ? '' : 's'} · {items.filter((_, k) => servicePageHint(SERVICE_GATE, content, k).page).length} with their own page
        </span>
        <button type="button" onClick={addService} className="btn btn-sm ml-auto"><Plus size={12} /> Service</button>
      </div>

      {items.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-uiCardRule">
          <p className="text-sm text-uiFg3">No services listed.</p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_340px] 2xl:grid-cols-[280px_minmax(0,1fr)_420px]">
          <Card
            title={`Services · ${items.length}`}
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
                const done = partsDone(content, idx, slugs[idx] ?? '');
                const prog = partsProgress(done);
                const hint = servicePageHint(SERVICE_GATE, content, idx);
                const on = idx === i;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => open(idx, on ? part : 'basics')}
                      aria-current={on ? 'true' : undefined}
                      className={`flex w-full flex-col gap-1 border-l-[3px] px-3.5 py-2.5 text-left transition-colors ${on ? 'border-uiAccent bg-uiSurface' : 'border-transparent hover:bg-uiSurface/60'}`}
                    >
                      <span className="truncate text-[14px] font-semibold text-uiInk">{it.t?.trim() || 'Untitled'}</span>
                      <span className="flex gap-[3px]" aria-hidden>
                        {(['basics', 'included', 'problems', 'towns', 'photos', 'questions'] as const).map((p) => (
                          <i
                            key={p}
                            className="block h-1 w-4 rounded-sm"
                            style={{ background: on && part === p ? 'var(--ui-accent)' : done[p] ? 'var(--ok)' : 'var(--ui-rule)' }}
                          />
                        ))}
                      </span>
                      <span className={`text-[11.5px] ${hint.page ? 'text-uiFg3' : 'text-[#7d500f]'}`}>
                        {prog.done} of {prog.of} · {hint.page ? 'own page' : 'section only'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {item && (
            <GuidedService
              key={i}
              content={content}
              setField={setField}
              index={i}
              item={item}
              slug={slugs[i] ?? ''}
              part={part}
              onPart={setPart}
              vertical={vertical}
              nextName={items[i + 1]?.t}
              onNextService={() => (i + 1 < items.length ? open(i + 1) : onDone())}
            />
          )}

          {item && part !== 'summary' && (
            <WhereItShows content={content} item={item} index={i} slug={slugs[i] ?? ''} part={part} />
          )}
        </div>
      )}
    </div>
  );
}

function GuidedService({
  content, setField, index, item, slug, part, onPart, vertical, nextName, onNextService,
}: {
  content: SiteContent;
  setField: SetField;
  index: number;
  item: Item;
  slug: string;
  part: ServicePartId;
  onPart: (p: ServicePartId) => void;
  vertical?: string;
  nextName?: string;
  onNextService: () => void;
}) {
  const base = `services.items.${index}`;
  const done = partsDone(content, index, slug);
  const hint = servicePageHint(SERVICE_GATE, content, index);
  const area = content.extensions?.serviceArea ?? [];
  const brandsCarried = content.extensions?.brandsCarried ?? [];
  const projects = content.work?.projects ?? [];
  const questions = (content.extensions?.customerQuestions ?? []) as Question[];
  const myPhotos = projects.map((p, k) => ({ p, k })).filter(({ p }) => p.service && p.service === slug);
  const myQuestions = questions.map((q, k) => ({ q, k })).filter(({ q }) => q.service && q.service === slug);
  const menuTags = menuFor(vertical)?.services.map((s) => s.tag) ?? [];
  // Approved per-service suggestions, matched by the service's menu label (v1.33.0).
  const sugg = serviceSuggestions(vertical, item.t);
  const name = item.t?.trim() || 'Untitled';

  /** Store the slug the first time anything is tagged to this service (spec §2). */
  function ensureSlug() {
    if (!item.slug && slug) setField(`${base}.slug`, slug);
  }
  function setBrands(next: string[]) {
    setField(`${base}.brands`, next);
    // A brand picked on a service is a brand the business carries (onboarding-facts' rule).
    const missing = next.filter((b) => !brandsCarried.some((c) => c.toLowerCase() === b.toLowerCase()));
    if (missing.length) setField('extensions.brandsCarried', [...brandsCarried, ...missing]);
  }
  const setQuestions = (next: Question[]) => setField('extensions.customerQuestions', next);

  const label = SERVICE_PARTS.find((p) => p.id === part)?.label ?? '';
  const next = nextPart(part);
  const prev = prevPart(part);
  const nextLabel = SERVICE_PARTS.find((p) => p.id === next)?.label;
  const prevLabel = SERVICE_PARTS.find((p) => p.id === prev)?.label;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-uiCardRule bg-uiBg">
      <nav aria-label={`${name} parts`} className="flex shrink-0 flex-wrap gap-1.5 border-b border-uiCardRule/70 px-4 py-3">
        {SERVICE_PARTS.map((p, n) => {
          const cur = p.id === part;
          const isDone = p.id !== 'summary' && done[p.id as keyof typeof done];
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPart(p.id)}
              aria-current={cur ? 'step' : undefined}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] transition-colors"
              style={cur
                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 }
                : isDone
                  ? { color: '#2f6e46', borderColor: 'rgba(63,143,92,.4)', background: 'var(--ok-glow)' }
                  : { color: 'var(--ui-fg-2)', borderColor: 'var(--ui-card-rule)' }}
            >
              <span className="font-chromeMono text-[11px]">{n + 1}</span>
              {p.label}
              {isDone && !cur && <CheckCircle size={12} weight="fill" aria-label="has entries" />}
            </button>
          );
        })}
      </nav>

      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-7 py-5">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-[30px] font-bold leading-none text-uiInk">
            {part === 'summary' ? name : `${name} · ${label.toLowerCase()}`}
          </h3>
          {part === 'summary' && (hint.page
            ? <Tag tone="teal">Own page · /services/{slug}</Tag>
            : <Tag tone="warn" title={hint.text}>Section only · {hint.short} short</Tag>)}
        </div>

        {part === 'basics' && (
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold text-uiInk">{BASICS_LABEL.name}</span>
              <input value={item.t ?? ''} onChange={(e) => setField(`${base}.t`, e.target.value)} className={BIG_INPUT} />
            </label>
            <div>
              <label htmlFor={`${base}.tag`} className="mb-1.5 block text-[15px] font-semibold text-uiInk">{BASICS_LABEL.tag}</label>
              <input id={`${base}.tag`} value={item.tag ?? ''} placeholder="e.g. Cooling" onChange={(e) => setField(`${base}.tag`, e.target.value)} className={BIG_INPUT} />
              <Suggest values={categorySuggestions(menuTags, content, item.tag ?? '')} onPick={(v) => setField(`${base}.tag`, v)} />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold text-uiInk">{BASICS_LABEL.priceFrom}</span>
              <input
                value={item.priceFrom ?? ''}
                placeholder="e.g. $89"
                onChange={(e) => setField(`${base}.priceFrom`, e.target.value.trim() ? e.target.value : null)}
                className={BIG_INPUT}
              />
            </label>
            <div>
              <label htmlFor={`${base}.duration`} className="mb-1.5 block text-[15px] font-semibold text-uiInk">{BASICS_LABEL.duration}</label>
              <input
                id={`${base}.duration`}
                value={item.duration ?? ''}
                placeholder="e.g. Half a day"
                maxLength={40}
                onChange={(e) => setField(`${base}.duration`, e.target.value.trim() ? e.target.value : null)}
                className={BIG_INPUT}
              />
              <Suggest values={DURATION_CHOICES.filter((d) => d !== item.duration)} onPick={(v) => setField(`${base}.duration`, v)} />
            </div>
          </div>
        )}

        {part === 'included' && (
          <>
            <ListPart
              values={item.included ?? []}
              onChange={(v) => setField(`${base}.included`, v)}
              placeholder="e.g. Written quote before any work"
              meter={{ have: (item.included ?? []).filter((x) => x.trim()).length, need: SERVICE_GATE.INCLUDED_MIN }}
              inputId={`${base}.included`}
            />
            <Suggest values={notIn(sugg.included, item.included)} plus onPick={(v) => setField(`${base}.included`, [...(item.included ?? []), v])} />
          </>
        )}

        {part === 'problems' && (
          <>
            <ListPart
              values={item.typicalJobs ?? []}
              onChange={(v) => setField(`${base}.typicalJobs`, v)}
              placeholder="e.g. AC blowing warm air"
              meter={{ have: (item.typicalJobs ?? []).filter((x) => x.trim()).length, need: SERVICE_GATE.TYPICAL_JOBS_MIN }}
              inputId={`${base}.typicalJobs`}
            />
            <Suggest values={notIn(sugg.jobs, item.typicalJobs)} plus onPick={(v) => setField(`${base}.typicalJobs`, [...(item.typicalJobs ?? []), v])} />
          </>
        )}

        {part === 'towns' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[15px] font-semibold text-uiInk">Towns this service covers</p>
              <ToggleChips
                options={area}
                selected={item.areas ?? []}
                onChange={(v) => setField(`${base}.areas`, serviceAreasToStore(v, area))}
                emptyNote="No service area yet (Area & profiles step)."
              />
            </div>
            <div>
              <p className="mb-2 text-[15px] font-semibold text-uiInk">Brands worked on</p>
              <ToggleChips
                options={brandsCarried}
                selected={item.brands ?? []}
                onChange={setBrands}
                emptyNote="No brands carried yet (Business step)."
              />
            </div>
          </div>
        )}

        {part === 'photos' && (
          <JobPhotos
            name={item.t}
            photos={myPhotos}
            onAdd={(p) => {
              ensureSlug();
              setField('work.projects', [...projects, { ...p, service: slug }]);
              // Photo 1 is also the service's own picture, as the onboarding form maps it.
              if (!item.image?.url && p.image) setField(`${base}.image`, p.image);
            }}
            onCaption={(k, caption) => setField('work.projects', projects.map((p, j) => (j === k ? { ...p, caption, image: p.image ? { ...p.image, alt: caption } : p.image } : p)))}
            onRemove={(k) => setField('work.projects', projects.filter((_, j) => j !== k))}
          />
        )}

        {part === 'questions' && (
          <div className="max-w-3xl space-y-2.5">
            {myQuestions.map(({ q, k }) => (
              <div key={k} className="space-y-1.5 rounded-xl border border-uiCardRule/70 bg-panel p-3">
                <div className="flex gap-2">
                  <input
                    aria-label="Question"
                    value={q.q}
                    placeholder="e.g. Is the diagnostic fee waived if the repair goes ahead?"
                    onChange={(e) => setQuestions(questions.map((x, j) => (j === k ? { ...x, q: e.target.value } : x)))}
                    className={BIG_INPUT}
                  />
                  <button type="button" aria-label="Remove question" onClick={() => setQuestions(questions.filter((_, j) => j !== k))} className="shrink-0 rounded p-1.5 text-uiFg3 hover:text-uiInk"><Trash size={15} /></button>
                </div>
                <input
                  aria-label="The client's answer"
                  value={q.a}
                  placeholder="Answer: not given"
                  onChange={(e) => setQuestions(questions.map((x, j) => (j === k ? { ...x, a: e.target.value } : x)))}
                  className={`${INPUT} h-9`}
                />
              </div>
            ))}
            <Suggest
              values={notIn(sugg.questions, myQuestions.map(({ q }) => q.q))}
              plus
              onPick={(v) => { ensureSlug(); setQuestions([...questions, { q: v, a: '', service: slug }]); }}
            />
            <button type="button" className="btn" onClick={() => { ensureSlug(); setQuestions([...questions, { q: '', a: '', service: slug }]); }}>
              <Plus size={13} /> Question
            </button>
          </div>
        )}

        {part === 'summary' && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SummaryBox title="Basics" has onEdit={() => onPart('basics')} lines={[
              `${BASICS_LABEL.tag}: ${item.tag?.trim() || 'not given'}`,
              `${BASICS_LABEL.priceFrom}: ${item.priceFrom?.trim() || 'not given'}`,
              `${BASICS_LABEL.duration}: ${item.duration?.trim() || 'not given'}`,
            ]} />
            <SummaryBox title="Included in the job" has={done.included} onEdit={() => onPart('included')} lines={item.included ?? []} />
            <SummaryBox title="Problems it fixes" has={done.problems} onEdit={() => onPart('problems')} lines={item.typicalJobs ?? []} />
            <SummaryBox title="Towns & brands" has={done.towns} onEdit={() => onPart('towns')} lines={[(item.areas ?? []).join(', '), (item.brands ?? []).join(', ')].filter(Boolean)} />
            <SummaryBox title="Photos" has={done.photos} onEdit={() => onPart('photos')} lines={myPhotos.map(({ p }) => p.caption)} />
            <SummaryBox title="Customer questions" has={done.questions} onEdit={() => onPart('questions')} lines={myQuestions.map(({ q }) => q.q).filter(Boolean)} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-uiCardRule/70 px-4 py-2.5">
        {prev ? (
          <button type="button" className="btn btn-sm" onClick={() => onPart(prev)}><ArrowLeft size={13} /> {prevLabel}</button>
        ) : <span />}
        {next ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => onPart(next)}>Next: {nextLabel} <ArrowRight size={13} /></button>
        ) : (
          <button type="button" className="btn btn-sm btn-primary" onClick={onNextService}>
            {nextName ? <>Next service: {nextName}</> : <>Next: Area &amp; profiles</>} <ArrowRight size={13} />
          </button>
        )}
      </div>
    </section>
  );
}

/** Tap-to-fill choices under a field. Only real, approved choices: the industry's own
 *  categories, the onboarding form's job lengths, and the approved per-service suggestions on
 *  @jdd/schema's industry menu (serviceSuggestions, v1.33.0). `plus` marks a tap that ADDS to a
 *  list rather than filling a field. */
function Suggest({ values, onPick, plus }: { values: readonly string[]; onPick: (v: string) => void; plus?: boolean }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-2 flex max-w-3xl flex-wrap gap-1.5">
      {values.map((v) => (
        <button key={v} type="button" onClick={() => onPick(v)} className="inline-flex h-7 items-center rounded-full border border-dashed border-uiCardRule px-2.5 text-[12.5px] text-uiFg2 hover:border-uiAccent hover:text-uiInk">
          {plus ? `+ ${v}` : v}
        </button>
      ))}
    </div>
  );
}

/** Suggestions not already in the list (case-insensitive). */
function notIn(suggested: string[], present: string[] | undefined | null): string[] {
  const have = new Set((present ?? []).map((x) => x.trim().toLowerCase()));
  return suggested.filter((s) => !have.has(s.trim().toLowerCase()));
}

/** A list part (Included in the job, Problems it fixes): what's there, the box for the next one,
 *  and how many more its own page needs. */
function ListPart({
  values, onChange, placeholder, meter, inputId,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  meter: { have: number; need: number };
  inputId: string;
}) {
  const pct = Math.min(100, Math.round((meter.have / meter.need) * 100));
  const enough = meter.have >= meter.need;
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-2.5 text-[13px] text-uiFg2">
        <span className="h-1.5 w-36 overflow-hidden rounded-full" style={{ background: 'var(--ui-surface-2)' }}>
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: enough ? 'var(--ok)' : 'var(--warn)' }} />
        </span>
        <span className="font-chromeMono text-2xs">{Math.min(meter.have, meter.need)} of {meter.need} for its own page</span>
      </div>
      <ChipListEditor values={values} onChange={onChange} placeholder={placeholder} inputId={inputId} />
    </div>
  );
}

function SummaryBox({ title, has, lines, onEdit }: { title: string; has: boolean; lines: string[]; onEdit: () => void }) {
  return (
    <div className={`flex min-h-[130px] flex-col gap-2 rounded-xl p-3.5 ${has ? 'border border-uiCardRule bg-panel' : 'border border-dashed'}`} style={has ? undefined : { borderColor: 'rgba(200,132,42,.6)' }}>
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-bold text-uiInk">{title}</span>
        <button type="button" onClick={onEdit} className="ml-auto text-xs font-medium" style={{ color: 'var(--accent)' }}>{has ? 'Edit' : 'Add'}</button>
      </div>
      {has ? (
        <ul className="list-disc space-y-0.5 pl-4 text-[13px] leading-snug text-uiFg2">
          {lines.filter(Boolean).slice(0, 5).map((l, k) => <li key={k} className="truncate">{l}</li>)}
        </ul>
      ) : (
        <span className="text-[13px] italic" style={{ color: '#7d500f' }}>None yet</span>
      )}
    </div>
  );
}

/** Where the open part shows on the client's site, highlighted. Values only, no help text. */
function WhereItShows({ content, item, index, slug, part }: { content: SiteContent; item: Item; index: number; slug: string; part: ServicePartId }) {
  const hint = servicePageHint(SERVICE_GATE, content, index);
  const page = hint.page ? `Its own page · /services/${slug}` : 'Services page section';
  const hl = { outline: '2px dashed var(--accent-2, #d2542f)', outlineOffset: 4, borderRadius: 6 } as const;
  const cap = 'font-chromeMono text-[10px] uppercase tracking-[0.12em] text-[#9c3a1e]';
  const projects = (content.work?.projects ?? []).filter((p) => p.service === slug);
  const qs = ((content.extensions?.customerQuestions ?? []) as Question[]).filter((q) => q.service === slug && q.q.trim());
  return (
    <Card title="Where it shows" className="hidden xl:flex" bodyClassName="space-y-3 p-3.5">
      {part === 'basics' ? (
        <>
          <p className="font-chromeMono text-[10px] uppercase tracking-[0.14em] text-uiFg3">Service card · home and /services</p>
          <div className="flex flex-col gap-2.5 rounded-xl border border-uiCardRule/70 bg-panel p-4">
            <span className={cap}>{BASICS_LABEL.tag}</span>
            <span className="w-max rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ ...hl, background: 'rgba(31,111,120,.12)', color: '#174f56' }}>{item.tag?.trim() || 'Category'}</span>
            <span className="font-display text-[22px] font-bold leading-tight text-uiInk" style={hl}>{item.t?.trim() || 'Service name'}</span>
            <span className="text-[13px] leading-relaxed text-uiFg2">{item.d?.trim() || 'Written at generation'}</span>
            <span className="flex gap-3 text-[13px]">
              <span style={hl} className="px-1 font-semibold text-uiInk">{item.priceFrom?.trim() ? `From ${item.priceFrom}` : 'Starting price'}</span>
              <span style={hl} className="px-1 text-uiFg3">{item.duration?.trim() || 'Usual job length'}</span>
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="font-chromeMono text-[10px] uppercase tracking-[0.14em] text-uiFg3">{page}</p>
          <div className="flex flex-col gap-2.5 rounded-xl border border-uiCardRule/70 bg-panel p-4">
            <span className="font-display text-[20px] font-bold leading-tight text-uiInk">{item.t?.trim() || 'Service name'}</span>
            <PreviewBlock on={part === 'included'} title="Included in the job" lines={item.included ?? []} hl={hl} cap={cap} />
            <PreviewBlock on={part === 'problems'} title="Problems it fixes" lines={item.typicalJobs ?? []} hl={hl} cap={cap} />
            <PreviewBlock on={part === 'towns'} title="Towns & brands" lines={[(item.areas ?? []).join(', '), (item.brands ?? []).join(', ')].filter(Boolean)} hl={hl} cap={cap} />
            <PreviewBlock on={part === 'photos'} title="Photos" lines={projects.map((p) => p.caption)} hl={hl} cap={cap} />
            <PreviewBlock on={part === 'questions'} title="Customer questions" lines={qs.map((q) => q.q)} hl={hl} cap={cap} />
          </div>
        </>
      )}
    </Card>
  );
}

function PreviewBlock({ on, title, lines, hl, cap }: { on: boolean; title: string; lines: string[]; hl: React.CSSProperties; cap: string }) {
  const shown = lines.filter((l) => l && l.trim());
  if (!on) return <span className="text-[12.5px] text-uiFg3">{title}{shown.length ? ` (${shown.length})` : ''}</span>;
  return (
    <div style={hl} className="px-2 py-1.5">
      <span className={cap}>{title}</span>
      {shown.length ? (
        <ul className="mt-1.5 list-disc pl-4 text-[13px] leading-relaxed text-uiFg2">
          {shown.slice(0, 6).map((l, k) => <li key={k}>{l}</li>)}
        </ul>
      ) : (
        <p className="mt-1 text-[13px] italic text-uiFg3">Hidden until something is added</p>
      )}
    </div>
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
      <ul className="space-y-1.5">
        {photos.map(({ p, k }) => {
          const url = p.image?.url ?? '';
          // A staged upload shows through the console (lib/stagedUploads.ts): a photo is seen the
          // moment it's added, not hidden until export.
          const src = previewSrc(url);
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
