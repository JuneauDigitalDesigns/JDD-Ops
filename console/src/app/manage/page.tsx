import { redirect } from 'next/navigation';

/**
 * Legacy entry point. Manage is no longer somewhere you go to pick a client — you pick the
 * client at the root, and Manage is one of three things you can then do to it. The roster
 * this route used to render has become the root picker.
 */
export default function ManageIndexRedirect() {
  redirect('/');
}
