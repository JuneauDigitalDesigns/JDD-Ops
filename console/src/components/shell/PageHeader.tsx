/**
 * The heading block every stage opens with: title, optional lede, optional inline actions.
 *
 * This started life as /manage's SectionHeader and is now the console-wide one, because the
 * root index and the board screens needed the same thing: their titles used to live in the
 * navbar, and the bar is wayfinding only now. Making all three surfaces share one header is
 * what makes them read as the same application — title in the stage, chrome in the chrome.
 *
 * Restrained on purpose. This is a control panel, so the title is a size smaller than a
 * marketing page would use and there is no display-scale headline competing with the data
 * underneath. `font-display` is opt-in here rather than inherited: after the global h1–h6
 * Big Shoulders rule was dropped, this is one of the few places the display face is still
 * correct — a page title.
 */
export default function PageHeader({
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
