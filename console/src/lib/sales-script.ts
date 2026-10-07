/**
 * The cold-call script as a small navigable graph: four tracks of forward steps, plus a shared
 * set of objection beats that any step can route into and that hand you back into the flow.
 *
 * Pure data + small helpers, client-safe, same split as leadTypes / lead-meta: the overlay in
 * components/leads/script/ owns behaviour, this file owns words. It replaced the standalone
 * ops/sales-scripts/jdd-sales-wizard.html, so this is now the one place the script is edited.
 *
 * Shape (v2, response-driven):
 *   - Every step has a `goal` (what you want out of it), a `say` line, `points`, and `branches`.
 *   - You move ONLY by picking a branch (what the prospect said). Forward branches carry a
 *     `bridge`: the transition line you say as you advance. There is no Next button.
 *   - Objections are full beats in OBJECTIONS, navigated to like any step, with their own
 *     branches that route back via the `__offer` / `__close` / `__back` / `__done` tokens.
 *   - Guardrails are back-pocket facts (only if asked), surfaced in a drawer, never routed to.
 *
 * No em-dashes in any spoken line, on purpose (house rule for copy).
 *
 * A branch's `goto`:
 *   'stepId'        a step in the current track (or, if not found there, an objection beat, or a
 *                   step in another track — which switches you to that track)
 *   'track:<id>'    switch track, landing on its first step
 *   '__offer'       the current track's offer step
 *   '__close'       the current track's close step
 *   '__back'        return to the step you came from (same as the Back button)
 *   '__done'        wrap up and close the script
 */

import type { QueuedLead } from './leadTypes';

export type ScriptTrackId = 'nosite' | 'hasite' | 'starter' | 'upsell';
export type BranchTone = 'forward' | 'objection' | 'exit';

export interface ScriptBranch {
  label: string;
  goto: string;
  /** The line to say as you advance. Shown on forward branches; objection/exit branches omit it. */
  bridge?: string;
  /** Overrides the inferred styling/order. Inferred: objection target -> 'objection', else 'forward'. */
  tone?: BranchTone;
}

export interface ScriptStep {
  id: string;
  kind?: 'beat' | 'objection';
  /** Short label for the arc map. Steps that share a label collapse into one arc node. */
  arc?: string;
  title: string;
  goal: string;
  say: string;
  points: string[];
  branches: ScriptBranch[];
  /** Objection beats can carry the demo phone number. */
  phone?: string;
  /** Show the missed-calls calculator toggle on this step. */
  calc?: boolean;
}

export interface ScriptTrack {
  id: ScriptTrackId;
  name: string;
  label: string;
  order: string[];
  steps: Record<string, ScriptStep>;
}

export interface ScriptGuardrail {
  id: string;
  title: string;
  say: string;
  points: string[];
  phone?: string;
}

/**
 * The missed-calls calculator's constants.
 *
 * Mirrors juneau-digital-designs/app/components/home/homepageclient.tsx (LEAD_RATE, CLOSE_RATE,
 * AI_RECOVERY_RATE). Keep them in sync: the point of the calculator is that the number Xander
 * reads out is the same number the prospect can reproduce on the website.
 */
export const CALC = {
  LEAD_RATE: 0.37,
  CLOSE_RATE: 0.46,
  AI_RECOVERY_RATE: 0.5,
} as const;

export function fmtDollars(n: number): string {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2) + 'M';
  if (n >= 1000) return '$' + (n / 1000).toFixed(n >= 100_000 ? 0 : 1) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

/** Yearly revenue lost to missed calls, and the share a receptionist wins back. */
export function calcOutcome(callsPerWeek: number, jobValue: number, catchPct: number) {
  const rec = Math.max(0, Math.min(100, Number.isFinite(catchPct) ? catchPct : 0));
  const annualLeadCalls = callsPerWeek * 52 * CALC.LEAD_RATE;
  const unrecovered = annualLeadCalls * (1 - rec / 100);
  const lost = unrecovered * CALC.CLOSE_RATE * jobValue;
  return { lost, won: lost * CALC.AI_RECOVERY_RATE };
}

/** First word of the lead's name, for "Hey [name]". Falls back so the line still reads. */
export function firstName(name: string | undefined | null): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first || 'there';
}

/** Fill the [name] placeholder in a spoken line. */
export function fillScript(text: string, lead: Pick<QueuedLead, 'name'>): string {
  return text.replace(/\[name\]/g, firstName(lead.name));
}

