'use client';

import { useState } from 'react';
import { CaretDoubleRight, CaretDoubleLeft, Plus, Trash, ArrowUp, ArrowDown, Sliders } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { getPath } from '@/lib/merge';

// Right-side slide-out drawer for everything that isn't naturally inline-editable: brand
// identity, palette colors, typography, SEO, image URLs, and add/remove/reorder of the
// structural lists. Every control writes through setField(path, value) into the same edits
// layer the inline <E> editors use. Styled as a dark Aurora-Glass chrome surface to match
// the sidebar + top nav rails.

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
      <textarea
        rows={3}
        value={str(content, path)}
        onChange={(e) => setField(path, e.target.value)}
        className={INPUT_CLS}
      />
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

function ListSection<T extends Record<string, unknown>>({
  content, setField, basePath, title, labelKey, makeBlank,
}: {
  content: SiteContent; setField: SetField; basePath: string; title: string;
  labelKey: string; makeBlank: () => T;
}) {
  const arr = (getPath(content, basePath) as T[] | undefined) ?? [];
  const write = (next: T[]) => setField(basePath, next);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const n = [...arr];
    [n[i], n[j]] = [n[j], n[i]];
    write(n);
  };
  const remove = (i: number) => write(arr.filter((_, k) => k !== i));
  const add = () => write([...arr, makeBlank()]);

  return (
    <Section title={`${title} (${arr.length})`}>
      <ul className="space-y-1.5">
        {arr.map((item, i) => (
          <li key={i} className="flex items-center gap-2 rounded-md border border-uiRule px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm text-uiFg2">
              {String(item[labelKey] ?? '') || `Item ${i + 1}`}
            </span>
            <button type="button" onClick={() => move(i, -1)} aria-label="Move up" className="text-uiFg3 hover:text-uiFg"><ArrowUp size={14} /></button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Move down" className="text-uiFg3 hover:text-uiFg"><ArrowDown size={14} /></button>
            <button type="button" onClick={() => remove(i)} aria-label="Remove" className="text-uiFg3 hover:text-red-400"><Trash size={14} /></button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-uiRuleStrong px-3 py-1.5 text-xs font-medium text-uiFg2 hover:border-uiAccent hover:text-uiAccent"
      >
        <Plus size={13} /> Add {title.replace(/s$/, '').toLowerCase()}
      </button>
      <p className="font-chromeMono text-[10px] text-uiFg3">Edit each item&apos;s text directly in the live preview.</p>
    </Section>
  );
}

export default function BrandDrawer({ content, setField }: { content: SiteContent; setField: SetField }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Edge toggle tab */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close brand panel' : 'Open brand panel'}
        className={`fixed top-1/2 z-50 flex -translate-y-1/2 items-center gap-1.5 rounded-l-lg border border-r-0 border-uiRule bg-uiBg py-3 pl-2.5 pr-2 text-uiAccent shadow-lg transition-all ${open ? 'right-[360px]' : 'right-0'}`}
      >
        {open ? <CaretDoubleRight size={16} /> : <CaretDoubleLeft size={16} />}
        {!open && (
          <span className="flex items-center gap-1 font-chromeMono text-[10px] uppercase tracking-widest">
            <Sliders size={13} /> Brand
          </span>
        )}
      </button>

      {/* Drawer panel */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 flex w-[360px] flex-col border-l border-uiRule bg-uiBg text-uiFg shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="border-b border-uiRule px-4 py-4">
          <p className="font-display text-sm font-medium text-uiFg">Brand &amp; settings</p>
          <p className="font-chromeMono text-xs text-uiFg3">colors · type · SEO · lists</p>
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
            <Field content={content} setField={setField} path="brand.typography.fontSans" label="Body font" />
            <Field content={content} setField={setField} path="brand.typography.fontHeading" label="Heading font" />
            <Field content={content} setField={setField} path="brand.typography.headingWeight" label="Heading weight" type="number" />
            <Field content={content} setField={setField} path="brand.typography.bodyWeight" label="Body weight" type="number" />
            <Field content={content} setField={setField} path="brand.typography.headingTracking" label="Heading tracking" />
            <Field content={content} setField={setField} path="brand.typography.headingLineHeight" label="Heading line-height" type="number" />
          </Section>

          <Section title="SEO">
            <Field content={content} setField={setField} path="seo.title" label="Title" />
            <Area content={content} setField={setField} path="seo.description" label="Description" />
            <Field content={content} setField={setField} path="seo.canonical" label="Canonical URL" type="url" />
            <Field content={content} setField={setField} path="seo.googleAnalyticsId" label="Google Analytics ID" />
            <Field content={content} setField={setField} path="seo.facebookPixelId" label="Facebook Pixel ID" />
          </Section>

          <Section title="Images">
            <Field content={content} setField={setField} path="images.hero.slides.0.url" label="Hero image URL" type="url" />
            <Field content={content} setField={setField} path="images.hero.slides.0.alt" label="Hero image alt" />
            <Field content={content} setField={setField} path="images.about.feature" label="About image URL" type="url" />
            <Field content={content} setField={setField} path="images.footer.logoImage" label="Footer logo URL" type="url" />
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
      </aside>
    </>
  );
}
