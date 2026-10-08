import type { SkinId } from '@/lib/skins';
import type { VerticalId } from '@/lib/verticals';

/**
 * A vertical's design language: EXACTLY four axes (decision 35), layered over the one shared
 * foundation (decision 37). There is deliberately NO field here that can name a component or a
 * vertical-private page template. If a vertical ever needs one, the foundation is too thin and the
 * fix is to generalise that component into the shared catalog, not to widen this type. See the
 * Known tensions section of DECISIONS-template-fidelity-v2.md and §0.6's escalation rule.
 *
 * CLIENT-SAFE: imported by presetFor (verticals.ts), itself used by 'use client' components, so no
 * node:fs and no `server-only`. vertical-language.test.mjs pins the key set so a fifth axis fails.
 */
export type VerticalLanguage = {
  /** A FONT_PAIRINGS id (lib/fonts.ts). Display and body are one family (decision 7). */
  pairingId: string;
  /** The seven authored palette slots, composed onto the preset's brand.palette by presetFor. */
  palette: { accent: string; accentFg: string | null; bg: string; bgSoft: string; ink: string; inkSoft: string; rule: string };
  /** `grade` has exactly one legal value: one recipe is what makes mixed sources read as one set
   *  (decision 15). `ratioBias` leans the crop frame; `subjects` name what a photo should be of. */
  photography: { subjects: string[]; grade: 'house'; ratioBias: 'wide' | 'tall' | 'square' };
  /** Which of the shared home templates this vertical defaults to, and the skin its proof band wears. */
  rhythm: { homeTemplateId: string; proofSkin: SkinId };
};

/**
 * Populated for HVAC only. Transcribed from console/design/foundation-v2/VERTICAL-LANGUAGE-hvac.md,
 * whose contrast numbers were produced by the real @jdd/ui derivation. The remaining five verticals
 * each land in their own later cycle (decision 37): a Phase 5 mockup repeat, an entry here, a
 * verticals/<id>.ts palette, and an image-placeholders.ts curation.
 *
 * VERTICAL ROTATION NOTE (decision 46): Health and Wellness reuses this system as-is, with NO
 * separate research pass. RESEARCH-local-service-visual-design.md is trades-only evidence, so this
 * is an UNTESTED BET. If the health vertical's first build looks wrong, the cause is decision 46,
 * not the shared foundation: do NOT widen VerticalLanguage, add a health-only component, or re-open
 * the token layer. Escalate per §0.6 and let the user decide whether health gets its own research.
 */
export const VERTICAL_LANGUAGES: Record<string, VerticalLanguage> = {
  hvac: {
    pairingId: 'instrument',
    palette: {
      // accent + accentFg are the HVAC decision (11): a deep petrol teal-blue on the cool side of
      // the HVAC coding, not a saturated primary. The other five slots are the Phase 2 warm set.
      accent: '#16556A',
      accentFg: '#FFFFFF',
      bg: '#FAF7F2',
      bgSoft: '#F1EBE2',
      ink: '#1A1512',
      inkSoft: '#584E45',
      rule: '#DFD6C9',
    },
    photography: {
      subjects: [
        'a technician servicing an outdoor condenser unit',
        'a branded service van in a residential driveway',
        'a hand adjusting a wall thermostat',
        'clean ductwork in a finished mechanical room',
        'a technician inspecting a rooftop AC unit',
        'a furnace checked under a work light',
      ],
      grade: 'house',
      ratioBias: 'wide',
    },
    rhythm: { homeTemplateId: 'home-standard', proofSkin: 'soft' },
  },
};

/** The language for a vertical id, falling back to HVAC when the id has no entry yet (every
 *  vertical but HVAC, until its own cycle). Guarded so a custom or not-yet-built vertical never
 *  crashes presetFor. */
export function languageFor(id: VerticalId): VerticalLanguage {
  return VERTICAL_LANGUAGES[id] ?? VERTICAL_LANGUAGES.hvac;
}
