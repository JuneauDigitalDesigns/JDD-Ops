'use client';

import { useRef, useState } from 'react';
import {
  CaretDoubleRight, CaretDoubleLeft, Plus, Trash, Sliders, UploadSimple, DotsSixVertical,
} from '@phosphor-icons/react';
import {
  DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SiteContent } from '@/data/site';
import { getPath } from '@/lib/merge';
import { FONT_OPTIONS } from '@/lib/fonts';

// Docked, width-animated control panel for everything that isn't naturally inline-editable:
// brand identity, palette, typography (in-font pickers), images (local upload), SEO, and
// add/remove/reorder of the structural lists. Every control writes through setField(path,
// value) into the same edits layer the inline <E> editors use. Because it's an in-flow flex
// sibling of <main>, opening it reflows the preview to the remaining width.

type SetField = (path: string, value: unknown) => void;

const INPUT_CLS =
  'w-full rounded-md border border-uiRuleStrong bg-uiSurface px-2.5 py-1.5 text-sm text-uiFg placeholder-uiFg3 outline-none focus:border-uiAccent';
const LABEL_CLS = 'mb-1 block font-chromeMono text-[10px] uppercase tracking-widest text-uiFg3';

function str(content: SiteContent, path: string): string {
  const v = getPath(content, path);
  return v === null || v === undefined ? '' : String(v);
}

function Field({
  content, setField, path, label, type = 'text', placeholder,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
  type?: 'text' | 'number' | 'url'; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={LABEL_CLS}>{label}</span>
      <input
        type={type === 'number' ? 'number' : 'text'}
        value={str(content, path)}
        placeholder={placeholder}
        onChange={(e) => setField(path, type === 'number' ? Number(e.target.value) : e.target.value)}
        className={INPUT_CLS}
      />
    </label>
  );
}

function Area({
  content, setField, path, label,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
}) {
  return (
    <label className="block">
      <span className={LABEL_CLS}>{label}</span>
      <textarea rows={3} value={str(content, path)} onChange={(e) => setField(path, e.target.value)} className={INPUT_CLS} />
    </label>
  );
}

function Color({
  content, setField, path, label,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
}) {
  const v = str(content, path) || '#000000';
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="font-chromeMono text-[10px] uppercase tracking-widest text-uiFg3">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="text"
          value={str(content, path)}
          onChange={(e) => setField(path, e.target.value)}
          className="w-20 rounded border border-uiRuleStrong bg-uiSurface px-1.5 py-1 font-chromeMono text-xs text-uiFg"
        />
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(v) ? v : '#000000'}
          onChange={(e) => setField(path, e.target.value)}
          className="h-7 w-7 cursor-pointer rounded border border-uiRuleStrong bg-transparent"
        />
      </span>
    </label>
  );
}

// In-font font picker: each option renders in its own typeface.
function FontSelect({
  content, setField, path, label, filter,
}: {
  content: SiteContent; setField: SetField; path: string; label: string; filter: 'sans' | 'heading';
}) {
  const current = str(content, path);
  const opts = FONT_OPTIONS.filter((o) => o.role === 'both' || o.role === filter);
  const known = opts.some((o) => o.stack === current);
  return (
    <label className="block">
      <span className={LABEL_CLS}>{label}</span>
      <select value={known ? current : ''} onChange={(e) => setField(path, e.target.value)} className={INPUT_CLS}>
        {!known && <option value="">System (current)</option>}
        {opts.map((o) => (
          <option key={o.id} value={o.stack} style={{ fontFamily: o.stack }}>{o.label}</option>
        ))}
      </select>
      {known && <p className="mt-1 text-lg text-uiFg2" style={{ fontFamily: current }}>The quick brown fox</p>}
    </label>
  );
}

