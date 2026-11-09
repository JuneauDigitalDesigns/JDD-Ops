import 'server-only';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { opsRoot } from './paths';
import { loadKvCredentials } from './opsSecrets';

/**
 * Bridge to the ops-root A2P modules — lib/a2p-register.js, a2p-registration-store.js,
 * a2p-identity.js, a2p-readiness.js. Same webpackIgnore'd, mtime-keyed dynamic import as
 * teardownOps.ts: they live outside the console app's root and must never be bundled.
 *
 * **The mtime key only refreshes the ENTRY module.** a2p-register.js imports a2p-identity.js,
 * a2p-trusthub.js and a2p-readiness.js statically; those resolve to their plain URLs, which
 * Node's ESM cache holds forever. Edit a2p-identity.js under a running `next dev` and the fresh
 * a2p-register.js imports the STALE identity module — seen for real as "does not provide an
 * export named A2P_JOB_POSITIONS" and a 500 on the section. Restart the console after editing
 * any lib/a2p-*.js; there is no way to evict an ES module.
 *
 * One copy of every rule, in the ops root (PLAN-console-a2p-registration.md §3 fact 5). The only
 * piece the console's CLIENT bundle needs — the industry / business-type / vertical enums — is
 * loaded here by the section's server component and passed down as props, never copied into
 * console/src. A second copy would recreate the ring-window two-copies problem.
 */

export type A2pPath = 'standard' | 'sole-proprietor';

export interface StoredEvaluation {
  status: 'compliant' | 'noncompliant' | 'unknown';
  sid: string;
  failures: Array<{ requirement: string; objectType: string; field: string; reason: string }>;
  at: string;
}