/**
 * Which track a lead should open on when it has never been scripted before.
 *
 * There is deliberately no `hasWebsite` field on the lead: whether they have a site is a
 * call-time discovery, so the cold default is no-site and the has-site track is one tap away.
 */
export function defaultTrack(
  lead: Pick<QueuedLead, 'planInterest' | 'stage' | 'convertedSlug' | 'clientRecordId'>,
): ScriptTrackId {
  if (lead.convertedSlug || lead.clientRecordId || lead.stage === 'won') return 'upsell';
  if (lead.planInterest === 'starter') return 'starter';
  return 'nosite';
}

/* ─────────────────────────────  Guardrails (drawer only)  ──────────────────── */

export const GUARDRAILS: ScriptGuardrail[] = [
  {
    id: 'monthtomonth',
    title: 'Lock-in / contract',
    say: 'Starter and Growth are month to month. Cancel whenever with thirty days notice. There is no long contract.',
    points: [
      'Safe to use proactively if price or commitment is the wall.',
      'Enterprise is the only one on longer notice (60 days).',
    ],
  },
  {
    id: 'ranking',
    title: 'Google rankings',
    say: 'We do the SEO right: speed, titles, structured data, the technical side. What I will not do is promise you a number-one ranking. Nobody controls Google, and anyone who promises that is selling you something.',
    points: ['Honesty here builds trust with skeptics. Do not overpromise.'],
  },
  {
    id: 'ownership',
    title: '"Do I own it?"',
    say: 'Your content is always yours: name, logo, photos, copy. The site runs on our platform while you are a client, and if you ever leave, ask within thirty days and we hand you a full export.',
    points: ['Only surface this if they ask. Do not volunteer contract detail mid-pitch.'],
  },
  {
    id: 'portout',
    title: 'The phone number',
    say: "The number's yours to use exclusively while you're a client, put it on the truck and your cards. It lives on our phone account, so if you leave and want to keep it, tell us within thirty days and we port it for a one-time fifty.",
    points: ['Only if asked. Honest, not volunteered.'],
  },
];

/* ─────────────────────────────  Objection beats  ───────────────────────────── */

/** Why a JDD site beats what most trades have. Reused wherever a prospect claims a site. */
const SITE_VALUE_POINTS: string[] = [
  'Built to get found and called, not a template or a brochure that just sits there.',
  'Fast pages with the SEO done right: page speed, titles, structured data, sitemaps, so Google actually surfaces you.',
  'Fully managed. We write, build, and host it, you never touch code, and it stays current instead of going stale.',
  'Preview in seventy-two hours, live in under a week. We carry over what is worth keeping and you never chase logins for the old one.',
];

const obj = (s: ScriptStep): [string, ScriptStep] => [s.id, { ...s, kind: 'objection' }];

