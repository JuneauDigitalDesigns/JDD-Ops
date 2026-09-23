// ─────────────────────────────────────────────────────────────────────────────
// src/lib/bots.ts — bot policy, shared by robots.ts (advisory) and middleware.ts
// (enforced). Baked into every JDD client site by the provisioning template.
//
// Goal: keep the site discoverable through AI answers and search, but stop the bulk
// scraping that otherwise drives a constant round-the-clock data-transfer baseline (the
// exact problem seen on live client sites). This mirrors the reference implementation on
// the Atlantic Compressor site, generalized with the per-client `seo.aiCrawlers` override.
//
// ALWAYS KEPT (never in any block list here):
//   - Real search engines: Googlebot, Bingbot, DuckDuckBot, Applebot, Slurp, YandexBot.
//   - Social link-preview bots: facebookexternalhit, Twitterbot, LinkedInBot, Slackbot,
//     Discordbot, TelegramBot, WhatsApp.
// Rate/volume of the kept bots is capped by Vercel Firewall rules, not here.
// ─────────────────────────────────────────────────────────────────────────────

/** AI *search / answer* bots — they cite pages to users in real time, so they're discovery. */
const AI_SEARCH_UAS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'Claude-User',
  'Claude-SearchBot',
] as const;

/**
 * Bulk model-training crawlers. Distinct from the search/answer bots above:
 *   - GPTBot (training) vs OAI-SearchBot / ChatGPT-User (search).
 *   - ClaudeBot (training) vs Claude-User / Claude-SearchBot (search).
 *   - meta-externalagent / FacebookBot (AI crawlers) vs facebookexternalhit (link preview).
 */
const AI_TRAINING_UAS = [
  'GPTBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Bytespider',
  'Amazonbot',
  'meta-externalagent',
  'FacebookBot',
  'cohere-ai',
  'Diffbot',
  'Omgilibot',
  'Omgili',
  'ImagesiftBot',
  'Timpibot',
  'VelenPublicWebCrawler',
  'PanguBot',
  'Scrapy',
] as const;

/** Third-party SEO / backlink / market-intel crawlers — zero value to a local business. */
const SEO_AUDIT_UAS = [
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'DataForSeoBot',
  'BLEXBot',
  'rogerbot',
  'PetalBot',
  'Barkrowler',
  'ZoominfoBot',
  'serpstatbot',
  'MegaIndex',
  'Seekport',
  'SEOkicks',
] as const;

/**
 * robots-only tokens (no real request user-agent). Meaningful only in robots.txt — matching
 * these as UA substrings would risk blocking the real Applebot (Siri/Spotlight) or Googlebot,
 * so they never enter the middleware UA list.
 */
const AI_TRAINING_ROBOTS_TOKENS = ['Google-Extended', 'Applebot-Extended'] as const;

export type BotPolicy = {
  /** user-agent tokens to `Disallow: /` in robots.txt. */
  robotsDisallow: string[];
  /** lowercased UA substrings the middleware hard-blocks with a 403. */
  blockedUaPatterns: string[];
};

/**
 * Resolve the bot policy for a site from its `seo.aiCrawlers` setting.
 *
 *   - (default / unset)  keep AI-search, block AI-training + SEO-audit tools.
 *   - 'allow'            keep AI-search AND AI-training (max AI presence); block only SEO tools.
 *   - 'deny'             block AI-training AND AI-search (client wants zero AI); search engines
 *                        and social previews still allowed.
 *
 * SEO-audit tools are blocked in every mode. The parameter is loosely typed because the
 * template's `Seo` type doesn't declare `aiCrawlers` — it's injected into CONTENT.seo by
 * @jdd/schema and read via a cast (see robots.ts), so treat it as optional here.
 */
export function botPolicy(seo?: { aiCrawlers?: string | null } | null): BotPolicy {
  const mode = seo?.aiCrawlers === 'deny' ? 'deny' : seo?.aiCrawlers === 'allow' ? 'allow' : 'default';

  const training = mode === 'allow' ? [] : [...AI_TRAINING_UAS];
  const search = mode === 'deny' ? [...AI_SEARCH_UAS] : [];
  const robotsTokens = mode === 'allow' ? [] : [...AI_TRAINING_ROBOTS_TOKENS];

  // SEO-audit always; training unless opted in; AI-search only when the client opts fully out.
  const uaBlock = [...SEO_AUDIT_UAS, ...training, ...search];

  return {
    robotsDisallow: [...uaBlock, ...robotsTokens],
    blockedUaPatterns: uaBlock.map((ua) => ua.toLowerCase()),
  };
}
