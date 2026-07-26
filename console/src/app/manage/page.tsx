import ManagePortalLink from '@/components/ManagePortalLink';
import ManageClientEnv from '@/components/ManageClientEnv';

// /manage — ops management tools: repair a client's portal link, and edit + sync their
// env vars without opening the Vercel dashboard.
// More management features will be added to this route over time.
export const dynamic = 'force-dynamic';

export default function ManagePage() {
  return (
    <main className="relative z-10 mx-auto max-w-3xl px-5 py-10">
      <header className="mb-8">
        <span className="kicker">Manage</span>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-tightish text-fg">
          Management tools
        </h1>
      </header>

      <div className="flex flex-col gap-6">
        <ManageClientEnv />
        <ManagePortalLink />
      </div>
    </main>
  );
}