export const OBJECTIONS: Record<string, ScriptStep> = Object.fromEntries([
  obj({
    id: 'who-told-you',
    title: '"Who told you that?"',
    goal: 'Get past it warm and keep the call moving.',
    say: "My Mom's friend Judy, I think she had you out to fix something of hers a while back. Either way, while I've got you, can I ask you one quick thing?",
    points: [
      'Say it warm and certain, then move. Most shops see enough people not to place one name.',
      'Do not over-explain. The quick pivot question is what gets you past it.',
    ],
    branches: [
      { label: 'They roll with it', bridge: 'So, real quick.', goto: '__back', tone: 'forward' },
    ],
  }),
  obj({
    id: 'brushoff',
    title: '"I\'m busy" / brush-off',
    goal: 'Trade a rushed pitch for a booked callback.',
    say: "No problem, I'll be quick or I'll get out of your hair. Is now just bad timing, or should I catch you after five?",
    points: [
      'Do not fight it. Offer a specific callback time instead.',
      'Write the time in the notes so you actually follow up.',
      'A booked callback beats a rushed pitch every time.',
    ],
    branches: [
      { label: 'They give a callback time', bridge: "Perfect, I'll call then.", goto: '__done', tone: 'forward' },
      { label: 'Hard no', goto: '__done', tone: 'exit' },
    ],
  }),
  obj({
    id: 'distrust',
    title: '"Do I even need this?" / distrust of AI',
    goal: 'Shrink the ask: it only replaces the voicemail.',
    say: "Right now, when you can't pick up, that call goes to voicemail and most people hang up and call the next guy. This only replaces the voicemail.",
    points: [
      'It is not making decisions. It takes a message better than a beep does.',
      'Captures name, number, and job, then hands it to you to close.',
      '"You still call them back. It just makes sure you know they called."',
    ],
    branches: [
      { label: '"Okay, I get it"', bridge: "Here's what it costs.", goto: '__offer', tone: 'forward' },
      { label: '"Still not for me"', goto: 'brushoff', tone: 'exit' },
    ],
  }),
  obj({
    id: 'site',
    title: '"I already have a website"',
    goal: 'Neutralize it, pivot to the phone.',
    say: "That's fine, most people we work with do. But here's what's different about how we build. We give you a fresh site made to get found and called, and carry over what's worth keeping so you're not starting from scratch.",
    points: [
      ...SITE_VALUE_POINTS,
      'If their site is genuinely fine, pivot to the receptionist as a standalone win.',
    ],
    branches: [
      { label: '"Okay, makes sense"', bridge: "So here's the offer.", goto: '__offer', tone: 'forward' },
      { label: '"My site\'s fine, don\'t need a new one"', bridge: 'Fair, then the receptionist alone is the win.', goto: '__offer', tone: 'forward' },
    ],
  }),
  obj({
    id: 'sitefine',
    title: '"My site\'s fine"',
    goal: 'Show why ours is better, then either dig in or pivot to the phone.',
    say: "Totally fair, and I'm not knocking it. Can I tell you real quick what's different about how we build? Most sites just sit there. Ours are built to get you found and actually ring the phone.",
    points: SITE_VALUE_POINTS,
    branches: [
      { label: '"Okay, maybe it could be better"', bridge: "Let me ask you a couple things.", goto: 'discovery', tone: 'forward' },
      { label: '"No, I\'m happy with it"', bridge: "No problem. Then let me show you the part most sites miss.", goto: 'reveal', tone: 'forward' },
    ],
  }),
  obj({
    id: 'price',
    title: '"That\'s too expensive"',
    goal: 'Reframe price as the cost of missed jobs.',
    say: "I hear you. Here's the math though. Even one missed job a week, at a few hundred bucks, is more than the plan costs, and right now you're eating every one of them.",
    points: [
      'Point straight back to their own calculator number.',
      '"Piecing this together elsewhere runs six hundred plus. This is two ninety-seven."',
      'Never argue the price. Argue the cost of not having it.',
    ],
    branches: [
      { label: '"Okay, that\'s fair"', bridge: "Let's get you started.", goto: '__close', tone: 'forward' },
      { label: 'Receptionist is still too much', bridge: "Then let's start with just the site.", goto: 's_present', tone: 'forward' },
      { label: '"I need to think"', goto: 'demo', tone: 'objection' },
    ],
  }),
  obj({
    id: 'robot',
    title: '"Sounds like a robot"',
    goal: 'Turn skepticism into a demo, not an argument.',
    say: "Totally fair. Don't take my word for it. I'll give you a number, call it tonight when you've got a minute and hear it for yourself.",
    phone: '(930) 222-1343',
    points: [
      'Offer the demo line as a follow-up, not a live test on this call.',
      'It does not guess or make things up. If it cannot answer, it takes their details and texts you.',
      '"It never has to be perfect. It just has to beat going to voicemail."',
    ],
    branches: [
      { label: '"Alright, I\'ll call it"', bridge: "Great, here's the next step.", goto: 'demo', tone: 'forward' },
      { label: '"Even so, I\'m good"', goto: 'distrust', tone: 'objection' },
    ],
  }),
  obj({
    id: 'demo',
    title: 'The demo line',
    goal: 'Park a "think about it" on a concrete next action.',
    say: 'Call it tonight and hear it for yourself: (930) 222-1343. Ask it whatever a customer would, then let us talk tomorrow.',
    phone: '(930) 222-1343',
    points: [
      'It role-plays a receptionist. Skeptics who actually call it tend to come back sold.',
      'Confirm a specific follow-up time before you hang up, and write it in the notes.',
    ],
    branches: [
      { label: '"Okay, talk tomorrow"', bridge: "Perfect, I'll check in then.", goto: '__done', tone: 'forward' },
      { label: 'They are ready now', bridge: "Even better, let's start.", goto: '__close', tone: 'forward' },
    ],
  }),
]);

/* ──────────────────────────────  Shared steps  ─────────────────────────────── */

const step = (s: ScriptStep): ScriptStep => s;

