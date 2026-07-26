'use client';

import { Plus, Trash } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';
import ImageTile, { str } from './ImageTile';

// Thumbnail-first image editing. The old ImageSlot led with a URL text input and hid the
// picture; ImageTile (extracted so the Services / Work list panes share it) makes the tile
// itself the control.

function AltField({
  content, setField, path,
}: {
  content: SiteContent; setField: SetField; path: string;
}) {
  return (
    <input
      type="text"
      value={str(content, path)}
      onChange={(e) => setField(path, e.target.value)}
      placeholder="Alt text"
      aria-label="Alt text"
      className="w-full rounded border border-uiRuleStrong bg-uiSurface px-1.5 py-1 text-xs text-uiFg outline-none focus:border-uiAccent"
    />
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="kicker mb-2 block">{title}</p>
      {children}
    </div>
  );
}

function HeroImages({ content, setField }: { content: SiteContent; setField: SetField }) {
  const slides = (getPath(content, 'images.hero.slides') as Array<{ url?: string; alt?: string }> | undefined) ?? [];
  const write = (next: unknown) => setField('images.hero.slides', next);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {slides.map((_, i) => (
          <div key={i} className="space-y-1">
            <ImageTile
              content={content} setField={setField}
              path={`images.hero.slides.${i}.url`} label={`Slide ${i + 1}`}
            />
            <AltField content={content} setField={setField} path={`images.hero.slides.${i}.alt`} />
            <button
              type="button"
              onClick={() => write(slides.filter((_, k) => k !== i))}
              className="flex items-center gap-1 font-chromeMono text-2xs uppercase tracking-widest text-uiFg3 hover:text-red-500"
            >
              <Trash size={11} /> Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => write([...slides, { url: '', alt: '' }])}
        className="btn btn-sm border-dashed"
      >
        <Plus size={13} /> Add hero slide
      </button>
    </div>
  );
}

function PerItemImages({
  content, setField, itemsPath, labelKey, urlPath, altPath, emptyHint, round,
}: {
  content: SiteContent; setField: SetField; itemsPath: string; labelKey: string;
  urlPath: (i: number) => string; altPath?: (i: number) => string; emptyHint: string; round?: boolean;
}) {
  const items = (getPath(content, itemsPath) as Array<Record<string, unknown>> | undefined) ?? [];
  if (!items.length) return <p className="text-sm text-uiFg3">{emptyHint}</p>;
  return (
    <div className={`grid gap-2 ${round ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <ImageTile
            content={content} setField={setField} path={urlPath(i)} round={round}
            label={String(item[labelKey] ?? '') || `Item ${i + 1}`}
          />
          {altPath && <AltField content={content} setField={setField} path={altPath(i)} />}
        </div>
      ))}
    </div>
  );
}

export default function ImagesPane({
  content, setField,
}: {
  content: SiteContent; setField: SetField;
}) {
  return (
    <div className="space-y-5 px-4 py-4">
      <Group title="Hero slides">
        <HeroImages content={content} setField={setField} />
      </Group>

      <Group title="About">
        <div className="grid grid-cols-2 gap-2">
          <ImageTile content={content} setField={setField} path="images.about.feature" label="About image" />
        </div>
      </Group>

      <Group title="Footer">
        <div className="grid grid-cols-2 gap-2">
          <ImageTile content={content} setField={setField} path="images.footer.logoImage" label="Footer logo" />
        </div>
      </Group>

      <Group title="Service images">
        <PerItemImages
          content={content} setField={setField}
          itemsPath="services.items" labelKey="t"
          urlPath={(i) => `services.items.${i}.image.url`}
          altPath={(i) => `services.items.${i}.image.alt`}
          emptyHint="No services yet — add them in Content to attach photos."
        />
      </Group>

      <Group title="Work project images">
        <PerItemImages
          content={content} setField={setField}
          itemsPath="work.projects" labelKey="t"
          urlPath={(i) => `work.projects.${i}.image.url`}
          altPath={(i) => `work.projects.${i}.image.alt`}
          emptyHint="No work projects yet — add one in Content, then set its photo here."
        />
      </Group>

      <Group title="Testimonial avatars">
        <PerItemImages
          content={content} setField={setField} round
          itemsPath="testimonials.items" labelKey="a"
          urlPath={(i) => `images.testimonials.avatars.${i}`}
          emptyHint="No testimonials yet — add them in Content to attach avatars."
        />
      </Group>
    </div>
  );
}
