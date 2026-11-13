import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot, clientDir } from './paths';
import { loadManageTarget } from './manageSites';
import type { ApprovedSpoke } from './spokeApprovals';

/**
 * The spokes approved in Search for a client (jdd-ops/lib/search-approvals.js), read from
 * `approved-spokes.json` in the same folder the decide route writes: the site's folder when the
 * client has one /manage can resolve, else clients/{slug}. A missing file is an empty list; a
 * malformed one throws, so a caller that must not guess (the export, the Studio) can stop.
 */
interface ApprovalsModule {
  readApprovedSpokes(siteDir: string): Array<ApprovedSpoke & { approvedAt: string | null }>;
}

export async function readApprovedSpokesFor(slug: string, site?: string | null): Promise<ApprovedSpoke[]> {
  const path = resolve(opsRoot(), 'lib', 'search-approvals.js');
  const mod = (await import(/* webpackIgnore: true */ `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`)) as ApprovalsModule;
  const target = await loadManageTarget(slug, site ?? null).catch(() => null);
  const dir = target && target.ok ? target.resolved.dir : clientDir(slug);
  return mod.readApprovedSpokes(dir).map(({ town, service }) => ({ town, service }));
}
