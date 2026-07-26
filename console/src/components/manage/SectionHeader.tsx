/**
 * Shared header for every /manage section.
 *
 * Restrained on purpose: this is a control panel, so the title is a size smaller than
 * /onboard's screen titles and there is no display-scale headline competing with the
 * data underneath. `actions` sits inline so a section's primary control (Redeploy,
 * Check drift) is reachable without hunting.
 */
export default function SectionHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="font-display text-2xl font-semibold leading-none tracking-tightish text-fg">
          {title}
        </h1>
        {lede && <p className="text-xs text-fg3">{lede}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
