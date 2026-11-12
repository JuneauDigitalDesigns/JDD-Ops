// The brand box left of the business name in every nav and footer, and the footer's copyright line
// (Xander 2026-11-11, from his Tracewell front-to-back test; mockup "The logo goes in the brand box").
// Mockup approved by Xander 2026-11-11: the light tile, and word for word the copyright line
// (W1), the footer columns (W2, W3) and the Studio label "Logo" (W4). The credit (W5) is his own pick.
//
// With a logo, the box is a light tile holding it: the same height and corners as the template's own
// box, widening for a wide wordmark up to three times its height, never more, so the name keeps its
// room. The tile is white on purpose, not a palette token: most logos are drawn for a white ground,
// and straight on a dark footer (or a dark nav a client picks) they disappear. alt="" because the
// business name sits right beside it as text. Without a logo, the template's own box (`fallback`)
// renders exactly as before.
//
// The logo goes through imageAt: the export rewrites it to a localized base (/img/<hash>) and the
// pipeline writes <hash>-<width>.webp beside it (image-pipeline.ts, `isLogo`: no crop, no grade).
//
// BYTE-IDENTICAL in console/src/lib and template/src/lib (console/test/brand-chrome.test.mjs).
import type { ReactNode } from 'react';
import { E } from '@/lib/editable';
import { imageAt } from '@/lib/localImage';
import { legalName, logoUrl } from '@/lib/brandChrome';

const SIZE = {
  // 36px box (h-9), as most navs and every footer draw it.
  md: { tile: 'h-9 min-w-[36px] max-w-[108px]', img: 'h-[30px] max-w-[102px]' },
  // 32px on a phone, 36px from md: Plumbing's and Roofing's navs.
  sm: {
    tile: 'h-8 min-w-[32px] max-w-[96px] md:h-9 md:min-w-[36px] md:max-w-[108px]',
    img: 'h-[26px] max-w-[90px] md:h-[30px] md:max-w-[102px]',
  },
} as const;

export function BrandBox({
  content,
  fallback,
  radius,
  size = 'md',
  ring = false,
}: {
  content: unknown;
  /** The template's own box, drawn when the client gave no logo. */
  fallback: ReactNode;
  /** The box's corner class, e.g. `rounded-[10px]`, so each vertical keeps its own shape. */
  radius: string;
  size?: keyof typeof SIZE;
  /** A hairline around the tile, for a light nav where white meets white. */
  ring?: boolean;
}) {
  const logo = logoUrl(content);
  if (!logo) return <>{fallback}</>;
  const s = SIZE[size];
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden bg-white p-[3px] ${s.tile} ${radius} ${ring ? 'ring-1 ring-inset ring-rule' : ''}`}>
      <img src={imageAt(logo, 640)} alt="" className={`block w-auto object-contain ${s.img}`} />
    </span>
  );
}

/** The agency's site, the credit's only link. */
export const AGENCY_URL = 'https://www.juneaudigitaldesigns.com';

/**
 * "Created by Juneau Digital Designs" in every footer's bottom bar, the name the link (Xander
 * 2026-11-11, words picked by him). rel="nofollow": the same link in the footer of every client site
 * is what Google calls a link scheme unless it passes no ranking (his call, 2026-11-11). Not
 * editable: it is the agency's, not the client's.
 */
export function AgencyCredit({ className = '' }: { className?: string }) {
  return (
    <span className={className}>
      Created by{' '}
      <a href={AGENCY_URL} rel="nofollow noopener" target="_blank" className="underline-offset-2 hover:underline">
        Juneau Digital Designs
      </a>
    </span>
  );
}

/** "© 2026 <legal name>. All rights reserved." The name stays editable where it lives. */
export function Copyright({ content, year = new Date().getFullYear() }: { content: unknown; year?: number }) {
  const n = legalName(content);
  return (
    <>
      © {year} <E p={n.path}>{n.text}</E>. All rights reserved.
    </>
  );
}
