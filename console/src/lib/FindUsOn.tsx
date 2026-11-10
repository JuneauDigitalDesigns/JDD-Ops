// "Find us on": the client's own profiles in the footer (SEO plan D11, the heading approved word
// for word by Xander 2026-11-10). Google Business Profile first. Plain links with rel="me noopener"
// and never nofollow: Google's own advice for a business's own profiles. Hidden when the client
// has none. The same list is the structured data's sameAs (lib/profileLinks.ts).
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (test/profile-links.test.mjs). Colour and
// type come from the footer that mounts it (text-current); pass className to space or tint it.
import { profileLinks } from '@/lib/profileLinks';

export default function FindUsOn({ content, className = '' }: { content: unknown; className?: string }) {
  const links = profileLinks(content);
  if (links.length === 0) return null;
  return (
    <div className={`mt-5 ${className}`}>
      <p className="font-sans text-[12.5px] font-bold uppercase tracking-[0.12em] opacity-80">Find us on</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[14px]">
        {links.map((l) => (
          <li key={l.url}>
            <a href={l.url} rel="me noopener" target="_blank" className="underline-offset-4 transition-opacity hover:underline hover:opacity-100">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
