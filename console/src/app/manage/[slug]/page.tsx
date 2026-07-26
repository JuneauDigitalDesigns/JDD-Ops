import { redirect } from 'next/navigation';
import { DEFAULT_SECTION } from '@/lib/manageSections';

/** /manage/{slug} has no content of its own — Overview is the client landing. */
export default function ManageClientIndex({ params }: { params: { slug: string } }) {
  redirect(`/manage/${params.slug}/${DEFAULT_SECTION}`);
}
