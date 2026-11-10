'use client';

/**
 * Step 5, Their words: the client's own answers and their website, side by side, plus the
 * questions their customers really ask (`extensions.customerQuestions`, untagged ones here;
 * questions about one service are on that service's panel). The copywriter answers customer
 * questions first in the FAQ, from facts only (client-seo writes that prompt line).
 */
import { Plus, Trash } from '@phosphor-icons/react';
import type { CopyBrief, CopyBriefBlockId } from '@jdd/schema';
import type { SiteContent } from '@/data/site';
import type { SetField } from '@/components/fields';
import type { ResolvedBlock } from '@/lib/copy-brief/types';
import BlockGroupPane from '../brief/BlockGroupPane';
import { Card, INPUT, Tag } from './ui';

type Update = (mutate: (brief: CopyBrief) => CopyBrief) => void;
type Question = { q: string; a: string; service?: string };

export default function WordsStep({
  blockIds, blocks, content, setField, onUpdate,
}: {
  blockIds: CopyBriefBlockId[];
  blocks: ResolvedBlock[];
  content: SiteContent;
  setField: SetField;
  onUpdate: Update;
}) {
  const all = (content.extensions?.customerQuestions ?? []) as Question[];
  const general = all.map((q, k) => ({ q, k })).filter(({ q }) => !q.service);
  const tagged = all.length - general.length;
  const write = (next: Question[]) => setField('extensions.customerQuestions', next.length ? next : null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3.5 px-6 py-4">
      <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1">
        <h2 className="font-display text-[28px] font-bold leading-none text-uiInk">Their words</h2>
        <span className="text-xs text-uiFg3">The client&apos;s own answers, their website, and questions their customers ask.</span>
      </div>
      <div className="grid min-h-0 flex-1 gap-3.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-h-0">
          <BlockGroupPane blockIds={blockIds} blocks={blocks} content={content} setField={setField} onUpdate={onUpdate} columns />
        </div>
        <Card
          title="Customer questions"
          right={<Tag>Optional</Tag>}
          bodyClassName="space-y-2 p-3.5"
        >
          {general.map(({ q, k }) => (
            <div key={k} className="space-y-1 rounded-lg border border-uiCardRule/70 bg-panel p-2">
              <div className="flex gap-1.5">
                <input
                  aria-label="Question"
                  value={q.q}
                  onChange={(e) => write(all.map((x, j) => (j === k ? { ...x, q: e.target.value } : x)))}
                  className={`${INPUT} h-7`}
                />
                <button type="button" aria-label="Remove question" onClick={() => write(all.filter((_, j) => j !== k))} className="shrink-0 rounded p-1 text-uiFg3 hover:text-uiInk"><Trash size={13} /></button>
              </div>
              <input
                aria-label="The client's answer"
                value={q.a}
                placeholder="Answer: not given"
                onChange={(e) => write(all.map((x, j) => (j === k ? { ...x, a: e.target.value } : x)))}
                className={`${INPUT} h-7 text-xs`}
              />
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => write([...all, { q: '', a: '' }])}>
            <Plus size={12} /> Question
          </button>
          <p className="text-2xs leading-relaxed text-uiFg3">
            Used first in the FAQ, as asked. Answers come from the facts only.
            {tagged > 0 && ` ${tagged} more on the Services step, tagged to a service.`}
          </p>
        </Card>
      </div>
    </div>
  );
}
