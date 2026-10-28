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
 * Populated for HVAC only here; the four vertical-templates-v1 verticals (roofing, plumbing,
 * lawn-care, car-detailing) land in src/data/vertical-language.ts additions made alongside their
 * own catalog components (see design/EXEC-vertical-templates-v1.md Phases 5/6/8/9). Health is
 * excluded from that programme — see design/HANDOFF-health-vertical-research.md — and keeps
 * falling back to this HVAC entry via languageFor().
 *
 * HVAC's palette/pairingId were corrected 2026-10-28 (PLAN §2 / D6 / D12): VERTICAL_LANGUAGES is
 * now the SINGLE palette + typography authority for the bespoke vertical templates — presetFor()
 * composes this over the verticals/hvac.ts preset, so these are the values that actually render,
 * not a suggestion the preset can contradict. The values below are the approved Northstar Standard
 * mockup's own tokens (design/northstar-standard/mockups.html): a warm orange accent on a white
 * ground, navy ink, Oswald display over Inter body. The previous entry here (petrol teal #16556A on
 * cream, pairingId 'instrument') silently overrode the preset's correct orange/navy/white and
 * shipped a different look than what was approved — that override is deleted, not relocated.
 * verticals/hvac.ts's own palette is now vestigial (a separate cleanup removes it later; left in
 * place here to keep this a one-file behavioural change).
 *
 * This white ground is an intentional pure value — decision 9's shared warm-ground rule is
 * deliberately dropped for this bespoke template (and for roofing/plumbing, landing alongside it).
 * See the WARMTH_EXEMPT set in vertical-language.test.mjs.
 *
 * VERTICAL ROTATION NOTE (decision 46): Health and Wellness reuses this system as-is, with NO
 * separate research pass. RESEARCH-local-service-visual-design.md is trades-only evidence, so this
 * is an UNTESTED BET. If the health vertical's first build looks wrong, the cause is decision 46,
 * not the shared foundation: do NOT widen VerticalLanguage, add a health-only component, or re-open
 * the token layer. Escalate per §0.6 and let the user decide whether health gets its own research.
 * (2026-10-28: escalated. Health is parked — see design/HANDOFF-health-vertical-research.md.)
 */
export const VERTICAL_LANGUAGES: Record<string, VerticalLanguage> = {
  hvac: {
    pairingId: 'oswald',
    palette: {
      // The approved Northstar Standard mockup's own tokens — warm orange accent, navy
      // structural ink, pure-white ground. See the file header for why this is now the
      // authority rather than a second, contradicting source.
      accent: '#E0602C',
      accentFg: '#FFFFFF',
      bg: '#FFFFFF',
      bgSoft: '#F4F6F8',
      ink: '#13293F',
      inkSoft: '#4C5E74',
      rule: '#E2E8F0',
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
  /**
   * Roofing — vertical-templates-v1 Phase 5. Transcribed from the approved mockup's own CSS
   * custom properties (design/vertical-templates-v1/home-mockups.html #roofing), palette
   * revised 2026-10-28 so this vertical shares no hue family with HVAC's navy/steel (D1):
   * bitumen brown-charcoal structural dark over a warm grey ground, clay accent, hazard amber
   * reserved for urgency only (amber/bitumen/ink-faint are literal hex in the Roofing*
   * components, same as HVAC's gold/navy/steel — they are not standard palette slots).
   * `proofSkin` is unused by this vertical's bespoke RoofingReviews (fixed design, no skin —
   * same as every Hvac* component); kept populated because the type requires a value.
   */
  roofing: {
    pairingId: 'archivo',
    palette: {
      accent: '#B4512A',
      accentFg: '#FFFFFF',
      bg: '#FFFFFF',
      bgSoft: '#F5F2EF',
      ink: '#231D1A',
      inkSoft: '#5B4F48',
      rule: '#E2D9D2',
    },
    photography: {
      subjects: [
        'a roofer installing architectural shingles on a residential roof',
        'a crew tearing off old shingles before a re-roof',
        'a technician photographing hail damage for an insurance claim',
        'a branded work truck in a residential driveway',
        'seamless gutters being installed along a roofline',
        'a roof inspection with a clipboard and a drone overhead',
      ],
      grade: 'house',
      ratioBias: 'wide',
    },
    rhythm: { homeTemplateId: 'home-standard', proofSkin: 'soft' },
  },
  /**
   * Lawn Care — vertical-templates-v1 Phase 6. Transcribed from the approved mockup's own CSS
   * custom properties (design/vertical-templates-v1/home-mockups.html #lawn): warm paper
   * ground, forest green accent, sun gold for emphasis/ribbon — the only palette in this
   * programme with no cool grey or navy anywhere. Forest/forest-2/sun are literal hex in the
   * Lawn* components (not standard palette slots), same as every other vertical's signature
   * colours. Already passes assertWarm unmodified (warm paper, not pure white).
   */
  'lawn-care': {
    pairingId: 'figtree',
    palette: {
      accent: '#2F7A33',
      accentFg: '#FFFFFF',
      bg: '#FCFCF8',
      bgSoft: '#EFF3E9',
      ink: '#16251A',
      inkSoft: '#4C5F50',
      rule: '#D8E2D0',
    },
    photography: {
      subjects: [
        'a lawn technician mowing a residential front yard',
        'a crew applying fertilizer or seasonal treatment',
        'a core aeration machine working across a lawn',
        'a branded truck and trailer parked on a residential street',
        'a close-up of healthy, freshly striped turf',
        'a crew performing fall leaf cleanup',
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
