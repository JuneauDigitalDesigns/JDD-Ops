'use client';

/**
 * One screen's worth of CopyBrief blocks.
 *
 * Replaces BriefStage, which rendered exactly one block chosen by id. The change is the whole
 * point of this rebuild: `role` and `guardrails` are a single textarea each, so one-block
 * screens produced viewports emptier than the rail they replaced. Related thin blocks now
 * share a screen — "Voice & rules" is role + guardrails + forbidden — and each renders as its
 * own bordered sub-card so three toggles read as three things rather than one muddled form.
 *
 * Which blocks land together is NOT decided here; it's declared in lib/intake-steps.ts. This
 * component just renders the ids it's handed, in order, and skips any the resolver didn't
 * produce — a missing block is a registry mistake to be noticed, not a crash.
 */
import type { CopyBrief, CopyBriefBlockId } from '@jdd/schema';
import type { SetField } from '@/components/fields';
import type { ResolvedBlock } from '@/lib/copy-brief/types';
import { ProseBlockEditor, ForbiddenBlockEditor } from './blocks/ProseAndForbidden';
import ClientWordsBlockEditor from './blocks/ClientWordsBlockEditor';
import WebsiteBlockEditor from './blocks/WebsiteBlockEditor';
import { PositioningBlockEditor, OffersBlockEditor } from './blocks/ChipBlocks';
import StructureBlockEditor from './blocks/StructureBlockEditor';
import SectionsBlockEditor from './blocks/SectionsBlockEditor';
import CustomFieldsBlockEditor from './blocks/CustomFieldsBlockEditor';
import type { SiteContent } from '@/data/site';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

function BlockEditor({
  block, content, setField, onUpdate, variant,
}: {
  block: ResolvedBlock;
  content: SiteContent;
  setField: SetField;
  onUpdate: Update;
  variant: 'page' | 'card';
}) {
  switch (block.kind) {
    case 'prose':
      return <ProseBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    case 'forbidden':
      return <ForbiddenBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    case 'lines':
      return <ClientWordsBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    case 'website':
      return <WebsiteBlockEditor block={block} content={content} setField={setField} onUpdate={onUpdate} variant={variant} />;
    case 'positioning':
      return <PositioningBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    case 'offers':
      return <OffersBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    case 'structure':
      return <StructureBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    case 'sections':
      return <SectionsBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    case 'custom':
      return <CustomFieldsBlockEditor block={block} onUpdate={onUpdate} variant={variant} />;
    default:
      return null;
  }
}

export default function BlockGroupPane({
  blockIds, blocks, content, setField, onUpdate, columns = false, widths,
}: {
  blockIds: CopyBriefBlockId[];
  blocks: ResolvedBlock[];
  content: SiteContent;
  setField: SetField;
  onUpdate: Update;
  /** The intake boards (2026-11-10): blocks side by side, filling the height, each card
   *  scrolling inside itself only if a window is too small. The page never scrolls. */
  columns?: boolean;
  /** CSS grid-template-columns for `columns` mode; equal columns when absent. */
  widths?: string;
}) {
  const present = blockIds
    .map((id) => blocks.find((b) => b.id === id))
    .filter((b): b is ResolvedBlock => Boolean(b));

  if (present.length === 0) return null;

  if (columns) {
    return (
      <div
        className="grid h-full min-h-0 gap-3.5"
        style={{ gridTemplateColumns: widths ?? `repeat(${present.length}, minmax(0, 1fr))` }}
      >
        {present.map((block) => (
          <div key={block.id} className="no-scrollbar min-h-0 overflow-y-auto rounded-xl border border-uiCardRule bg-uiBg p-4">
            <BlockEditor block={block} content={content} setField={setField} onUpdate={onUpdate} variant="card" />
          </div>
        ))}
      </div>
    );
  }

  // A block that has the screen to itself keeps the page-level heading; a group gets sub-cards.
  // Wrapping a lone block in a card would float one small bordered box in a wide empty screen.
  if (present.length === 1) {
    return (
      <BlockEditor
        block={present[0]}
        content={content}
        setField={setField}
        onUpdate={onUpdate}
        variant="page"
      />
    );
  }

  return (
    <div className="space-y-4">
      {present.map((block) => (
        <div key={block.id} className="rounded-lg border border-uiCardRule p-4">
          <BlockEditor
            block={block}
            content={content}
            setField={setField}
            onUpdate={onUpdate}
            variant="card"
          />
        </div>
      ))}
    </div>
  );
}
