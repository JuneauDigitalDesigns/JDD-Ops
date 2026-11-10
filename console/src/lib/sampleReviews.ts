/**
 * Sample reviews that must never reach a client site (operator decision, 2026-11-10).
 *
 * The industry presets and the default seed used to carry sample testimonials so a template
 * could be judged with its reviews section filled. They are gone from those files now, but the
 * list has to outlive them: `effective = preset <- imported <- generated` let a preset quote
 * through wherever a client had no reviews, and a quote deleted from a preset is still baked into
 * any client exported while it was there. Both e2e fixtures carry the deprecated HVAC preset's
 * three, and e2etestgrowth.vercel.app served them under "Real Reviews from Real Customers" with
 * schema.org Review markup.
 *
 * So this is a list of every quote any preset or seed has shipped (extracted from
 * console/src/data/verticals, console/src/data/site.ts and deprecated/studio/preview), and
 * stripSampleReviews removes any item matching one. It runs on the Studio's effective content
 * (so the preview matches what ships) and again in the export route before site.ts is written
 * (the hard gate: direct API calls bypass the Studio). Add to this list, never remove from it.
 * Guarded by test/no-sample-reviews.test.mjs.
 */

export interface RetiredSampleQuote {
  /** The sample reviewer name it shipped with. */
  a: string;
  /** Where it shipped from, for the reader. */
  from: string;
  q: string;
}

export const RETIRED_SAMPLE_QUOTES: readonly RetiredSampleQuote[] = [
  { a: "Mike R.", from: "data/site.ts",
    q: "They showed up two hours after I called, on a Saturday, and had my furnace running before dinner. Incredibly professional and honest about pricing." },
  { a: "Sandra T.", from: "data/site.ts",
    q: "We've used Peak for all three of our rental properties for five years. Never a bad experience. The price-lock guarantee is real, what they quote is what we pay." },
  { a: "James O.", from: "data/site.ts",
    q: "Fast, clean, and explained everything in plain English. My old contractor always made me feel like I was being upsold. Peak felt completely different." },
  { a: "Chris D.", from: "data/verticals/car-detailing.ts",
    q: "My car looked better after the paint correction than it did when I bought it new. These guys are artists. Worth every penny." },
  { a: "Amanda F.", from: "data/verticals/car-detailing.ts",
    q: "Booked the mobile service and they came to my office. Interior was immaculate when I finished my meeting. Couldn't be easier." },
  { a: "Marcus P.", from: "data/verticals/car-detailing.ts",
    q: "The ceramic coating has made maintenance so easy, water just beads off. Six months later the car still looks freshly detailed." },
  { a: "Maria L.", from: "data/verticals/health.ts",
    q: "From my first visit I felt genuinely listened to. The plan they built actually fit my life, and I've stuck with it." },
  { a: "David K.", from: "data/verticals/health.ts",
    q: "Booking was simple and the whole team is so kind. I always leave feeling calmer and more supported." },
  { a: "Priya S.", from: "data/verticals/health.ts",
    q: "They took the time to understand my goals instead of rushing me through. It's made a real difference in how I feel day to day." },
  { a: "Jennifer T.", from: "data/verticals/lawn-care.ts",
    q: "My lawn has never looked this good. They show up every Thursday without fail, the edging is immaculate, and they actually care about getting the details right." },
  { a: "Frank C.", from: "data/verticals/lawn-care.ts",
    q: "Switched from a national company and the difference is night and day. They're local, they know what works in our soil, and I've had zero weeds this summer." },
  { a: "Susan H.", from: "data/verticals/lawn-care.ts",
    q: "The spring fertilization and aeration made a huge difference. My lawn went from patchy and pale to thick and green in about six weeks." },
  { a: "Thomas W.", from: "data/verticals/plumbing.ts",
    q: "Had a burst pipe at 6am. They answered immediately, were at our house within 45 minutes, and had it fixed before I had to leave for work. Incredible." },
  { a: "Patricia L.", from: "data/verticals/plumbing.ts",
    q: "Finally found plumbers who give you the price before they start. No surprise invoice, no upsells. The drain clearing took 20 minutes and has stayed clear." },
  { a: "Andrew B.", from: "data/verticals/plumbing.ts",
    q: "Replaced our old water heater with a tankless. They explained all the options, matched the best one for our home, and the installation was neat and fast." },
  { a: "David K.", from: "data/verticals/roofing.ts",
    q: "After the hailstorm, they were on my roof the next morning for an inspection and handled the entire insurance claim. New roof looks amazing." },
  { a: "Karen M.", from: "data/verticals/roofing.ts",
    q: "Got three quotes and theirs was competitive, but they were the only ones who could start within the week. Done in a day and a half, spotless cleanup." },
  { a: "Robert S.", from: "data/verticals/roofing.ts",
    q: "The 30-year warranty was the deciding factor. They explained every step and checked in with us throughout the job. Highly recommended." },
  { a: "Marcus P.", from: "deprecated preset data/verticals/car-detailing.ts",
    q: "The ceramic coating has made maintenance so easy — water just beads off. Six months later the car still looks freshly detailed." },
  { a: "Michael R.", from: "deprecated preset data/verticals/hvac.ts",
    q: "Called at 11pm on a Friday when our furnace died. They had a tech at our door within an hour and fixed it that night. Incredible service." },
  { a: "Sandra T.", from: "deprecated preset data/verticals/hvac.ts",
    q: "Have used them for three years now. Always on time, always honest. When our AC needed a part they sourced it same-day." },
  { a: "James O.", from: "deprecated preset data/verticals/hvac.ts",
    q: "Quoted us $800 less than two other companies for a new heat pump. Installation was clean and the system has been perfect." },
  { a: "Karen M.", from: "deprecated preset data/verticals/roofing.ts",
    q: "Got three quotes and theirs was competitive, but they were the only ones who could start within the week. Done in a day and a half — spotless cleanup." },
];

/** Letters and digits only, lowercased: two preset revisions differ only by "easy — water" vs
 *  "easy, water", and an operator may have trimmed a trailing space. */
function normalize(q: string): string {
  return q.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const RETIRED = new Set(RETIRED_SAMPLE_QUOTES.map((r) => normalize(r.q)));

export function isSampleReview(q: unknown): boolean {
  return typeof q === "string" && q.trim() !== "" && RETIRED.has(normalize(q));
}

/**
 * Returns the content with every sample review removed, and how many were. Never mutates the
 * input. Content with no matching item comes back as the same object.
 *
 * Removing to an empty list is safe at both call sites: the Studio applies this AFTER the
 * preset merge (so an empty list cannot fall through to a preset), and every preset is empty
 * now anyway. The review sections already render nothing for an empty list.
 */
export function stripSampleReviews<T>(content: T): { content: T; removed: number } {
  const c = content as unknown as { testimonials?: { items?: Array<{ q?: unknown }> } };
  const items = c?.testimonials?.items;
  if (!Array.isArray(items)) return { content, removed: 0 };
  const kept = items.filter((t) => !isSampleReview(t?.q));
  const removed = items.length - kept.length;
  if (removed === 0) return { content, removed: 0 };
  return {
    content: { ...(content as object), testimonials: { ...c.testimonials, items: kept } } as T,
    removed,
  };
}
