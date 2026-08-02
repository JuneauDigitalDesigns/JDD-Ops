import LeadsView from '@/components/leads/LeadsView';

/**
 * The funnel, on its own route.
 *
 * This replaced the onboarding Kanban that used to live at /pipeline. That board grouped
 * clients by provisioning status — a phase every client passes through once and then
 * leaves — which made it a second, worse copy of the client index: the same rows, the
 * same colours, no search, and a "Live" column that only ever grew.
 *
 * This board answers a question nothing else in the console can. Everything at `/` starts
 * the moment a `clients/{slug}` folder exists, which is to say the moment someone has
 * already signed and paid. Leads are the part before that, and they arrive here on their
 * own: the agency site's hero form writes one, and so does a call to the demo agent.
 */
export const dynamic = 'force-dynamic';

export default function LeadsPage() {
  return <LeadsView />;
}
