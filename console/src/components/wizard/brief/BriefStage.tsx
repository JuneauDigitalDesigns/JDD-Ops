'use client';

import type { CopyBrief, CopyBriefBlockId } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import type { ResolvedBlock } from '@/lib/copy-brief/types';
import { ProseBlockEditor, ForbiddenBlockEditor } from './blocks/ProseAndForbidden';
import FactsBlockEditor from './blocks/FactsBlockEditor';
import ClientWordsBlockEditor from './blocks/ClientWordsBlockEditor';
import WebsiteBlockEditor from './blocks/WebsiteBlockEditor';
import { PositioningBlockEditor, OffersBlockEditor } from './blocks/ChipBlocks';
import StructureBlockEditor from './blocks/StructureBlockEditor';
import SectionsBlockEditor from './blocks/SectionsBlockEditor';
import CustomFieldsBlockEditor from './blocks/CustomFieldsBlockEditor';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;

export default function BriefStage({
  blocks, activeId, content, setField, missingFields, onUpdate,
}: {
  blocks: ResolvedBlock[];
  activeId: CopyBriefBlockId;
  content: SiteContent;
  setField: SetField;
  missingFields: string[];
  onUpdate: Update;
}) {
  const block = blocks.find((b) => b.id === activeId);
  if (!block) return null;

  switch (block.kind) {
    case 'prose':
      return <ProseBlockEditor block={block} onUpdate={onUpdate} />;
    case 'forbidden':
      return <ForbiddenBlockEditor block={block} onUpdate={onUpdate} />;
    case 'facts':
      return <FactsBlockEditor block={block} content={content} setField={setField} missingFields={missingFields} onUpdate={onUpdate} />;
    case 'lines':
      return <ClientWordsBlockEditor block={block} onUpdate={onUpdate} />;
    case 'website':
      return <WebsiteBlockEditor block={block} content={content} setField={setField} onUpdate={onUpdate} />;
    case 'positioning':
      return <PositioningBlockEditor block={block} onUpdate={onUpdate} />;
    case 'offers':
      return <OffersBlockEditor block={block} onUpdate={onUpdate} />;
    case 'structure':
      return <StructureBlockEditor block={block} onUpdate={onUpdate} />;
    case 'sections':
      return <SectionsBlockEditor block={block} onUpdate={onUpdate} />;
    case 'custom':
      return <CustomFieldsBlockEditor block={block} onUpdate={onUpdate} />;
    default:
      return null;
  }
}