const discoveryNoSite = step({
  id: 'discovery',
  arc: 'Discover',
  title: 'How do people find them now?',
  goal: 'Surface that with no site, work slips to whoever shows up online.',
  say: "Let me ask you this. When somebody hears you do good work and goes to look you up, what do they actually find? A Facebook page, a Google listing, or not much?",
  points: [
    'Let them answer. You are listening for "not much" or "just a Facebook page".',
    'Follow up: "and when they cannot find you, they just call the next guy who does show up."',
    'Also learn who answers the phone today. You will use it in a minute.',
  ],
  branches: [
    { label: '"Honestly, not much"', bridge: "That's the gap. Here's what we'd do.", goto: 'website', tone: 'forward' },
    { label: '"Just a Facebook page / old listing"', bridge: "Right, that's not working for you. Here's the fix.", goto: 'website', tone: 'forward' },
    { label: 'Turns out they have an old site', bridge: 'Oh, you do have one? Let me shift gears.', goto: 'track:hasite', tone: 'forward' },
  ],
});

const cost = step({
  id: 'cost',
  arc: 'Cost',
  title: 'Put their number on it.',
  goal: 'Make the loss real using their own numbers.',
  say: "Let's put a real number on that. Tell me about how many you miss a week, and what an average job is worth to you.",
  points: [
    'Open the calculator below and punch in THEIR numbers as they say them.',
    'Read them the "lost per year" figure. Let it land, do not rush past it.',
    '"And that is not counting the ones who just call the next guy."',
    'The number is theirs, not a stat off a slide. That is what makes it hit.',
  ],
  branches: [
    { label: "Number lands, they're leaning in", bridge: "Here's what we do about it.", goto: 'reveal', tone: 'forward' },
    { label: '"I don\'t miss that many"', bridge: "Even one job a week adds up. Here's the fix.", goto: 'reveal', tone: 'forward' },
  ],
  calc: true,
});

const presentGrowth = step({
  id: 'present',
  arc: 'Offer',
  title: 'Present Growth. $297, all in.',
  goal: 'Present Growth as the obvious yes.',
  say: "It's all in one plan. Two hundred ninety-seven a month for the website and the receptionist, and it's month to month, so you're never locked in.",
  points: [
    'No onboarding fee for new clients right now.',
    'Preview within seventy-two hours of your answers, live in under a week.',
    'Piecing this together elsewhere, an agency plus an answering service, runs six hundred plus.',
    'We built the software once. That is the whole reason it is this price, not corner-cutting.',
  ],
  branches: [
    { label: '"Sounds good, let\'s do it"', bridge: "Here's all it takes to start.", goto: 'close', tone: 'forward' },
    { label: '"That\'s too expensive"', goto: 'price', tone: 'objection' },
    { label: '"Sounds like a robot"', goto: 'robot', tone: 'objection' },
    { label: '"I need to think about it"', goto: 'demo', tone: 'objection' },
  ],
});

const closeGrowth = step({
  id: 'close',
  arc: 'Close',
  title: 'Close. Five questions to start.',
  goal: 'Lock the next step and get contact info.',
  say: "Here's all it takes to start. I send you five quick questions about your business, you answer them in one sitting, and I have a preview back to you within seventy-two hours.",
  points: [
    'Get their best email and cell before you hang up.',
    'Set the expectation: preview in 72 hours, live in under a week.',
    '"You do not write anything. You answer the questions, I write the site."',
    'Confirm the next touch: "I will text you the link the second it is ready."',
  ],
  branches: [],
});

/* ──────────────────────────────────  Tracks  ───────────────────────────────── */

const byId = (steps: ScriptStep[]): Record<string, ScriptStep> =>
  Object.fromEntries(steps.map((s) => [s.id, s]));

