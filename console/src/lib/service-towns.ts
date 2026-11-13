/**
 * A job photo's town (Project.town, @jdd/schema v1.34.0), set in the Services step's Photos part
 * (Xander, 2026-11-12, approved as the canvas's row 8).
 *
 * The town is always the client's own spelling from extensions.serviceArea (canonicalTown), which is
 * how a town page finds its jobs (areaPageFacts). A town the client doesn't cover is never stored,
 * and "Not sure" clears it. `loc`, the display line under the photo, follows the town the way
 * buildScaffold sets it, unless the operator typed a different one.
 */
import { canonicalTown } from '@jdd/schema';
import type { SiteContent } from '@/data/site';

type Project = SiteContent['work']['projects'][number] & { town?: string };

export function withPhotoTown(content: unknown, project: Project, raw: string): Project {
  const town = canonicalTown(content, raw);
  const { town: previous, ...rest } = project;
  const followsTown = !project.loc || project.loc === (previous ?? '');
  const loc = followsTown ? town : project.loc;
  return town ? { ...rest, town, loc } : { ...rest, loc };
}
