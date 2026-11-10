/**
 * The pool of Cloudflare Turnstile widgets behind every client site's lead form.
 *
 * ── Why a pool (operator decision, 2026-11-09) ─────────────────────────────────────────────────
 * A free Turnstile widget holds 10 hostnames, and every client site needs its `*.vercel.app` host
 * plus each custom domain, so one widget fills at about the fourth client. And a host missing from
 * the site's widget is worse than having no check: Cloudflare refuses to render the widget there
 * (error 110200), so the human check silently can't run. The agency then keeps the lead and places
 * no AI call (jdd-ui v1.6.0 + `/api/ingest/admit`), which is safe but loses every callback.
 *
 * So onboard.js keeps each site's hostnames on a pool widget with room, adding them through the
 * Turnstile API, and creates a widget when every one is full. Widgets are recognised by name: the
 * first, made by hand, is "JDD client lead forms"; the pool names the rest "… 2", "… 3".
 * Anything else on the account (the agency's own quote-form widget) is never touched.
 *
 * ── Secrets ─────────────────────────────────────────────────────────────────────────────────────
 * Cloudflare returns a widget's secret only when it creates it. `ensureSiteOnPool` hands it to
 * `storeSecret` (the agency's KV, which `/api/ingest/admit` reads) and drops it: it is never
 * returned, logged or printed. If it can't be stored the run stops before the site is pointed at
 * that widget. The first widget's secret is the agency env var `LEAD_FORM_TURNSTILE_SECRET_KEY`.
 *
 * ── Moving a site ───────────────────────────────────────────────────────────────────────────────
 * A site whose widget is full moves to another, which changes its public site key, and the key is
 * built into the site. onboard.js may do that (it writes the key and redeploys). The console's
 * domain attach may not (`allowMove: false`): it refuses and says to re-run onboarding. A site
 * that moves keeps its old hostnames on the old widget, so its live build works until the new one
 * is deployed.
 *
 * The API shapes below follow Cloudflare's documented Turnstile widgets endpoints. They are not
 * yet checked against a recorded response (see test/turnstile-pool.test.mjs).
 */

export const POOL_PREFIX = 'JDD client lead forms';
/** Cloudflare's free plan: 10 hostnames per widget (Enterprise: 200). */
export const HOSTNAMES_PER_WIDGET = 10;

const API = 'https://api.cloudflare.com/client/v4';
const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** A hostname Turnstile accepts, lowercased; null for anything else (wildcards, paths, junk). */
function normalHost(raw) {
  if (typeof raw !== 'string') return null;
  const h = raw.trim().toLowerCase().replace(/\.$/, '');
  const labels = h.split('.');
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  // `vercel.app` on its own would authorise every Vercel site in the world.
  if (h === 'vercel.app') return null;
  return h;
}

/** Every hostname this site's lead form is served on: its vercel.app host and each project domain. */
export function siteHostnames({ vercelHost, domains = [] }) {
  const all = [`${vercelHost}.vercel.app`, ...domains].map(normalHost).filter(Boolean);
  return [...new Set(all)].sort();
}

export const isPoolWidget = (w) => typeof w?.name === 'string' && w.name.startsWith(POOL_PREFIX);

const union = (a, b) => [...new Set([...a, ...b])].sort();

/**
 * What to do so every hostname in `wanted` is on the widget the site will render.
 *
 * Actions: `none` (already there), `add` (put the missing ones on `siteKey`'s widget), `create`
 * (a new pool widget), `full` (the site's widget has no room and moving isn't allowed).
 * `changesSiteKey` says the site must be rebuilt with a new key.
 */
export function planSiteHostnames({ widgets, wanted, currentSiteKey, limit = HOSTNAMES_PER_WIDGET, allowMove = true }) {
  if (wanted.length > limit) {
    throw new Error(`This site has ${wanted.length} hostnames, more hostnames than one widget holds (${limit}).`);
  }
  const pool = widgets.filter(isPoolWidget).map((w) => ({ ...w, domains: (w.domains ?? []).map(normalHost).filter(Boolean) }));
  const current = currentSiteKey ? pool.find((w) => w.sitekey === currentSiteKey) : null;

  if (current) {
    const missing = wanted.filter((h) => !current.domains.includes(h));
    if (missing.length === 0) return { action: 'none', siteKey: current.sitekey, missing: [], changesSiteKey: false };
    const domains = union(current.domains, missing);
    if (domains.length <= limit) {
      return { action: 'add', siteKey: current.sitekey, widget: current, domains, missing, changesSiteKey: false };
    }
    if (!allowMove) return { action: 'full', siteKey: current.sitekey, missing, changesSiteKey: false };
  }

  // Everything below changes the site's key, which needs a rebuild: onboarding's job, never the
  // console's.
  if (!allowMove) return { action: 'full', siteKey: currentSiteKey || null, missing: [...wanted], changesSiteKey: false };

  const holder = pool.find((w) => wanted.every((h) => w.domains.includes(h)));
  if (holder) {
    return { action: 'none', siteKey: holder.sitekey, missing: [], changesSiteKey: holder.sitekey !== currentSiteKey };
  }
  // Fill the fullest widget that still has room before starting on an emptier one.
  const room = pool
    .map((w) => ({ w, domains: union(w.domains, wanted) }))
    .filter((x) => x.domains.length <= limit)
    .sort((a, b) => b.w.domains.length - a.w.domains.length)[0];
  if (room) {
    const missing = wanted.filter((h) => !room.w.domains.includes(h));
    return {
      action: 'add',
      siteKey: room.w.sitekey,
      widget: room.w,
      domains: room.domains,
      missing,
      changesSiteKey: room.w.sitekey !== currentSiteKey,
    };
  }
  const name = pool.length === 0 ? POOL_PREFIX : `${POOL_PREFIX} ${pool.length + 1}`;
  return { action: 'create', name, domains: [...wanted], missing: [...wanted], changesSiteKey: true };
}