export const TRACKS: Record<ScriptTrackId, ScriptTrack> = {
  nosite: {
    id: 'nosite',
    name: 'No-site cold',
    label: 'Website + Receptionist',
    order: ['open', 'discovery', 'website', 'voicemail', 'cost', 'reveal', 'present', 'close'],
    steps: byId([
      step({
        id: 'open',
        arc: 'Open',
        title: 'Open with the connection.',
        goal: 'Warm open. Earn a yes and permission to ask.',
        say: "Hey [name], this is Xander with Juneau Digital Designs, a small website agency here. I'm calling because my Mom's friend said you don't have a website but you do great work. Is that true?",
        points: [
          'Warm and curious, not a pitch. The "is that true?" invites a yes and starts a conversation.',
          'Let them answer. If they confirm, go straight into discovery, do not launch into features.',
          'If they correct you ("I do have a site"), roll with it and switch tracks. It is not a trap.',
          'Low energy. You are a neighbor who heard they are good, not a telemarketer.',
        ],
        branches: [
          { label: '"Yeah, that\'s true"', bridge: 'Let me ask you this.', goto: 'discovery', tone: 'forward' },
          { label: '"I actually have a website"', bridge: 'Oh good, let me shift gears then.', goto: 'track:hasite', tone: 'forward' },
          { label: '"Who told you?"', goto: 'who-told-you', tone: 'objection' },
          { label: '"Not interested" / "I\'m busy"', goto: 'brushoff', tone: 'exit' },
        ],
      }),
      discoveryNoSite,
      step({
        id: 'website',
        arc: 'Site',
        title: 'Sell the site. Get found, get called.',
        goal: 'Land the website as the fix before anything else comes up.',
        say: "Here's what we'd build you. A real website that gets you found and gets your phone ringing, not a brochure that just sits there.",
        points: SITE_VALUE_POINTS,
        branches: [
          { label: '"Okay, how much?"', bridge: "Before I give you the number, one quick thing.", goto: 'voicemail', tone: 'forward' },
          { label: '"I just want a website, no AI stuff"', bridge: "Easy, we can keep it to just the site.", goto: 's_present', tone: 'forward' },
        ],
      }),
      step({
        id: 'voicemail',
        arc: 'Phone',
        title: 'The phone question.',
        goal: 'Surface the voicemail pain that justifies the receptionist.',
        say: "When you're out on a job and the phone rings, does it mostly just go to voicemail?",
        points: [
          'Let them answer. Most will admit a lot slips to voicemail.',
          '"And most people who hit voicemail just hang up and call the next guy."',
          'If they own that pain, it is your opening for the receptionist and the whole system we built.',
        ],
        branches: [
          { label: '"Yeah, a lot goes to voicemail"', bridge: "Let's put a real number on that.", goto: 'cost', tone: 'forward' },
          { label: '"No, I catch my calls / just the site"', bridge: "Then let's keep it simple, just the site.", goto: 's_present', tone: 'forward' },
        ],
      }),
      cost,
      step({
        id: 'reveal',
        arc: 'Reveal',
        title: 'The fix. Site plus receptionist.',
        goal: 'Add the receptionist on top of the site they already want.',
        say: "So on top of the site, you get a receptionist that picks up 24/7 when you can't, in English or Spanish. Same system, one bill.",
        points: [
          'It answers the way you would: gets their name, number, and what the job is.',
          'Then it texts you the details, so you call back a warm lead instead of a voicemail.',
          'It even calls back anyone who fills out your website form, usually within a minute.',
          'The site and the receptionist run as one system we built, not bolted-together tools.',
        ],
        branches: [
          { label: '"Okay, how much?"', bridge: "It's all one plan.", goto: 'present', tone: 'forward' },
          { label: '"Does it sound like a robot?"', goto: 'robot', tone: 'objection' },
        ],
      }),
      presentGrowth,
      closeGrowth,
    ]),
  },

  hasite: {
    id: 'hasite',
    name: 'Has-site cold',
    label: 'Rebuild + Receptionist',
    order: ['open', 'discovery', 'reveal', 'present', 'close'],
    steps: byId([
      step({
        id: 'open',
        arc: 'Open',
        title: 'Open with the site angle.',
        goal: 'Warm open on the site angle. Earn a yes.',
        say: "Hey [name], this is Xander with Juneau Digital Designs, a small website agency here. I'm calling because my Mom's friend said you do great work but your website could be doing more for you. Is that true?",
        points: [
          'Same warm frame as the no-site hook. The compliment ("you do great work") comes first.',
          '"Could be doing more" is deliberately soft. You are not trashing their site, you are curious.',
          'On a yes, go into discovery and let it tell you whether the gap is the site, the phone, or both.',
          'If they are proud of the site, do not argue it. Pivot to what happens after someone calls.',
        ],
        branches: [
          { label: '"Yeah, it could be better"', bridge: 'Let me ask you a couple things.', goto: 'discovery', tone: 'forward' },
          { label: '"My site\'s fine"', goto: 'sitefine', tone: 'objection' },
          { label: '"Who told you?"', goto: 'who-told-you', tone: 'objection' },
          { label: '"Not interested" / "I\'m busy"', goto: 'brushoff', tone: 'exit' },
        ],
      }),
      step({
        id: 'discovery',
        arc: 'Discover',
        title: 'Site and phone, evenly.',
        goal: 'Sort which is weaker: the site or the phone.',
        say: "Makes sense. Two quick things. When someone lands on your site, does it actually turn them into a call or a booking? And when the phone rings while you're on a job, what happens to it?",
        points: [
          'Ask both, then stop talking. You are sorting which problem is bigger for them.',
          'Site weak, phone fine: lean rebuild. Phone weak: lean receptionist. Both: full system.',
          'Let discovery decide the direction. Do not pre-pick the plan.',
        ],
        branches: [
          { label: "The site's the weak part", bridge: "Then let's fix the site first.", goto: 'siteonly', tone: 'forward' },
          { label: "It's really the phone", bridge: "Here's what we'd do.", goto: 'reveal', tone: 'forward' },
          { label: '"I handle my calls fine"', goto: 'distrust', tone: 'objection' },
        ],
      }),
      step({
        id: 'reveal',
        arc: 'Reveal',
        title: 'The fix. A better site plus a receptionist.',
        goal: 'Show the fix: better site plus a receptionist.',
        say: "Here's what we do about it. We build you a fresh site that gets you found and called, and carry over what's worth keeping. Then a receptionist picks up 24/7 when you can't, in English or Spanish.",
        points: [
          'It answers the way you would: gets their name, number, and what the job is.',
          'Then it texts you the details, so you call back a warm lead instead of a voicemail.',
          'You will not have to chase anyone for logins to the old site.',
          'One system, one bill. If they only care about the site, that is fine, price it that way.',
        ],
        branches: [
          { label: '"Okay, how much?"', bridge: "It's all one plan.", goto: 'present', tone: 'forward' },
          { label: '"Does it sound like a robot?"', goto: 'robot', tone: 'objection' },
          { label: '"Just the site, no AI"', bridge: "Sure, let's just do the site.", goto: 'siteonly', tone: 'forward' },
        ],
      }),
      step({
        id: 'siteonly',
        arc: 'Offer',
        title: "Just the site. Here's the offer.",
        goal: 'Land the site-only offer as a continuation, then plant the receptionist.',
        say: "Here's the site we'd build you and what it runs. It's a hundred seventeen a month plus a one-time hundred-dollar setup, fully managed: hosting, security, and backups all handled.",
        points: [
          'Built to get found and called, and we carry over what is worth keeping.',
          'Two content edits a month and a client portal to check your site anytime.',
          'Month to month, cancel with thirty days notice.',
        ],
        branches: [
          { label: '"Sounds good"', bridge: "One thing for later, then let's start.", goto: 's_close', tone: 'forward' },
          { label: '"That\'s too expensive"', goto: 'price', tone: 'objection' },
        ],
      }),
      presentGrowth,
      closeGrowth,
    ]),
  },

  starter: {
    id: 'starter',
    name: 'Website only',
    label: 'Starter',
    order: ['s_open', 's_present', 's_close'],
    steps: byId([
      step({
        id: 's_open',
        arc: 'Open',
        title: 'Open with the connection.',
        goal: 'Warm open aimed at a site-only buyer.',
        say: "Hey [name], this is Xander with Juneau Digital Designs, a small website agency here. My Mom's friend said you do great work but you're tough to find online. Is that true?",
        points: [
          'Same warm hook, aimed at a site-only buyer. Keep the receptionist in your back pocket.',
          'We write it, build it, and host it. They never touch code or keep it updated.',
          'They answer a few questions and it is live in under a week. Contact-form leads go straight to their inbox.',
          'On a yes, go to price. This buyer wants the site, not a system.',
        ],
        branches: [
          { label: '"Alright, what\'s it cost?"', bridge: "Here's the number.", goto: 's_present', tone: 'forward' },
          { label: '"I already have a website"', goto: 'site', tone: 'objection' },
          { label: '"Who told you?"', goto: 'who-told-you', tone: 'objection' },
        ],
      }),
      step({
        id: 's_present',
        arc: 'Price',
        title: 'Present Starter. $117/mo.',
        goal: 'Present Starter cleanly.',
        say: "It's a hundred seventeen a month, plus a one-time hundred-dollar setup. That's the site, hosting, security, and backups, all handled for you.",
        points: [
          'Two content edits a month included.',
          'Client portal to check your site anytime.',
          'Month to month, cancel with thirty days notice.',
          'If they hesitate on price, point to how much one job is worth to them.',
        ],
        branches: [
          { label: '"Sounds good"', bridge: "One thing for later, then let's start.", goto: 's_close', tone: 'forward' },
          { label: '"That\'s too expensive"', goto: 'price', tone: 'objection' },
        ],
      }),
      step({
        id: 's_close',
        arc: 'Close',
        title: 'Close, and plant the seed.',
        goal: 'Close the site, plant the receptionist seed.',
        say: "One thing for later. Whenever you're ready, we can add a receptionist that answers 24/7 when you can't. No rush at all, the site comes first.",
        points: [
          'Plant it, do not push it. This is the setup for the upsell call down the road.',
          'Then close: "I will send you five quick questions, preview back in seventy-two hours."',
          'Get their email and cell.',
          'Note in the notes that they are a receptionist upsell candidate.',
        ],
        branches: [],
      }),
    ]),
  },

  upsell: {
    id: 'upsell',
    name: 'Upsell',
    label: 'Website to Receptionist',
    order: ['u_pick', 'u_checkin', 'u_raised', 'u_quantify', 'u_present', 'u_close'],
    steps: byId([
      step({
        id: 'u_pick',
        arc: 'Start',
        title: 'Pick your opener.',
        goal: 'Pick the right way in.',
        say: 'Two ways into this call. Which one is it?',
        points: [
          'Post-launch check-in: they are already a happy website client and you are following up.',
          'They raised it: a client or prospect just told you they are missing calls or cannot pick up.',
          'Either way you already have trust, so this is lighter on proof and heavier on the fix.',
        ],
        branches: [
          { label: 'Post-launch check-in', goto: 'u_checkin', tone: 'forward' },
          { label: 'They raised the phone problem', goto: 'u_raised', tone: 'forward' },
        ],
      }),
      step({
        id: 'u_checkin',
        arc: 'Opener',
        title: 'Check-in. Let them talk.',
        goal: 'Surface the phone gap through a friendly check-in.',
        say: "Hey [name], Xander checking in. How's the site been treating you, are you seeing more calls come through?",
        points: [
          'Let them talk. Listen for "yeah, but I can\'t always answer."',
          'If calls are up, that is your opening: "good problem, let us make sure none slip."',
          'Steer to the phone: "when you are on a job and it rings, what happens to it?"',
        ],
        branches: [
          { label: 'They mention missing calls', bridge: "Let's see what that's worth.", goto: 'u_quantify', tone: 'forward' },
          { label: '"Honestly everything\'s fine"', goto: 'u_close', tone: 'exit' },
        ],
      }),
      step({
        id: 'u_raised',
        arc: 'Opener',
        title: 'They raised it. Validate.',
        goal: 'Validate the pain, borrow existing trust.',
        say: "You mentioned the phone's the hard part. That's actually the exact piece we can fix next.",
        points: [
          'Validate it: "when it is you and a truck, the phone rings while your hands are full."',
          'Borrow the trust you have earned: "you already trust the site we built you."',
          '"This is that same thing, but for your calls."',
        ],
        branches: [{ label: 'Continue', bridge: "Let's put a number on it.", goto: 'u_quantify', tone: 'forward' }],
      }),
      step({
        id: 'u_quantify',
        arc: 'Quantify',
        title: "Quantify what's slipping.",
        goal: 'Quantify the leak with their numbers.',
        say: "Let's see what those missed calls are actually worth to you.",
        points: [
          'Open the calculator below, punch in their real numbers.',
          'Read them the lost-per-year figure and let it sit.',
          '"You did the hard part getting found. This makes sure you do not lose them at the phone."',
        ],
        branches: [{ label: 'Number lands', bridge: "Here's what we add.", goto: 'u_present', tone: 'forward' }],
        calc: true,
      }),
      step({
        id: 'u_present',
        arc: 'Offer',
        title: 'Present the add. Move to Growth.',
        goal: 'Move them up to Growth.',
        say: "We add the receptionist to what you've already got. It answers 24/7, gets the name, number, and job, and texts you every time.",
        points: [
          'English or Spanish, captures the lead, calls back form fills within a minute.',
          'Moving up to Growth is two hundred ninety-seven a month, all in, still month to month.',
          'Every call logged in your portal with a summary you can read later.',
        ],
        branches: [
          { label: '"Let\'s do it"', bridge: "I'll get it set up.", goto: 'u_close', tone: 'forward' },
          { label: '"That\'s too expensive"', goto: 'price', tone: 'objection' },
          { label: '"Sounds like a robot"', goto: 'robot', tone: 'objection' },
        ],
      }),
      step({
        id: 'u_close',
        arc: 'Close',
        title: 'Close the upgrade.',
        goal: 'Confirm the upgrade, reassure nothing breaks.',
        say: 'I can have your number and receptionist live this week. Want me to get it set up?',
        points: [
          'Confirm the upgrade and set the go-live expectation.',
          '"Nothing changes with your site. This just adds the phone piece."',
          'Reassure: "same portal, you will just start seeing calls logged in it."',
        ],
        branches: [],
      }),
    ]),
  },
};

