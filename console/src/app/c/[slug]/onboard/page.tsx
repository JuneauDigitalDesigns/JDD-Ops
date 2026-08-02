import OnboardTool from '@/components/client/OnboardTool';

// OnboardTool is a client component that fetches /api/runbook/clients and renders the
// runbook for this slug. Force dynamic so it never gets statically cached.
export const dynamic = 'force-dynamic';

export default function OnboardPage({ params }: { params: { slug: string } }) {
  return <OnboardTool slug={params.slug} />;
}
