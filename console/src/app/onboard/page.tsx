import { redirect } from 'next/navigation';

/**
 * Legacy entry point. The runbook is now per-client at /c/{slug}/onboard, and the client
 * roster it used to open on has become the root picker.
 */
export default function OnboardIndexRedirect() {
  redirect('/');
}
