import type { Plan } from './types';

/**
 * Curated registry of the client env vars that are safe to edit from /manage.
 *
 * Shared by the API route and the UI (no 'server-only' here) so validation and labels
 * can't drift between them. Keys outside this list still show up in the advanced drawer
 * as free text — the registry is about guardrails, not access.
 *
 * Every entry mirrors how the deployed site actually reads the value; see
 * lib/site-routes/*.ts, which onboard.js writes into each client repo.
 */

export type FieldKind = 'phone' | 'int' | 'email' | 'text' | 'select';

/**
 * Which panel a key belongs to on /manage → Environment. Purely presentational —
 * the API route never reads it, so a wrong guess is cosmetic, never a validation bug.
 */
export type EnvGroupId = 'routing' | 'leads' | 'integrations' | 'advanced';

export const ENV_GROUPS: Array<{ id: EnvGroupId; label: string; help: string }> = [
  {
    id: 'routing',
    label: 'Call routing',
    help: 'How an inbound call reaches the owner, and where it falls through to the AI agent.',
  },
  {
    id: 'leads',
    label: 'Lead delivery',
    help: 'What happens when someone submits the form on the site.',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    help: 'External services this site reads from and writes to.',
  },
];

export interface EnvField {
  key: string;
  label: string;
  help: string;
  kind: FieldKind;
  plans: Plan[];
  /** Panel this field renders under. Optional so existing literals stay valid. */
  group?: EnvGroupId;
  options?: string[];
  placeholder?: string;
  /** Masked in responses; an unchanged mask sentinel is ignored on write. */
  secret?: boolean;
  /** Refuse to clear — the site breaks without it. */
  required?: boolean;
  min?: number;
  max?: number;
}

const VOICE: Plan[] = ['growth', 'enterprise'];
const ALL: Plan[] = ['starter', 'growth', 'enterprise'];

export const ENV_FIELDS: EnvField[] = [
  {
    key: 'CLIENT_FORWARD_PHONE',
    group: 'routing',
    label: 'Forward phone',
    help: "Owner's real number. Inbound Twilio calls ring here first, before the AI picks up.",
    kind: 'phone',
    plans: VOICE,
    required: true,
    placeholder: '(207) 318-1838',
  },
  {
    key: 'CLIENT_FORWARD_RING_SECONDS',
    group: 'routing',
    label: 'Ring seconds',
    help: 'How long the owner’s phone rings before the call falls through to the Retell agent.',
    kind: 'int',
    plans: VOICE,
    min: 5,
    max: 60,
    placeholder: '25',
  },
  {
    key: 'AIRTABLE_BASE_ID',
    group: 'integrations',
    label: 'Airtable base ID',
    help: 'Base holding the Call Log table. Also mirrored onto the portal account record.',
    kind: 'text',
    plans: VOICE,
    placeholder: 'appXXXXXXXXXXXXXX',
  },
  {
    key: 'TWILIO_NUMBER',
    group: 'routing',
    label: 'Twilio number',
    help: 'JDD-owned number for this site. Used as the forward leg caller ID and callback origin.',
    kind: 'phone',
    plans: VOICE,
    placeholder: '+12073181838',
  },
  {
    key: 'RETELL_AGENT_ID',
    group: 'routing',
    label: 'Retell agent ID',
    help: 'The per-client voice agent dialed on no-answer and for lead callbacks.',
    kind: 'text',
    plans: VOICE,
    placeholder: 'agent_…',
  },
  {
    key: 'RETELL_SIP_DOMAIN',
    group: 'routing',
    label: 'Retell SIP domain',
    help: 'Where /api/voice/no-answer hands the call off. Leave as sip.retellai.com unless told otherwise.',
    kind: 'text',
    plans: VOICE,
    placeholder: 'sip.retellai.com',
  },
  {
    key: 'LEAD_DELIVERY_MODE',
    group: 'leads',
    label: 'Lead delivery',
    help: '“callback” has the agent dial the lead back; “email” sends the owner a Resend email.',
    kind: 'select',
    plans: ALL,
    options: ['email', 'callback'],
  },
  {
    key: 'LEAD_TO_EMAIL',
    group: 'leads',
    label: 'Lead email recipient',
    help: 'Where starter lead emails land — normally brand.email from the intake.',
    kind: 'email',
    plans: ALL,
  },
  {
    key: 'LEAD_BRAND_NAME',
    group: 'leads',
    label: 'Lead email brand name',
    help: 'Personalizes the lead email subject and heading.',
    kind: 'text',
    plans: ALL,
  },
  {
    key: 'RESEND_FROM_EMAIL',
    group: 'leads',
    label: 'Resend from address',
    help: 'Sender for lead emails. Must be on a Resend-verified domain.',
    kind: 'email',
    plans: ALL,
    placeholder: 'leads@juneaudigitaldesigns.com',
  },
];

/** Sentinel the API sends in place of a secret, and ignores if it comes back unchanged. */
export const SECRET_MASK = '••••••••';

