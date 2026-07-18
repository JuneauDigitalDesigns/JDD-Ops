import Anthropic from '@anthropic-ai/sdk';

// Phase 1 of the URL flow: use Claude's web_fetch server tool to read a business's own
// website and return dense plain-text notes of every brand fact and piece of copy found.
// Phase 2 (structured generation) lives in the generate-copy route and turns these notes
// into the SiteContent copy object. Replaces the old Firecrawl scrape path.

const SCAN_SYSTEM = `You are extracting a local business's brand information from their own website.
Report ONLY what is actually present on the page — business name, tagline, phone, email, address,
license/credentials, services offered (with short descriptions), about/story text, testimonials or
reviews (quote + name + location), FAQs, trust badges/certifications, and any headline or CTA
marketing copy. Never invent facts. If something isn't on the page, omit it. Output dense plain-text
notes grouped by section. No preamble, no markdown.`;

/** Prepend https:// if the operator typed a bare domain; throws on an invalid URL. */
export function normalizeUrl(raw: string): string {
  const trimmed = (raw ?? '').trim();
  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const u = new URL(withProto);
  if (!u.hostname.includes('.')) throw new Error('That does not look like a website URL.');
  return u.toString();
}

/** Fetch + read a website with Claude's web_fetch tool, returning extracted notes. */
export async function scanWebsiteNotes(client: Anthropic, url: string): Promise<string> {
  const model = process.env.CONSOLE_COPY_MODEL || 'claude-opus-4-8';
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Fetch and read this business website, then extract everything described in your instructions. URL: ${url}`,
    },
  ];

  let res: Anthropic.Message | undefined;
  // web_fetch is a server tool; the sampling loop may pause with stop_reason "pause_turn".
  for (let i = 0; i < 6; i++) {
    res = (await client.messages.create({
      model,
      max_tokens: 4000,
      system: SCAN_SYSTEM,
      tools: [{ type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 5 }],
      messages,
    } as unknown as Anthropic.MessageCreateParamsNonStreaming)) as Anthropic.Message;
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content });
  }

  const notes = (res?.content ?? [])
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!notes) throw new Error('Could not read any readable content from that site.');
  return notes;
}
