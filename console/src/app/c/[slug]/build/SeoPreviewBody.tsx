import type { Metadata } from 'next';

export default function SeoPreviewBody({
  metadata,
  jsonLd,
}: {
  metadata: Metadata;
  jsonLd: Record<string, unknown> | null;
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'title', value: typeof metadata.title === 'string' ? metadata.title : String(metadata.title ?? '') },
    { label: 'description', value: metadata.description ?? '' },
    {
      label: 'canonical',
      value:
        metadata.alternates && typeof metadata.alternates === 'object' && 'canonical' in metadata.alternates
          ? String(metadata.alternates.canonical ?? '')
          : '',
    },
  ];

  return (
    <div className="p-8 font-chrome text-sm">
      <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">
        Metadata preview
      </p>
      <dl className="mt-4 space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[120px_1fr] gap-4">
            <dt className="font-chromeMono text-xs text-zinc-500">{r.label}</dt>
            <dd className="text-zinc-900">{r.value || <span className="text-zinc-400">(empty)</span>}</dd>
          </div>
        ))}
      </dl>
      {jsonLd && (
        <div className="mt-8">
          <p className="font-chromeMono text-xs uppercase tracking-widest text-zinc-500">
            JSON-LD payload
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-chromeMono text-xs text-zinc-800">
            {JSON.stringify(jsonLd, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
