import { redirect } from 'next/navigation';

/**
 * Legacy entry point. Build is now per-client at /c/{slug}/build — its old step 1 was a
 * client picker, and that job belongs to the root now.
 */
export default function BuildIndexRedirect() {
  redirect('/');
}
