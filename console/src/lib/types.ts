// Shared types for the runbook console. Mirrors the shapes onboard.js reads/writes.

export type Plan = 'starter' | 'growth' | 'enterprise';

export interface SiteEnv {
  RETELL_AGENT_ID?: string;
  TWILIO_NUMBER?: string;
  CLIENT_FORWARD_PHONE?: string;
  CLIENT_FORWARD_RING_SECONDS?: string;
  AIRTABLE_BASE_ID?: string;
  AIRTABLE_SITE_TAG?: string;
  RETELL_POST_CALL_WEBHOOK_URL?: string;
  VERCEL_PROJECT_NAME?: string;
  LEAD_DELIVERY_MODE?: string;
  [k: string]: string | undefined;
}

/** One provisionable site: the whole client (starter/growth) or one enterprise site. */
export interface SiteInfo {
  slug: string; // provisioning slug — baseSlug, or baseSlug-N for enterprise
  brandName: string;
  brandShort: string | null;
  canonical: string | null;
  repoBuilt: boolean;
  env: SiteEnv;
  missingFields: string[];
  /**
   * The brand's accent colour from site.ts (brand.palette.accent). Surfaced so the client
   * index can wear each client's own colour — at 15–50 clients that is the cheapest way to
   * make a card recognisable before you've read a word of it. Null when there's no readable
   * site.ts or no palette.
   */
  accent: string | null;
}

export type ClientStatus =
  | 'needs-build' // site repo(s) not exported/scaffolded yet
  | 'ready' // repo built, onboard.js not run (or incomplete)
  | 'provisioned' // infra created, lead-callback Make scenario not wired
  | 'portal-pending' // infra + callback done; portal + checkpoints remain
  | 'live' // fully onboarded and handed off
  | 'unknown';

/** Manual statuses the operator can set, in pipeline order. */
export const STATUS_ORDER: ClientStatus[] = [
  'needs-build',
  'ready',
  'provisioned',
  'portal-pending',
  'live',
];

export interface ClientContext {
  slug: string; // base folder under clients/
  plan: Plan;
  brandName: string;
  isEnterprise: boolean;
  repoBuilt: boolean; // single: repo exists; enterprise: every site built
  detectedStatus: ClientStatus; // inferred from disk; the floor under any manual status
  schemaPath: string; // clients/{slug}/site.ts (relative to jdd-ops root)
  hasIntake: boolean;
  sites: SiteInfo[];
}

// ── Durable runbook state (runbook/.state/progress.json) ─────────────────────
export interface ClientState {
  status?: ClientStatus; // manual override; falls back to ClientContext.detectedStatus
  steps: Record<string, boolean>; // stepId → done
  /**
   * Manual sort position within its Kanban column. Fractional by design: a drop writes the
   * midpoint of its two new neighbours, so reordering touches exactly ONE client instead of
   * reindexing the whole column. Absent = never dragged; those sort last, alphabetically.
   */
  order?: number;
  updatedAt?: string;
}

export type RunbookState = Record<string, ClientState>;

// ── Whitelisted ops config (real context values surfaced to the UI) ──────────
// Only non-secret values that help an operator locate/place things. NEVER API keys/tokens.
export interface OpsConfig {
  retellPostCallWebhookUrl?: string; // jdd-ops/.env RETELL_POST_CALL_WEBHOOK_URL
  githubOrg?: string; // jdd-ops/.env GITHUB_ORG
  vercelTeamId?: string; // jdd-ops/.env VERCEL_TEAM_ID
  makePostCallMasterScenarioId?: string; // jdd-ops/.env MAKE_POST_CALL_MASTER_SCENARIO_ID
  portalSignInUrl?: string; // agency NEXT_PUBLIC_CLERK_SIGN_IN_URL → absolute
  siteUrl?: string; // agency NEXT_PUBLIC_SITE_URL, no trailing slash
  serviceAccountEmail?: string; // GOOGLE_SERVICE_ACCOUNT_KEY → client_email
}