export const TRACK_IDS: ScriptTrackId[] = ['nosite', 'hasite', 'starter', 'upsell'];

/** Each track's offer and close step, for the `__offer` / `__close` routing tokens. */
export const TRACK_OFFER: Record<ScriptTrackId, string> = {
  nosite: 'present',
  hasite: 'present',
  starter: 's_present',
  upsell: 'u_present',
};
export const TRACK_CLOSE: Record<ScriptTrackId, string> = {
  nosite: 'close',
  hasite: 'close',
  starter: 's_close',
  upsell: 'u_close',
};

/* ────────────────────────────  Graph navigation  ───────────────────────────── */

export type NavResult =
  | { kind: 'step'; track: ScriptTrackId; stepId: string }
  | { kind: 'back' }
  | { kind: 'done' };

/**
 * Resolve a branch `goto` against the track you are currently in. Bare ids prefer the current
 * track, then the objection beats, then any other track (which is a track switch, e.g. the price
 * down-sell landing on Starter's price step).
 */
export function resolveGoto(goto: string, track: ScriptTrackId): NavResult {
  if (goto === '__back') return { kind: 'back' };
  if (goto === '__done') return { kind: 'done' };
  if (goto === '__close') return { kind: 'step', track, stepId: TRACK_CLOSE[track] };
  if (goto === '__offer') return { kind: 'step', track, stepId: TRACK_OFFER[track] };
  if (goto.startsWith('track:')) {
    const t = goto.slice('track:'.length) as ScriptTrackId;
    return { kind: 'step', track: t, stepId: TRACKS[t].order[0] };
  }
  if (TRACKS[track].steps[goto]) return { kind: 'step', track, stepId: goto };
  if (OBJECTIONS[goto]) return { kind: 'step', track, stepId: goto };
  for (const t of TRACK_IDS) if (TRACKS[t].steps[goto]) return { kind: 'step', track: t, stepId: goto };
  return { kind: 'step', track, stepId: goto };
}