/** Mirrors the JSDoc typedef in lib/a2p-registration-store.js. */
export interface A2pRegistrationRecord {
  version: 1;
  slug: string;
  registrationPath: A2pPath;
  mock: boolean;
  profileSid?: string;
  businessEndUserSid?: string;
  repEndUserSid?: string;
  addressSid?: string;
  addressDocSid?: string;
  profileAssignments?: Record<string, string>;
  lastEvaluation?: StoredEvaluation;
  profileChangedAt?: string;
  trustProductSid?: string;
  trustEndUserSid?: string;
  trustAssignments?: Record<string, string>;
  lastTrustEvaluation?: StoredEvaluation;
  trustChangedAt?: string;
  brandSid?: string;
  brandType?: string;
  messagingServiceSid?: string;
  campaignSid?: string;
  numbers?: Record<string, { e164: string; phoneNumberSid: string; attachedAt?: string; inService?: boolean; checkedAt?: string }>;
  statuses?: { profile?: string; trustProduct?: string; brand?: string; brandIdentity?: string; campaign?: string; refreshedAt?: string };
  errors?: { brand?: string[]; campaign?: string[] };
  gates?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface A2pIntakeRecord {
  legalBusinessName?: string;
  businessType?: string;
  websiteUrl?: string;
  address?: { street?: string; city?: string; region?: string; postalCode?: string; country?: string };
  submittedAt?: string;
  updatedAt?: string;
  updatedBy?: 'client' | 'operator';
}

export interface StepAvailability {
  done: boolean;
  enabled: boolean;
  reason?: string;
}

export interface StepDef {
  id: string;
  runbook: string;
  label: string;
  write: boolean;
  path?: A2pPath;
}

export interface ReadinessCheck {
  id: string;
  label: string;
  ok: true | false | null;
  detail: string;
  fix?: string;
}

export interface A2pEnums {
  industries: ReadonlyArray<{ value: string; label: string }>;
  businessTypes: ReadonlyArray<{ value: string; label: string }>;
  soleProprietorVerticals: ReadonlyArray<string>;
  companyTypes: ReadonlyArray<string>;
  jobPositions: ReadonlyArray<string>;
  standardUsecases: ReadonlyArray<string>;
  defaultIndustryByVertical: Readonly<Record<string, string>>;
}

interface RegisterModule {
  STEPS: ReadonlyArray<StepDef & { run: unknown }>;
  STANDARD_USECASES: ReadonlyArray<string>;
  REGISTERING_PLANS: ReadonlyArray<string>;
  availability(
    record: A2pRegistrationRecord | null,
    opts: { plan: string; primaryProfileSid?: string; siteSlugs?: string[] },
  ): Record<string, StepAvailability>;
  portalStatusFor(record: A2pRegistrationRecord | null): string;
  describeStatuses(record: A2pRegistrationRecord): string;
  runStep(args: {
    step: string;
    slug: string;
    plan: string;
    record: A2pRegistrationRecord | null;
    input: Record<string, unknown>;
    siteSlugs?: string[];
    persist: (patch: Partial<A2pRegistrationRecord>, current: A2pRegistrationRecord | null) => Promise<A2pRegistrationRecord>;
    env?: Record<string, string | undefined>;
  }): Promise<{ record: A2pRegistrationRecord; summary: string }>;
  A2pStepRefused: new (message: string) => Error;
  batchSteps(mode: 'submit' | 'save', path: A2pPath): string[];
  runBatch(args: {
    /** Run the real checks, then send nothing to Twilio and save nothing. */
    dryRun?: boolean;
    mode: 'submit' | 'save';
    form: A2pBatchForm;
    slug: string;
    plan: string;
    record: A2pRegistrationRecord | null;
    siteSlugs?: string[];
    persist: (patch: Partial<A2pRegistrationRecord>, current: A2pRegistrationRecord | null) => Promise<A2pRegistrationRecord>;
    onStep?: (result: A2pBatchStepResult) => void;
    env?: Record<string, string | undefined>;
  }): Promise<{ ok: boolean; invalid?: string[]; results: A2pBatchStepResult[]; record: A2pRegistrationRecord | null }>;
}

/** Mirrors `BatchForm` in lib/a2p-register.js — the close wizard's one form. */
export interface A2pBatchForm {
  registrationPath: A2pPath;
  legalBusinessName?: string;
  businessType?: string;
  businessIndustry?: string;
  websiteUrl?: string;
  /** Standard + submit only. Sent to Twilio once, never stored. */
  ein?: string;
  rep: { firstName: string; lastName: string; jobPosition?: string; email: string; phone: string };
  address: { street: string; city: string; region: string; postalCode: string; country: string };
  brandName?: string;
  vertical?: string;
}

export interface A2pBatchStepResult {
  step: string;
  status: 'done' | 'skipped' | 'failed' | 'not-run';
  summary?: string;
  error?: string;
}

interface StoreModule {
  readRegistration(args: { slug: string }): Promise<A2pRegistrationRecord | null>;
  writeRegistration(args: {
    slug: string;
    patch: Partial<A2pRegistrationRecord>;
    current?: A2pRegistrationRecord | null;
  }): Promise<A2pRegistrationRecord>;
  readIntake(args: { slug: string }): Promise<A2pIntakeRecord | null>;
  writeIntake(args: { slug: string; patch: Partial<A2pIntakeRecord> }): Promise<A2pIntakeRecord>;
  assertNoTaxId(value: unknown, where: string): void;
}

interface IdentityModule {
  A2P_BUSINESS_INDUSTRIES: ReadonlyArray<{ value: string; label: string }>;
  A2P_BUSINESS_TYPES: ReadonlyArray<{ value: string; label: string }>;
  A2P_SOLE_PROP_VERTICALS: ReadonlyArray<string>;
  A2P_COMPANY_TYPES: ReadonlyArray<string>;
  A2P_JOB_POSITIONS: ReadonlyArray<string>;
  DEFAULT_INDUSTRY_BY_VERTICAL: Readonly<Record<string, string>>;
  findTaxIdPaths(value: unknown): string[];
}

interface ReadinessModule {
  checkA2pReadiness(args: { env: Record<string, string | undefined> }): Promise<{
    ok: true | false | null;
    checks: ReadinessCheck[];
    policies: Record<string, string | undefined>;
    profileCandidates: Array<{ sid: string; friendlyName: string; status: string }>;
  }>;
}

const cache = new Map<string, Promise<unknown>>();

function load<T>(file: string): Promise<T> {
  const path = resolve(opsRoot(), 'lib', file);
  const url = `${pathToFileURL(path).href}?v=${statSync(path).mtimeMs}`;
  let mod = cache.get(url);
  if (!mod) {
    for (const key of cache.keys()) if (key.includes(`/lib/${file}?`)) cache.delete(key);
    mod = import(/* webpackIgnore: true */ url);
    cache.set(url, mod);
  }
  return mod as Promise<T>;
}

export const loadRegister = () => load<RegisterModule>('a2p-register.js');
export const loadReadiness = () => load<ReadinessModule>('a2p-readiness.js');
export const loadIdentity = () => load<IdentityModule>('a2p-identity.js');
export async function loadStore(): Promise<StoreModule> {
  // The store's default Redis client reads KV_* from process.env at first use.
  loadKvCredentials();
  return load<StoreModule>('a2p-registration-store.js');
}

/** The enums the client component's selects need — the one thing that crosses to the browser. */
export async function loadA2pEnums(): Promise<A2pEnums> {
  const [identity, register] = await Promise.all([loadIdentity(), loadRegister()]);
  return {
    industries: identity.A2P_BUSINESS_INDUSTRIES,
    businessTypes: identity.A2P_BUSINESS_TYPES,
    soleProprietorVerticals: identity.A2P_SOLE_PROP_VERTICALS,
    companyTypes: identity.A2P_COMPANY_TYPES,
    jobPositions: identity.A2P_JOB_POSITIONS,
    standardUsecases: register.STANDARD_USECASES,
    defaultIndustryByVertical: identity.DEFAULT_INDUSTRY_BY_VERTICAL,
  };
}
