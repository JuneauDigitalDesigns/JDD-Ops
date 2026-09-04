// Shared shape for every /api/go-live/* action, so <RunBlock> can render any of them without
// knowing which action produced the result.

export interface GoLiveCheck {
  label: string;
  /** true = pass (green), false = fail (red), null = not-applicable / info (grey). */
  ok: boolean | null;
  detail?: string;
}

export interface GoLiveResult {
  ok: boolean;
  /** Whether this was a preview (no writes) or a real run. */
  dryRun: boolean;
  title?: string;
  summary?: string;
  /** Pass/fail rows — used by preflight and parity-style actions. */
  checks?: GoLiveCheck[];
  /** Freeform monospace output — e.g. the KV keys that would be deleted. */
  lines?: string[];
  /** Copyable results worth keeping — e.g. the four live Stripe price IDs. */
  captured?: { label: string; value: string }[];
  error?: string;
}

export type GoLiveAction =
  | 'preflight'
  | 'stripe-go-live'
  | 'kv-reset'
  | 'env-sync'
  | 'turnstile-provision'
  | 'stripe-webhook';
