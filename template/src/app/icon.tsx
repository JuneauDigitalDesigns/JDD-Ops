// Branded favicon, generated at build from the client's own palette.
//
// WHY THIS EXISTS (measured, 2026-08-18)
// The template had no `public/` directory and no icon of any kind, so every deployed client
// site answered `GET /favicon.ico` with a 404. That single 404 was the *entire* Lighthouse
// Best Practices gap on the e2e HVAC client (96, `errors-in-console`); nothing else failed.
//
// Declaring an icon route also stops the implicit /favicon.ico request: Next emits a
// <link rel="icon"> pointing here, so the browser never falls back to the root path.
//
// Deliberately NOT a checked-in binary: the mark has to differ per client, and the palette
// already lives in the schema. `--accent` is used raw here (a solid fill, not text), so the
// derived accessible text token does not apply — but the letter is drawn in `accentFg`,
// which palette.ts now picks by measured contrast, so it stays legible on any brand color.

import { ImageResponse } from 'next/og';
import { CONTENT } from '@/data/site';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  const { brand } = CONTENT;
  const letter = (brand.name || '?').trim().charAt(0).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: brand.palette.accent,
          color: brand.palette.accentFg,
          fontSize: 22,
          fontWeight: 700,
          // No webfont is loaded for the icon: ImageResponse would have to fetch one, and a
          // single letter does not justify it. The default sans is fine at 32px.
          fontFamily: 'sans-serif',
        }}
      >
        {letter}
      </div>
    ),
    { ...size },
  );
}
