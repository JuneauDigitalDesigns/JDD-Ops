import { Suspense } from 'react';
import CalendarView from '@/components/calendar/CalendarView';

/**
 * The meetings calendar, on its own route.
 *
 * A month grid of scheduled calls and video meetings. Meetings are created here (click a day) or
 * arrive prefilled from a lead's "Add to calendar" button; a bar can be dragged to another day to
 * reschedule. Storage is the jdd:meeting:* namespace in the same KV instance as the lead queue.
 *
 * Wrapped in Suspense because CalendarView reads useSearchParams (the lead-prefill params), which
 * Next requires a suspense boundary for on a statically-analysed page.
 */
export const dynamic = 'force-dynamic';

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarView />
    </Suspense>
  );
}
