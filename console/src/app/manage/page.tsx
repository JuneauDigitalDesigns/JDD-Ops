import { redirect } from 'next/navigation';

/**
 * Legacy entry point. Manage is no longer somewhere you go to pick a client — you pick the
 * client first, and Manage is one of four things you can then do to it.
 *
 * Points at /clients, not /. The roster this route used to render sat at the root for a
 * while and now lives at /clients; sending an old bookmark to the briefing instead would
 * land it on a screen answering a different question.
 */
export default function ManageIndexRedirect() {
  redirect('/clients');
}