function ImageSlot({
  content, setField, path, label,
}: {
  content: SiteContent; setField: SetField; path: string; label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const val = str(content, path);

  async function onFile(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/build/upload', { method: 'POST', body: fd });
      const d = (await r.json()) as { ref?: string };
      if (d.ref) setField(path, d.ref);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <span className={LABEL_CLS}>{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={val}
          onChange={(e) => setField(path, e.target.value)}
          placeholder="url or upload"
          className="min-w-0 flex-1 rounded-md border border-uiRuleStrong bg-uiSurface px-2.5 py-1.5 text-sm text-uiFg outline-none focus:border-uiAccent"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-uiRuleStrong px-2 py-1.5 text-xs text-uiFg2 hover:border-uiAccent hover:text-uiAccent disabled:opacity-50"
        >
          <UploadSimple size={13} /> {busy ? '…' : 'Upload'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
        />
      </div>
      {val && !val.startsWith('upload://') && /^https?:|^\//.test(val) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={val} alt="" className="mt-1 h-16 w-full rounded border border-uiRule object-cover" />
      )}
      {val.startsWith('upload://') && (
        <p className="font-chromeMono text-[10px] text-uiFg3">Staged: {val.slice('upload://'.length)} → /images at export</p>
      )}
    </div>
  );
}

// Sub-heading that groups related image slots inside the Images section.
function ImgSubhead({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 font-chromeMono text-[10px] uppercase tracking-widest text-uiFg2">{children}</p>;
}

// Editable hero slides: image + alt per slide, with add/remove. Replaces the old
// fixed 2-slot block so any number of slides can be edited.
function HeroImages({ content, setField }: { content: SiteContent; setField: SetField }) {
  const slides = (getPath(content, 'images.hero.slides') as Array<{ url?: string; alt?: string }> | undefined) ?? [];
  const write = (next: unknown) => setField('images.hero.slides', next);
  const add = () => write([...slides, { url: '', alt: '' }]);
  const remove = (i: number) => write(slides.filter((_, k) => k !== i));
  return (
    <div className="space-y-3">
      {slides.map((_, i) => (
        <div key={i} className="space-y-1.5 rounded-md border border-uiRule p-2">
          <div className="flex items-center justify-between">
            <span className="font-chromeMono text-[10px] uppercase tracking-widest text-uiFg3">Slide {i + 1}</span>
            <button type="button" onClick={() => remove(i)} aria-label="Remove slide" className="text-uiFg3 hover:text-red-400">
              <Trash size={13} />
            </button>
          </div>
          <ImageSlot content={content} setField={setField} path={`images.hero.slides.${i}.url`} label="Image" />
          <Field content={content} setField={setField} path={`images.hero.slides.${i}.alt`} label="Alt text" />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-uiRuleStrong px-3 py-1.5 text-xs font-medium text-uiFg2 hover:border-uiAccent hover:text-uiAccent"
      >
        <Plus size={13} /> Add hero slide
      </button>
    </div>
  );
}

// Per-item image editors for a list (services, work projects, testimonial avatars).
// Items are added/removed in their own ListSection; here we only edit each item's
// photo. Renders a hint when the list is empty.
function PerItemImages({
  content, setField, itemsPath, labelKey, urlPath, altPath, emptyHint,
}: {
  content: SiteContent; setField: SetField; itemsPath: string; labelKey: string;
  urlPath: (i: number) => string; altPath?: (i: number) => string; emptyHint: string;
}) {
  const items = (getPath(content, itemsPath) as Array<Record<string, unknown>> | undefined) ?? [];
  if (!items.length) return <p className="font-chromeMono text-[10px] text-uiFg3">{emptyHint}</p>;
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-1.5">
          <ImageSlot
            content={content}
            setField={setField}
            path={urlPath(i)}
            label={String(item[labelKey] ?? '') || `Item ${i + 1}`}
          />
          {altPath && <Field content={content} setField={setField} path={altPath(i)} label="Alt text" />}
        </div>
      ))}
    </div>
  );
}

function Section({ title, children, defaultOpen }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="border-b border-uiRule">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-uiFg2 hover:bg-uiSurface">
        {title}
      </summary>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </details>
  );
}

function SortableItem({ id, label, onRemove }: { id: string; label: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} className="flex items-center gap-2 rounded-md border border-uiRule bg-uiBg px-2.5 py-1.5">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        className="shrink-0 cursor-grab text-uiFg3 hover:text-uiFg active:cursor-grabbing"
      >
        <DotsSixVertical size={14} />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm text-uiFg2">{label}</span>
      <button type="button" onClick={onRemove} aria-label="Remove" className="text-uiFg3 hover:text-red-400">
        <Trash size={14} />
      </button>
    </li>
  );
}

