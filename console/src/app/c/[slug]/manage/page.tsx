import { redirect } from 'next/navigation';
import { DEFAULT_SECTION } from '@/lib/manageSections';

/** Manage has no landing of its own — Overview is where the tool starts. */
export default function ManageClientIndex({ params }: { params: { slug: string } }) {
  redirect(`/c/${params.slug}/manage/${DEFAULT_SECTION}`);
}
