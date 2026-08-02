import Image from 'next/image';
import Link from 'next/link';

/**
 * The JDD mark — the console's home link, and the only branding in the bar.
 *
 * The wordmark that used to sit beside it ("JDD Console", Big Shoulders 18px) is gone. The
 * bar's job is wayfinding, and an app title you can't click through to anything is the one
 * thing on it that never answers a question.
 *
 * This is `JDD_logo.png` from the marketing site — the square app tile, not `JDD_mark.png`,
 * the horizontal JDD | Juneau Digital Designs lockup that site's navbar uses. The lockup is
 * 2.55:1 and renders 48–64px tall there; in a 52px bar it would eat the whole NAVIGATE zone.
 *
 * The asset has a cream ground baked in that is very close to --bg, so on the bar it reads
 * as letterforms rather than as a chip. If that ever stops being true (a palette change, a
 * different asset), mask to the letterforms instead of shrinking it further.
 */
export default function JddMark() {
  return (
    <Link
      href="/"
      aria-label="All clients"
      title="All clients"
      className="shrink-0 rounded-[5px] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <Image
        src="/JDD_logo.png"
        alt="JDD Console"
        width={551}
        height={549}
        priority
        className="h-[26px] w-[26px] rounded-[5px]"
      />
    </Link>
  );
}
