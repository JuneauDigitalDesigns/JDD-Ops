'use client';

import { useState } from 'react';
import { Warning, BracketsCurly, Copy, X, Check } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { VerticalId } from '@/lib/verticals';
import type { Section as CopySection } from '@/lib/copy-schema';
import { ALL_SECTIONS } from '@/lib/copy-schema';
import GenerateCopyPanel from '@/app/build/GenerateCopyPanel';
import VerticalPicker from '@/app/build/VerticalPicker';
import {
  Field, Area, Checkbox, Color, ImageSlot, Section,
  ItemListSection, StringListSection, GenerateSectionButton,
} from '@/components/fields';

/**
 * Step 2: the full structured-intake editor. One collapsible section per build-studio
 * category (Brand, Nav, Hero, Trust, About, Services, Work, Testimonials, FAQ, Final CTA,
 * Footer, SEO), each with its complete field set + inline list editors and a per-section
 * "Generate" button. Everything writes through setField into the shared `edits` layer, so
 * edits carry into the builder, preview, and exported site.ts.
 */
export default function IntakeReviewStep({
  slug,
  vertical,
  onVerticalChange,
  effective,
  setField,
  generated,
  onGenerated,
  onClearGenerated,
  onReplaceContent,
}: {
  slug: string;
  vertical: VerticalId;
  onVerticalChange: (v: VerticalId) => void;
  effective: SiteContent;
  setField: (path: string, value: unknown) => void;
  generated: Partial<SiteContent> | null;
  onGenerated: (p: Partial<SiteContent>) => void;
  onClearGenerated: () => void;
  onReplaceContent: (site: SiteContent) => void;
}) {
  const [genBusy, setGenBusy] = useState<string | null>(null);
  const missing = effective._meta?.missing_fields ?? [];

  // ── Editable JSON view ──────────────────────────────────────────────────────
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function openJson() {
    setJsonText(JSON.stringify(effective, null, 2));
    setJsonError(null);
    setCopied(false);
    setJsonOpen(true);
  }
  function saveJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON.');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setJsonError('The JSON must be an object (the site content).');
      return;
    }
    onReplaceContent(parsed as SiteContent);
    setJsonOpen(false);
  }
  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  const fieldFlagged = (path: string) =>
    missing.some((m) => path === m || path.startsWith(`${m}.`) || m.startsWith(`${path}.`));
  const sectionFlagged = (prefix: string) =>
    missing.some((m) => m === prefix || m.startsWith(`${prefix}.`));

  // Regenerate a single copy section and merge it onto any existing generated copy.
  async function genSection(name: CopySection) {
    setGenBusy(name);
    try {
      const res = await fetch('/api/build/generate-copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vertical, base: effective, sections: [name] }),
      });
      const data = (await res.json()) as { generated?: Partial<SiteContent>; error?: string };
      if (res.ok && data.generated) onGenerated({ ...(generated ?? {}), ...data.generated });
    } finally {
      setGenBusy(null);
    }
  }
  const genBtn = (name: CopySection) => (
    <GenerateSectionButton onClick={() => genSection(name)} busy={genBusy === name} />
  );

  const f = { content: effective, setField };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-chromeMono text-xs uppercase tracking-widest text-uiInkSoft">Step 2</p>
            <h1 className="mt-2 font-display text-3xl font-medium text-uiInk">
              Review the intake{slug ? <span className="text-uiInkSoft"> · {slug}</span> : null}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5">
              <span className="font-chromeMono text-[10px] uppercase tracking-widest text-uiInkSoft">Industry</span>
              <VerticalPicker vertical={vertical} onChange={onVerticalChange} />
            </label>
            <button
              type="button"
              onClick={openJson}
              className="inline-flex items-center gap-1.5 rounded-md border border-uiRule px-2.5 py-1.5 text-xs font-medium text-uiInk hover:border-uiInk"
            >
              <BracketsCurly size={14} /> JSON
            </button>
          </div>
        </div>
        <p className="mt-3 max-w-prose text-sm text-uiInkSoft">
          Pick the industry (sets the placeholder copy), then fill in every section — generate copy for
          the whole site or one section at a time, or edit the raw JSON. Edits carry through to the
          builder, preview, and export.
        </p>
      </header>

      {missing.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <Warning size={16} /> {missing.length} field(s) flagged for review
          </p>
          <p className="mt-1 font-chromeMono text-xs text-amber-800">{missing.join(' · ')}</p>
        </div>
      )}

      {/* Whole-site copy generation. */}
      <div className="mb-6">
        <GenerateCopyPanel
          vertical={vertical}
          base={effective}
          sections={ALL_SECTIONS}
          generated={generated}
          onGenerated={onGenerated}
          onClearGenerated={onClearGenerated}
        />
      </div>

      {/* Section-by-section editors, mirroring the studio categories. */}
      <div className="rounded-lg border border-uiRule bg-uiBg">
        <Section title="Brand" defaultOpen flagged={sectionFlagged('brand')} right={genBtn('brand')}>
          <Field {...f} path="brand.name" label="Name" flagged={fieldFlagged('brand.name')} />
          <Field {...f} path="brand.short" label="Short name" />
          <Field {...f} path="brand.long" label="Legal / long name" />
          <Field {...f} path="brand.tagline" label="Tagline" flagged={fieldFlagged('brand.tagline')} />
          <Field {...f} path="brand.established" label="Established" />
          <Field {...f} path="brand.phone" label="Phone (display)" />
          <Field {...f} path="brand.phoneHref" label="Phone href (tel:…)" />
          <Field {...f} path="brand.email" label="Email" />
          <Field {...f} path="brand.address" label="Address" flagged={fieldFlagged('brand.address')} />
          <Field {...f} path="brand.license" label="License" />
        </Section>

        <Section title="Palette" flagged={sectionFlagged('branding.palette')}>
          <Color {...f} path="brand.palette.accent" label="Accent" />
          <Color {...f} path="brand.palette.bg" label="Background" />
          <Color {...f} path="brand.palette.bgSoft" label="Background soft" />
          <Color {...f} path="brand.palette.ink" label="Ink" />
          <Color {...f} path="brand.palette.inkSoft" label="Ink soft" />
          <Color {...f} path="brand.palette.rule" label="Rule / border" />
        </Section>

        <Section title="Nav & announcement">
          <Field {...f} path="announcement" label="Announcement bar (optional)" />
          <ItemListSection
            content={effective} setField={setField} basePath="nav" title="Nav links"
            fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'Href' }]}
            makeBlank={() => ({ label: 'New', href: '#' })}
          />
        </Section>

        <Section title="Hero" flagged={sectionFlagged('hero')} right={genBtn('hero')}>
          <Field {...f} path="hero.eyebrow" label="Eyebrow" />
          <Field {...f} path="hero.headline" label="Headline" flagged={fieldFlagged('hero.headline')} />
          <Field {...f} path="hero.headlineEmphasis" label="Headline emphasis (accented substring)" />
          <Area {...f} path="hero.sub" label="Subheadline" flagged={fieldFlagged('hero.sub')} />
          <Field {...f} path="hero.cta" label="Primary CTA" />
          <Field {...f} path="hero.secondaryCta" label="Secondary CTA" />
          <Field {...f} path="hero.badge" label="Badge (optional)" />
          <Field {...f} path="hero.trust" label="Trust line" />
          <Field {...f} path="hero.formLabel" label="Form label" />
          <Field {...f} path="hero.placeholder" label="Form placeholder" />
          <StringListSection
            content={effective} setField={setField} basePath="hero.frictionReducers"
            title="Friction reducers" placeholder="e.g. No hidden fees"
          />
          <ItemListSection
            content={effective} setField={setField} basePath="hero.heroBullets" title="Hero stats"
            fields={[{ key: 'value', label: 'Value' }, { key: 'label', label: 'Label' }]}
            makeBlank={() => ({ value: '', label: '' })}
          />
        </Section>

        <Section title="Trust" flagged={sectionFlagged('trust')} right={genBtn('trust')}>
          <Field {...f} path="trust.label" label="Label" />
          <StringListSection
            content={effective} setField={setField} basePath="trust.logos"
            title="Trust logos" placeholder="e.g. BBB Accredited"
          />
        </Section>

        <Section title="About" flagged={sectionFlagged('about')} right={genBtn('about')}>
          <Field {...f} path="about.eyebrow" label="Eyebrow" />
          <Field {...f} path="about.title" label="Title" />
          <Area {...f} path="about.body" label="Body" flagged={fieldFlagged('about.body')} />
          <ItemListSection
            content={effective} setField={setField} basePath="about.pillars" title="Pillars"
            fields={[{ key: 'k', label: 'Icon key' }, { key: 't', label: 'Title' }, { key: 'd', label: 'Description', area: true }]}
            makeBlank={() => ({ k: 'star', t: 'New pillar', d: '' })}
          />
          <ItemListSection
            content={effective} setField={setField} basePath="about.stats" title="Stats"
            fields={[{ key: 'n', label: 'Number' }, { key: 'l', label: 'Label' }]}
            makeBlank={() => ({ n: '', l: '' })}
          />
        </Section>

        <Section title="Services" flagged={sectionFlagged('services')} right={genBtn('services')}>
          <Field {...f} path="services.eyebrow" label="Eyebrow" />
          <Field {...f} path="services.title" label="Title" />
          <Area {...f} path="services.sub" label="Subtitle" />
          <ItemListSection
            content={effective} setField={setField} basePath="services.items" title="Services"
            fields={[{ key: 't', label: 'Name' }, { key: 'tag', label: 'Tag' }, { key: 'd', label: 'Description', area: true }]}
            makeBlank={() => ({ n: '', t: 'New service', tag: '', d: '' })}
          />
        </Section>

        <Section title="Work" flagged={sectionFlagged('work')} right={genBtn('work')}>
          <Field {...f} path="work.eyebrow" label="Eyebrow" />
          <Field {...f} path="work.title" label="Title" />
          <Area {...f} path="work.sub" label="Subtitle" />
          <Checkbox {...f} path="work.hidden" label="Hide this section" />
          <ItemListSection
            content={effective} setField={setField} basePath="work.projects" title="Projects"
            fields={[
              { key: 't', label: 'Title' }, { key: 'loc', label: 'Location' }, { key: 'yr', label: 'Year' },
              { key: 'scope', label: 'Scope' }, { key: 'size', label: 'Size' }, { key: 'caption', label: 'Caption', area: true },
            ]}
            makeBlank={() => ({ t: 'New project', loc: '', yr: null, scope: '', size: '', caption: '' })}
          />
        </Section>

        <Section title="Testimonials" flagged={sectionFlagged('testimonials')} right={genBtn('testimonials')}>
          <Field {...f} path="testimonials.eyebrow" label="Eyebrow" />
          <Field {...f} path="testimonials.title" label="Title" />
          <ItemListSection
            content={effective} setField={setField} basePath="testimonials.items" title="Testimonials"
            fields={[
              { key: 'q', label: 'Quote', area: true }, { key: 'a', label: 'Author' },
              { key: 'r', label: 'Role' }, { key: 'company', label: 'Company / location' },
              { key: 'stars', label: 'Stars', type: 'number' },
            ]}
            makeBlank={() => ({ q: '', a: 'New reviewer', r: '', company: '', stars: 5 })}
          />
        </Section>

        <Section title="FAQ" flagged={sectionFlagged('faq')} right={genBtn('faq')}>
          <Field {...f} path="faq.eyebrow" label="Eyebrow" />
          <Field {...f} path="faq.title" label="Title" />
          <Area {...f} path="faq.sub" label="Subtitle" />
          <ItemListSection
            content={effective} setField={setField} basePath="faq.items" title="FAQ items"
            fields={[{ key: 'q', label: 'Question' }, { key: 'a', label: 'Answer', area: true }]}
            makeBlank={() => ({ q: 'New question', a: '' })}
          />
        </Section>

        <Section title="Final CTA" flagged={sectionFlagged('finalCta')} right={genBtn('finalCta')}>
          <Field {...f} path="finalCta.eyebrow" label="Eyebrow" />
          <Field {...f} path="finalCta.headline" label="Headline" />
          <Area {...f} path="finalCta.sub" label="Subtitle" />
          <Field {...f} path="finalCta.cta" label="Primary CTA" />
          <Field {...f} path="finalCta.secondary" label="Secondary line" />
          <StringListSection
            content={effective} setField={setField} basePath="finalCta.frictionReducers"
            title="Friction reducers" placeholder="e.g. Free estimates"
          />
        </Section>

        <Section title="Footer" flagged={sectionFlagged('footer')} right={genBtn('footer')}>
          <Area {...f} path="footer.blurb" label="Blurb" />
          <Field {...f} path="footer.legal" label="Legal line" />
          <ItemListSection
            content={effective} setField={setField} basePath="footer.social" title="Social links"
            fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'URL' }]}
            makeBlank={() => ({ label: '', href: '' })}
          />
          <ItemListSection
            content={effective} setField={setField} basePath="footer.legalLinks" title="Legal links"
            fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'URL' }]}
            makeBlank={() => ({ label: '', href: '#' })}
          />
        </Section>

        <Section title="Images">
          <ImageSlot {...f} path="images.hero.slides.0.url" label="Hero image 1" />
          <ImageSlot {...f} path="images.hero.slides.1.url" label="Hero image 2" />
          <ImageSlot {...f} path="images.about.feature" label="About image" />
          <ImageSlot {...f} path="images.footer.logoImage" label="Footer logo" />
        </Section>

        <Section title="SEO" flagged={sectionFlagged('seo')} right={genBtn('seo')}>
          <Field {...f} path="seo.title" label="Title" flagged={fieldFlagged('seo.title')} />
          <Area {...f} path="seo.description" label="Description" flagged={fieldFlagged('seo.description')} />
          <Field {...f} path="seo.canonical" label="Canonical URL" type="url" />
          <Field {...f} path="seo.googleAnalyticsId" label="Google Analytics ID" />
          <Field {...f} path="seo.facebookPixelId" label="Facebook Pixel ID" />
        </Section>
      </div>

      {/* ── Editable JSON modal ──────────────────────────────────────────── */}
      {jsonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex h-[95vh] w-full max-w-3xl flex-col rounded-lg border border-uiRule bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-uiRule px-5 py-3">
              <div>
                <h3 className="font-display text-lg font-medium text-uiInk">Structured intake · JSON</h3>
                <p className="text-xs text-uiInkSoft">Edit here or in the boxes — Save applies this JSON as the working copy.</p>
              </div>
              <button type="button" onClick={() => setJsonOpen(false)} aria-label="Close" className="text-uiInkSoft hover:text-uiInk">
                <X size={18} />
              </button>
            </div>

            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
              spellCheck={false}
              className="flex-1 resize-none overflow-auto border-0 px-5 py-4 font-chromeMono text-xs leading-relaxed text-uiInk outline-none"
            />

            {jsonError && (
              <p className="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800">
                <Warning size={14} /> {jsonError}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-uiRule px-5 py-3">
              <button
                type="button"
                onClick={copyJson}
                className="inline-flex items-center gap-1.5 rounded-md border border-uiRule px-3 py-1.5 text-sm text-uiInk hover:border-uiInk"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setJsonOpen(false)}
                  className="rounded-md border border-uiRule px-3 py-1.5 text-sm text-uiInk hover:border-uiInk"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveJson}
                  className="rounded-md bg-uiInk px-4 py-1.5 text-sm font-medium text-white hover:bg-uiInk/90"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
