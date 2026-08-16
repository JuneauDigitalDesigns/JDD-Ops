import ClientIndex from '@/components/picker/ClientIndex';

/**
 * The searchable client roster.
 *
 * Moved here intact from `/` when the briefing took the front door. Nothing about it
 * changed: it is the right screen for "find a specific client and open them", it is fast
 * because it renders from disk, and it earned its place. What it could never be is a
 * front door that tells you what needs doing — it is sorted for lookup, not for triage,
 * and a roster of healthy clients looks identical to a roster you have never checked.
 *
 * The `.onboard-chrome` scope (dotfield) is the surface these roster views were designed
 * on and came up with them from /onboard.
 */
export const dynamic = 'force-dynamic';

export default function ClientsPage() {
  return (
    <div className="onboard-chrome h-full">
      <div className="dotfield" aria-hidden />
      <ClientIndex />
    </div>
  );
}
