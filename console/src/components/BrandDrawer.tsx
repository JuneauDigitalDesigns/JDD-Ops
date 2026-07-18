'use client';

import { useState } from 'react';
import { CaretDoubleRight, CaretDoubleLeft, Sliders } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import {
  Field, Area, Color, FontSelect, ImageSlot, Section, ListSection, type SetField,
} from '@/components/fields';

// Docked, width-animated control panel for everything that isn't naturally inline-editable:
// brand identity, palette, typography (in-font pickers), images (local upload), SEO, and
// add/remove/reorder of the structural lists. Every control writes through setField(path,
// value) into the same edits layer the inline <E> editors use. Because it's an in-flow flex
// sibling of <main>, opening it reflows the preview to the remaining width. Form primitives
// live in components/fields/ (shared with the wizard's intake step).

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
              <ImageSlot content={content} setField={setField} path="images.hero.slides.0.url" label="Hero image 1" />
              <Field content={content} setField={setField} path="images.hero.slides.0.alt" label="Hero image 1 alt" />
              <ImageSlot content={content} setField={setField} path="images.hero.slides.1.url" label="Hero image 2" />
              <ImageSlot content={content} setField={setField} path="images.about.feature" label="About image" />
              <ImageSlot content={content} setField={setField} path="images.footer.logoImage" label="Footer logo" />
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
