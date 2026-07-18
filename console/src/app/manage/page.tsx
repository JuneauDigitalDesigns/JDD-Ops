import ManagePortalLink from '@/components/ManagePortalLink';

// /manage — ops management tools. First feature: repair a client's Clerk portal link.
// More management features will be added to this route over time.
export const dynamic = 'force-dynamic';

export default function ManagePage() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-5 py-10">
      <header className="mb-8">
        <span className="kicker">Manage</span>
        <h1 className="mt-2 font-display text-[28px] font-medium tracking-tightish text-fg">
          Management tools
        </h1>
        <p className="mt-2 text-[13px] leading-[1.6] text-fg2">
          Operational fixes and utilities for live clients. More tools will land here over time.
        </p>
      </header>

      <ManagePortalLink />
    </main>
  );
}