/**
 * The check the dry run and the console's finding share: which of the site's hostnames the widget
 * it renders doesn't list. A site key that isn't a pool widget at all misses every hostname.
 */
export function missingTurnstileHostnames({ widgets, siteKey, wanted }) {
  const widget = widgets.filter(isPoolWidget).find((w) => w.sitekey === siteKey);
  if (!widget) return { ok: false, siteKeyKnown: false, missing: [...wanted] };
  const have = (widget.domains ?? []).map(normalHost);
  const missing = wanted.filter((h) => !have.includes(h));
  return { ok: missing.length === 0, siteKeyKnown: true, missing };
}

/** One line for logs and the dry run. Holds no secret: plans never carry one. */
export function describeTurnstilePlan(plan) {
  const move = plan.changesSiteKey ? ', so the site moves to that widget and is rebuilt' : '';
  switch (plan.action) {
    case 'none':
      return `hostnames already on widget ${plan.siteKey}${plan.changesSiteKey ? ', so the site moves to it' : ''}`;
    case 'add':
      return `add ${plan.missing.join(', ')} to widget ${plan.siteKey}${move}`;
    case 'create':
      return `create widget "${plan.name}" for ${plan.domains.join(', ')}${move}`;
    case 'full':
      return plan.siteKey
        ? `widget ${plan.siteKey} can't take ${plan.missing.join(', ')} without moving the site`
        : `this site has no Turnstile site key yet`;
    default:
      return plan.action;
  }
}

async function cf(fetchImpl, token, path, init = {}) {
  const res = await fetchImpl(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    const msg = body?.errors?.map((e) => `${e.code} ${e.message}`).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare Turnstile API: ${msg}`);
  }
  return body;
}

/** Every widget on the account, every page. Only what planning needs, never a secret. */
export async function listWidgets({ accountId, token, fetchImpl = fetch }) {
  const out = [];
  for (let page = 1; page < 50; page++) {
    const body = await cf(fetchImpl, token, `/accounts/${accountId}/challenges/widgets?page=${page}&per_page=25`);
    const rows = Array.isArray(body.result) ? body.result : [];
    for (const r of rows) {
      out.push({
        sitekey: r.sitekey,
        name: r.name,
        domains: r.domains ?? [],
        mode: r.mode,
        region: r.region,
        bot_fight_mode: r.bot_fight_mode,
        offlabel: r.offlabel,
        clearance_level: r.clearance_level,
      });
    }
    const total = body.result_info?.total_count;
    if (rows.length === 0 || (typeof total === 'number' ? out.length >= total : rows.length < 25)) break;
  }
  return out;
}

/** Fields an update keeps as they are, so adding a hostname changes nothing else. */
const KEPT = ['region', 'bot_fight_mode', 'offlabel', 'clearance_level'];

async function updateWidgetDomains({ accountId, token, fetchImpl }, widget, domains) {
  const body = { name: widget.name, domains, mode: widget.mode || 'managed' };
  for (const k of KEPT) if (widget[k] !== undefined) body[k] = widget[k];
  await cf(fetchImpl, token, `/accounts/${accountId}/challenges/widgets/${encodeURIComponent(widget.sitekey)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

async function createWidget({ accountId, token, fetchImpl }, name, domains) {
  const body = await cf(fetchImpl, token, `/accounts/${accountId}/challenges/widgets`, {
    method: 'POST',
    body: JSON.stringify({ name, domains, mode: 'managed' }),
  });
  return { sitekey: body.result?.sitekey, secret: body.result?.secret };
}

/**
 * Read the pool, plan, and (unless `dryRun`) apply it. Returns `{ plan, siteKey }`: the key the
 * site must render. A plan of `full` is returned, not applied, for the caller to refuse on.
 */
export async function ensureSiteOnPool({
  accountId,
  token,
  wanted,
  currentSiteKey = '',
  allowMove = true,
  storeSecret,
  dryRun = false,
  fetchImpl = fetch,
}) {
  const api = { accountId, token, fetchImpl };
  const widgets = await listWidgets(api);
  const plan = planSiteHostnames({ widgets, wanted, currentSiteKey, allowMove });
  const { widget, ...shown } = plan;
  if (dryRun || plan.action === 'none' || plan.action === 'full') return { plan: shown, siteKey: plan.siteKey ?? null, widgets };

  if (plan.action === 'add') {
    await updateWidgetDomains(api, widget, plan.domains);
    return { plan: shown, siteKey: plan.siteKey, widgets };
  }

  const created = await createWidget(api, plan.name, plan.domains);
  if (!created.sitekey || !created.secret) throw new Error('Cloudflare created a widget but returned no site key or secret.');
  try {
    await storeSecret(created.sitekey, created.secret);
  } catch (e) {
    throw new Error(
      `Widget "${plan.name}" (${created.sitekey}) was created, but its secret could not be saved (${e?.message ?? e}). ` +
        'Delete that widget in the Cloudflare dashboard and run again; the site was not moved to it.',
    );
  }
  return { plan: { ...shown, siteKey: created.sitekey }, siteKey: created.sitekey, widgets };
}
