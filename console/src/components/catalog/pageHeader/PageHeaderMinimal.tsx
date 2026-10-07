// ─────────────────────────────────────────────────────────────────────────────
// PageHeaderMinimal — inline-strip page header (see the Phase 5 specimen). The lightest
// header: title and one-line intro on a single baseline-aligned strip with a hairline
// under it, no band fill. For content-heavy pages (About, Contact) where a tall header
// would waste the fold. Same {data, editPrefix} contract as PageHeaderSimple; skinless.
// ─────────────────────────────────────────────────────────────────────────────
import type { PageHeaderContent } from '@/data/site';
import type { SkinId } from '@/lib/skins';
import { E } from '@/lib/editable';

export const meta = {
  id: 'page-header-minimal',
  category: 'pageHeader',
  label: 'Page header / Minimal',
  consumes: ['subpages.*.header'],
  sharedDeps: [],
  /** Structural archetype, from src/lib/archetypes.ts. Unique within the category. */
  archetype: 'inline-strip',
  signature: false,
} as const;

export default function PageHeaderMinimal({
  data,
  editPrefix,
}: {
  data: PageHeaderContent;
  /** Accepted for catalog interface parity; page headers ship skin-less in v1. */
  skin?: SkinId;
  editPrefix?: string;
}) {
  const field = (name: string, value: string) =>
    editPrefix ? <E p={`${editPrefix}.${name}`}>{value}</E> : value;

  return (
    <section id="page-header" className="border-b border-rule bg-bg">
      <div className="mx-auto flex max-w-6xl flex-col gap-x-6 gap-y-2 px-5 py-12 sm:px-6 lg:flex-row lg:items-baseline">
        <h1 className="font-heading text-3xl font-extrabold leading-[1.05] tracking-[-0.02em] text-ink sm:text-4xl">
          {field('title', data.title)}
        </h1>
        {data.sub && (
          <p className="text-[15px] leading-relaxed text-inkSoft sm:text-base">
            {field('sub', data.sub)}
          </p>
        )}
      </div>
    </section>
  );
}
