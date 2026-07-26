// Plan tier badge — starter / growth / enterprise. Extracted from ClientSelectStep's
// private planBadge() so the wizard header, the client cards, and /manage all read the
// same tier→tone mapping. Display only: the tier is authored upstream (intake, or
// _meta.selectedPlan) and gates the component catalog in categories.tsx.

const TONE: Record<string, string> = {
  starter: 'bg-sky-100 text-sky-700',
  growth: 'bg-emerald-100 text-emerald-700',
  enterprise: 'bg-violet-100 text-violet-700',
};

export default function PlanChip({ plan, className = '' }: { plan: string; className?: string }) {
  return (
    <span
      className={[
        'shrink-0 rounded px-2 py-0.5 font-chromeMono text-kicker uppercase tracking-wide',
        TONE[plan] ?? 'bg-zinc-100 text-zinc-600',
        className,
      ].join(' ')}
    >
      {plan}
    </span>
  );
}
