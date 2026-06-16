import RunbookApp from '@/components/RunbookApp';

// Single entry point. RunbookApp is a client component that fetches /api/runbook/clients
// and renders the dashboard + drawer. Force dynamic so it never gets statically cached.
export const dynamic = 'force-dynamic';

export default function Page() {
  return <RunbookApp />;
}
