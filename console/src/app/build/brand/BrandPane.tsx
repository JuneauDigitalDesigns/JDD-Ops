'use client';

import { IdentificationCard, Phone, Certificate, ArrowsClockwise, type Icon } from '@phosphor-icons/react';
import type { SiteContent } from '@/data/site';
import { Field, type SetField } from '@/components/fields';
import { getPath } from '@/lib/merge';

// Brand identity, grouped rather than a flat run of ten inputs. The groups match how the
// fields are actually consumed downstream: Identity feeds copy and metadata, Contact feeds
// the LocalBusiness JSON-LD and the lead routes, Credentials feeds footer trust blocks.

function str(content: SiteContent, path: string): string {
  const v = getPath(content, path);
  return v === null || v === undefined ? '' : String(v);
}

/** tel: href from a display phone — strips everything but digits and a leading +. */
function telHref(display: string): string {
  const cleaned = display.trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  const plus = cleaned.startsWith('+');
  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return '';
  return `tel:${plus ? '+' : ''}${digits}`;
}

function Group({
  title, Icon: GroupIcon, children,
}: {
  title: string; Icon: Icon; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <p className="kicker flex items-center gap-1.5">
        <GroupIcon size={12} /> {title}
      </p>
      {children}
    </section>
  );
}

export default function BrandPane({
  content, setField,
}: {
  content: SiteContent; setField: SetField;
}) {
  const phone = str(content, 'brand.phone');
  const href = str(content, 'brand.phoneHref');
  const expected = telHref(phone);
  // Both feed the JSON-LD and they drift constantly, so make the mismatch visible+fixable.
  const outOfSync = Boolean(expected) && href !== expected;

  return (
    <div className="space-y-5 px-4 py-4">
      <Group title="Identity" Icon={IdentificationCard}>
        <Field content={content} setField={setField} path="brand.name" label="Name" />
        <Field content={content} setField={setField} path="brand.short" label="Short name" />
        <Field content={content} setField={setField} path="brand.long" label="Legal / long name" />
        <Field content={content} setField={setField} path="brand.tagline" label="Tagline" />
        <Field content={content} setField={setField} path="brand.established" label="Established" />
      </Group>

      <Group title="Contact" Icon={Phone}>
        <Field content={content} setField={setField} path="brand.phone" label="Phone (display)" />
        <Field content={content} setField={setField} path="brand.phoneHref" label="Phone href (tel:…)" />
        {outOfSync && (
          <button
            type="button"
            onClick={() => setField('brand.phoneHref', expected)}
            className="btn btn-xs"
          >
            <ArrowsClockwise size={11} /> Sync to {expected}
          </button>
        )}
        <Field content={content} setField={setField} path="brand.email" label="Email" />
        <Field content={content} setField={setField} path="brand.address" label="Address" />
      </Group>

      <Group title="Credentials" Icon={Certificate}>
        <Field content={content} setField={setField} path="brand.license" label="License" />
      </Group>
    </div>
  );
}
