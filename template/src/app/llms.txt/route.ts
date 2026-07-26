import { CONTENT } from '@/data/site';

// Serves /llms.txt — a plain-text summary aimed at LLM consumers.
//
// A route handler rather than a static public/llms.txt so it regenerates from the schema on
// every build; a checked-in text file would silently go stale the first time a client's
// hours or services changed.
//
// Honest framing: llms.txt is an emerging convention, not a standard, and nothing is
// obliged to read it. It costs one small file. The JSON-LD graph in layout.tsx is what
// actually gets parsed today — treat this as complementary, not as the main event.

export const dynamic = 'force-static';

function line(label: string, value: unknown): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? `${label}: ${v}\n` : '';
}

export function GET(): Response {
  // Read structurally: the template's placeholder type is a reduced subset of the full
  // exported schema, so `extensions` and friends may not exist here.
  const c = CONTENT as unknown as Record<string, any>;
  const brand = c.brand ?? {};
  const seo = c.seo ?? {};
  const ext = c.extensions ?? {};

  const name = String(brand.long || brand.name || '').trim();
  let out = `# ${name}\n\n`;

  const summary = String(seo.llmsSummary || seo.description || brand.tagline || '').trim();
  if (summary) out += `${summary}\n\n`;

  out += '## Contact\n';
  out += line('Phone', brand.phone);
  out += line('Email', brand.email);
  out += line('Address', brand.address);
  out += line('Website', seo.canonical);
  out += line('Established', brand.established);
  out += line('License', brand.license);

  const services = Array.isArray(c.services?.items) ? c.services.items : [];
  if (services.length) {
    out += '\n## Services\n';
    for (const s of services) {
      const t = String(s?.t ?? '').trim();
      if (!t) continue;
      const d = String(s?.d ?? '').trim();
      out += d ? `- ${t}: ${d}\n` : `- ${t}\n`;
    }
  }

  const area = Array.isArray(ext.serviceArea) ? ext.serviceArea.filter(Boolean) : [];
  if (area.length) out += `\n## Service area\n${area.join(', ')}\n`;

  const hours = ext.hours && typeof ext.hours === 'object' ? ext.hours : null;
  if (hours && Object.keys(hours).length) {
    out += '\n## Hours\n';
    for (const [day, val] of Object.entries(hours)) {
      const v = String(val ?? '').trim();
      if (v) out += `- ${day}: ${v}\n`;
    }
  }

  const faq = Array.isArray(c.faq?.items) ? c.faq.items : [];
  if (faq.length) {
    out += '\n## FAQ\n';
    for (const f of faq) {
      const q = String(f?.q ?? '').trim();
      const a = String(f?.a ?? '').trim();
      if (q && a) out += `\n### ${q}\n${a}\n`;
    }
  }

  return new Response(out, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