/** A step, whether it lives in a track or in the shared objection beats. */
export function getStep(track: ScriptTrackId, stepId: string): ScriptStep | undefined {
  return TRACKS[track].steps[stepId] ?? OBJECTIONS[stepId];
}

export function isObjectionStep(stepId: string): boolean {
  return !!OBJECTIONS[stepId];
}

/** Effective tone for styling and ordering: explicit wins, else objection target -> objection. */
export function branchTone(b: ScriptBranch): BranchTone {
  if (b.tone) return b.tone;
  if (!b.goto.startsWith('track:') && !b.goto.startsWith('__') && OBJECTIONS[b.goto]) return 'objection';
  return 'forward';
}

/** Short destination label shown on the right of a branch. */
export function branchHint(b: ScriptBranch, track: ScriptTrackId): string {
  const g = b.goto;
  if (g === '__back') return 'Back';
  if (g === '__done') return 'Wrap up';
  if (g === '__close') return getStep(track, TRACK_CLOSE[track])?.arc ?? 'Close';
  if (g === '__offer') return getStep(track, TRACK_OFFER[track])?.arc ?? 'Offer';
  if (g.startsWith('track:')) return TRACKS[g.slice('track:'.length) as ScriptTrackId].name;
  if (OBJECTIONS[g]) return 'Objection';
  const nav = resolveGoto(g, track);
  if (nav.kind === 'step') {
    const s = getStep(nav.track, nav.stepId);
    return s?.arc ?? s?.title.split('.')[0] ?? g;
  }
  return g;
}

/** The forward-order sort weight for a branch tone. */
export const TONE_ORDER: Record<BranchTone, number> = { forward: 0, objection: 1, exit: 2 };

export interface ArcNode {
  label: string;
  stepIds: string[];
  firstId: string;
}

/** Collapse a track's `order` into arc-map nodes, merging consecutive steps that share a label. */
export function arcNodes(track: ScriptTrackId): ArcNode[] {
  const nodes: ArcNode[] = [];
  for (const stepId of TRACKS[track].order) {
    const s = TRACKS[track].steps[stepId];
    const label = s?.arc ?? s?.title.split('.')[0] ?? stepId;
    const last = nodes[nodes.length - 1];
    if (last && last.label === label) last.stepIds.push(stepId);
    else nodes.push({ label, stepIds: [stepId], firstId: stepId });
  }
  return nodes;
}
