import { redirect } from 'next/navigation';
import { DEFAULT_SECTION } from '@/lib/manageSections';

/**
 * Legacy /manage/{slug} and /manage/{slug}/{section} bookmarks. The client shell owns these
 * URLs now.
 *
 * `?site=` is carried across deliberately: on an enterprise client it names which of the
 * sites the link meant, and dropping it would silently land the operator on site 1.
 */
export default function LegacyManageRedirect({
  params,
  searchParams,
}: {
  params: { slug: string; rest?: string[] };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const section = params.rest?.[0] ?? DEFAULT_SECTION;
  const site = typeof searchParams.site === 'string' ? `?site=${searchParams.site}` : '';
  redirect(`/c/${params.slug}/manage/${section}${site}`);
}