const SECRET_KEY_RE = /(_KEY|_TOKEN|_SECRET|_PASSWORD|AUTH)$/;

/**
 * Master credentials synced per-project. Masked in every LIST response — nothing that
 * returns many values at once ever carries these in full.
 *
 * The one exception is /api/manage/env/reveal, which returns a single explicitly-named
 * key for the reveal-on-click affordance. See that route for why.
 */
export function isSecretKey(key: string): boolean {
  return SECRET_KEY_RE.test(key);
}

/** Show enough to confirm which credential is set, never enough to use it. */
export function maskSecret(value: string): string {
  return value.length <= 4 ? SECRET_MASK : `${SECRET_MASK}${value.slice(-4)}`;
}

export function fieldsForPlan(plan: Plan): EnvField[] {
  return ENV_FIELDS.filter((f) => f.plans.includes(plan));
}

/**
 * Curated fields for a plan, bucketed into panels in ENV_GROUPS order.
 *
 * Empty groups are dropped, which matters: a starter client has fields in `leads`
 * only, so rendering all three headers would give it two empty boxes.
 */
export function groupedFieldsForPlan(
  plan: Plan,
): Array<{ group: (typeof ENV_GROUPS)[number]; fields: EnvField[] }> {
  const forPlan = fieldsForPlan(plan);
  return ENV_GROUPS.map((group) => ({
    group,
    fields: forPlan.filter((f) => (f.group ?? 'advanced') === group.id),
  })).filter((g) => g.fields.length > 0);
}

/**
 * Group for ANY key, curated or not, so the advanced table can sort uncurated keys
 * into the same panels instead of dumping RETELL_POST_CALL_WEBHOOK_URL next to a
 * one-field Integrations panel. UI-only — the API never calls this.
 */
export function groupForKey(key: string): EnvGroupId {
  const field = findField(key);
  if (field?.group) return field.group;
  if (/^(AIRTABLE|RESEND|MAKE)_/.test(key) || key.startsWith('RETELL_POST_CALL_')) {
    return 'integrations';
  }
  if (/^(TWILIO|CLIENT_FORWARD)_/.test(key) || key.startsWith('RETELL_')) return 'routing';
  if (key.startsWith('LEAD_')) return 'leads';
  return 'advanced';
}

export function findField(key: string): EnvField | undefined {
  return ENV_FIELDS.find((f) => f.key === key);
}

/**
 * Normalize a US phone number to E.164 — the exact rule lib/site-routes/voice.route.ts
 * applies at call time. Catching it here means a bad number fails in the UI instead of
 * silently returning "This number is not configured" TwiML to a real caller.
 */
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\+\d{8,15}$/.test(trimmed)) return trimmed;
  const d = trimmed.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return null;
}

export type Validation = { ok: true; value: string } | { ok: false; error: string };

/** Validate + normalize one submitted value. Returns the value to write to disk. */
export function validateField(field: EnvField, raw: string): Validation {
  const value = raw.trim();

  if (!value) {
    if (field.required) return { ok: false, error: `${field.label} can’t be empty.` };
    return { ok: true, value: '' };
  }

  switch (field.kind) {
    case 'phone': {
      const e164 = toE164(value);
      if (!e164) return { ok: false, error: `${field.label} isn’t a valid US phone number.` };
      return { ok: true, value: e164 };
    }
    case 'int': {
      if (!/^\d+$/.test(value)) return { ok: false, error: `${field.label} must be a whole number.` };
      const n = parseInt(value, 10);
      if (field.min !== undefined && n < field.min) {
        return { ok: false, error: `${field.label} must be at least ${field.min}.` };
      }
      if (field.max !== undefined && n > field.max) {
        return { ok: false, error: `${field.label} must be ${field.max} or less.` };
      }
      return { ok: true, value: String(n) };
    }
    case 'email': {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { ok: false, error: `${field.label} isn’t a valid email address.` };
      }
      return { ok: true, value };
    }
    case 'select': {
      if (field.options && !field.options.includes(value)) {
        return { ok: false, error: `${field.label} must be one of: ${field.options.join(', ')}.` };
      }
      return { ok: true, value };
    }
    case 'text': {
      if (field.key === 'AIRTABLE_BASE_ID' && !/^app[A-Za-z0-9]{14}$/.test(value)) {
        return { ok: false, error: 'Airtable base ID looks wrong — expected app + 14 characters.' };
      }
      return { ok: true, value };
    }
  }
}

/** Env keys the console owns elsewhere; editing them by hand causes drift, so they're read-only. */
export const LOCKED_KEYS = new Set([
  'VERCEL_PROJECT_NAME', // renaming here would orphan the Vercel project
  'CLERK_USER_ID', // written by the portal link repair tool
  'RETELL_LLM_ID', // bound to the agent by onboard.js / update-prompt
]);

/** A .env.local line the UI shows in the advanced drawer rather than as a curated field. */
export function isAdvancedKey(key: string): boolean {
  return !findField(key) && !LOCKED_KEYS.has(key);
}