function ListSection<T extends Record<string, unknown>>({
  content, setField, basePath, title, labelKey, makeBlank,
}: {
  content: SiteContent; setField: SetField; basePath: string; title: string;
  labelKey: string; makeBlank: () => T;
}) {
  const arr = (getPath(content, basePath) as T[] | undefined) ?? [];
  const write = (next: T[]) => setField(basePath, next);
  const remove = (i: number) => write(arr.filter((_, k) => k !== i));
  const add = () => write([...arr, makeBlank()]);
  const ids = arr.map((_, i) => `${basePath}-${i}`);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    write(arrayMove(arr, from, to));
  }

  return (
    <Section title={`${title} (${arr.length})`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {arr.map((item, i) => (
              <SortableItem
                key={ids[i]}
                id={ids[i]}
                label={String(item[labelKey] ?? '') || `Item ${i + 1}`}
                onRemove={() => remove(i)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-uiRuleStrong px-3 py-1.5 text-xs font-medium text-uiFg2 hover:border-uiAccent hover:text-uiAccent"
      >
        <Plus size={13} /> Add {title.replace(/s$/, '').toLowerCase()}
      </button>
      <p className="font-chromeMono text-[10px] text-uiFg3">Drag to reorder · edit each item&apos;s text in the live preview.</p>
    </Section>
  );
}

export default function BrandDrawer({ content, setField }: { content: SiteContent; setField: SetField }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative flex h-full">
      {/* Edge toggle — sits on the panel's left edge (or main's right edge when closed) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close brand panel' : 'Open brand panel'}
        className="absolute top-1/2 z-20 flex -translate-x-full -translate-y-1/2 items-center gap-1.5 rounded-l-lg border border-r-0 border-uiRule bg-uiBg py-3 pl-2.5 pr-2 text-uiAccent shadow-lg"
      >
        {open ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
        {!open && (
          <span className="flex items-center gap-1 font-chromeMono text-[10px] uppercase tracking-widest">
            <Sliders size={13} /> Brand
          </span>
        )}
      </button>

      {/* Docked, width-animated panel — main reflows as this grows */}
      <aside
        style={{ width: open ? 360 : 0 }}
        className="h-full overflow-hidden border-l border-uiRule bg-uiBg text-uiFg transition-[width] duration-300 ease-out"
      >
        <div className="flex h-full w-[360px] flex-col">
          <div className="border-b border-uiRule px-4 py-4">
            <p className="font-display text-sm font-medium text-uiFg">Brand &amp; settings</p>
            <p className="font-chromeMono text-xs text-uiFg3">colors · type · images · lists</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            <Section title="Brand" defaultOpen>
              <Field content={content} setField={setField} path="brand.name" label="Name" />
              <Field content={content} setField={setField} path="brand.short" label="Short name" />
              <Field content={content} setField={setField} path="brand.long" label="Legal / long name" />
              <Field content={content} setField={setField} path="brand.tagline" label="Tagline" />
              <Field content={content} setField={setField} path="brand.established" label="Established" />
              <Field content={content} setField={setField} path="brand.phone" label="Phone (display)" />
              <Field content={content} setField={setField} path="brand.phoneHref" label="Phone href (tel:…)" />
              <Field content={content} setField={setField} path="brand.email" label="Email" />
              <Field content={content} setField={setField} path="brand.address" label="Address" />
              <Field content={content} setField={setField} path="brand.license" label="License" />
            </Section>

            <Section title="Palette">
              <Color content={content} setField={setField} path="brand.palette.accent" label="Accent" />
              <Color content={content} setField={setField} path="brand.palette.accentFg" label="Accent text" />
              <Color content={content} setField={setField} path="brand.palette.bg" label="Background" />
              <Color content={content} setField={setField} path="brand.palette.bgSoft" label="Background soft" />
              <Color content={content} setField={setField} path="brand.palette.ink" label="Ink" />
              <Color content={content} setField={setField} path="brand.palette.inkSoft" label="Ink soft" />
              <Color content={content} setField={setField} path="brand.palette.rule" label="Rule / border" />
            </Section>

            <Section title="Typography">
              <FontSelect content={content} setField={setField} path="brand.typography.fontHeading" label="Heading font" filter="heading" />
              <FontSelect content={content} setField={setField} path="brand.typography.fontSans" label="Body font" filter="sans" />
              <Field content={content} setField={setField} path="brand.typography.headingWeight" label="Heading weight" type="number" />
              <Field content={content} setField={setField} path="brand.typography.bodyWeight" label="Body weight" type="number" />
              <Field content={content} setField={setField} path="brand.typography.headingTracking" label="Heading tracking" />
              <Field content={content} setField={setField} path="brand.typography.headingLineHeight" label="Heading line-height" type="number" />
            </Section>

            <Section title="Images">
              <ImgSubhead>Hero slides</ImgSubhead>
              <HeroImages content={content} setField={setField} />

              <ImgSubhead>About</ImgSubhead>
              <ImageSlot content={content} setField={setField} path="images.about.feature" label="About image" />

              <ImgSubhead>Footer</ImgSubhead>
              <ImageSlot content={content} setField={setField} path="images.footer.logoImage" label="Footer logo" />

              <ImgSubhead>Service images</ImgSubhead>
              <PerItemImages
                content={content}
                setField={setField}
                itemsPath="services.items"
                labelKey="t"
                urlPath={(i) => `services.items.${i}.image.url`}
                altPath={(i) => `services.items.${i}.image.alt`}
                emptyHint="No services yet — add them below to attach photos."
              />

              <ImgSubhead>Work project images</ImgSubhead>
              <PerItemImages
                content={content}
                setField={setField}
                itemsPath="work.projects"
                labelKey="t"
                urlPath={(i) => `work.projects.${i}.image.url`}
                altPath={(i) => `work.projects.${i}.image.alt`}
                emptyHint="No work projects yet — add one in “Work projects” below, then set its photo here."
              />

              <ImgSubhead>Testimonial avatars</ImgSubhead>
              <PerItemImages
                content={content}
                setField={setField}
                itemsPath="testimonials.items"
                labelKey="a"
                urlPath={(i) => `images.testimonials.avatars.${i}`}
                emptyHint="No testimonials yet — add them below to attach avatars."
              />
            </Section>

            <Section title="SEO">
              <Field content={content} setField={setField} path="seo.title" label="Title" />
              <Area content={content} setField={setField} path="seo.description" label="Description" />
              <Field content={content} setField={setField} path="seo.canonical" label="Canonical URL" type="url" />
              <Field content={content} setField={setField} path="seo.googleAnalyticsId" label="Google Analytics ID" />
              <Field content={content} setField={setField} path="seo.facebookPixelId" label="Facebook Pixel ID" />
            </Section>

            <ListSection
              content={content} setField={setField} basePath="services.items" title="Services" labelKey="t"
              makeBlank={() => ({ n: '', t: 'New service', d: '', tag: '' })}
            />
            <ListSection
              content={content} setField={setField} basePath="faq.items" title="FAQ items" labelKey="q"
              makeBlank={() => ({ q: 'New question', a: '' })}
            />
            <ListSection
              content={content} setField={setField} basePath="testimonials.items" title="Testimonials" labelKey="a"
              makeBlank={() => ({ q: '', a: 'New reviewer', r: '', company: '', stars: 5 })}
            />
            <ListSection
              content={content} setField={setField} basePath="work.projects" title="Work projects" labelKey="t"
              makeBlank={() => ({ t: 'New project', loc: '', yr: null, scope: '', size: '', caption: '' })}
            />
            <ListSection
              content={content} setField={setField} basePath="nav" title="Nav links" labelKey="label"
              makeBlank={() => ({ label: 'New', href: '#' })}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
