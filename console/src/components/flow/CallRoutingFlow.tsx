'use client';
// Inbound call routing — human-first, AI on fallback.
//
// This replaces a 5-item substeps list plus three callouts. The reason it needed to be a
// picture: the whole behaviour is a FORK, and a fork rendered as sequential bullets reads as
// a sequence. Operators kept expecting the AI to answer on every call. Here the two branches
// are drawn as two branches, the human one heavier (it is the default path) and the AI one
// as a dimmer fallback hanging below it.
//
// Every value is bound live from the site's .env.local — an unprovisioned client shows the
// same shape with dashed nodes, so the diagram doubles as a "what's missing" readout.

import { DeviceMobile, Phone, PhoneCall, Robot, ArrowsLeftRight, CheckCircle } from '@phosphor-icons/react';
import type { SiteInfo } from '@/lib/types';
import FlowFigure from './FlowFigure';
import { columns } from './layout';
import type { FlowModel, FlowNode } from './types';

const ICON = 15;

// Vertical rhythm — a STARTING composition only. FlowCanvas relaxes these rows apart using the
// nodes' measured heights, so a wrapped value can't crush the gap below it. Row indices are what
// actually order the bands; the numbers just set the initial spacing.
const ROW_A = 0;    // rings the client
const ROW_B = 150;  // answered → normal call
const ROW_C = 300;  // no-answer → SIP
const ROW_D = 450;  // → Retell agent

function bind(v: string | undefined): Pick<FlowNode, 'state' | 'value'> {
  return v ? { state: 'live', value: v } : { state: 'pending' };
}

export function callRoutingModel(site: SiteInfo, width: number): FlowModel {
  const env = site.env;
  const ring = env.CLIENT_FORWARD_RING_SECONDS ?? '25';
  const sipDomain = env.RETELL_SIP_DOMAIN ?? 'sip.retellai.com';
  const host = site.slug.replace(/_/g, '-');

  // caller · twilio · /api/voice + no-answer · the right-hand outcome stack
  const [c0, c1, c2, c3] = columns(width, [0.9, 1.25, 1.3, 1.4]);

  const nodes: FlowNode[] = [
    {
      id: 'caller',
      x: c0.x, y: ROW_A + 96, row: 1, w: c0.w, h: 72,
      title: 'Customer',
      note: 'dials the business',
      state: 'live',
      icon: <DeviceMobile size={ICON} style={{ color: 'var(--fg-3)' }} />,
    },
    {
      id: 'twilio',
      x: c1.x, y: ROW_A + 78, row: 1, w: c1.w,
      kicker: 'TWILIO_NUMBER',
      title: 'JDD Twilio number',
      ...bind(env.TWILIO_NUMBER),
      placeholder: '+1… (provision first)',
      tone: 'accent',
      icon: <Phone size={ICON} style={{ color: 'var(--accent)' }} />,
    },
    {
      id: 'voice',
      x: c2.x, y: ROW_A + 78, row: 1, w: c2.w,
      kicker: 'WEBHOOK',
      title: '/api/voice',
      value: `https://${host}.vercel.app/api/voice`,
      state: site.repoBuilt ? 'live' : 'pending',
      note: 'set at number-purchase time',
      tone: 'accent',
      icon: <ArrowsLeftRight size={ICON} style={{ color: 'var(--accent)' }} />,
    },
    // ── The default path: ring a human. Heavier by design. ──
    {
      id: 'owner',
      x: c3.x, y: ROW_A, row: 0, w: c3.w,
      kicker: 'CLIENT_FORWARD_PHONE',
      title: `Rings the client, ${ring}s`,
      ...bind(env.CLIENT_FORWARD_PHONE),
      placeholder: 'the brand’s real phone',
      tone: 'ok',
      icon: <PhoneCall size={ICON} style={{ color: 'var(--ok)' }} />,
    },
    {
      id: 'connected',
      x: c3.x, y: ROW_B, row: 2, w: c3.w, h: 62,
      title: 'Normal call — AI never engages',
      state: 'live',
      tone: 'ok',
      emphasis: 'secondary',
      icon: <CheckCircle size={ICON} weight="fill" style={{ color: 'var(--ok)' }} />,
    },
    // ── The fallback: only on no-answer / busy / failed. ──
    {
      id: 'noanswer',
      x: c2.x, y: ROW_C, row: 3, w: c2.w,
      kicker: 'ON NO-ANSWER',
      title: '/api/voice/no-answer',
      note: 'registers the call with Retell, gets a call_id',
      state: site.repoBuilt ? 'live' : 'pending',
      emphasis: 'secondary',
      tone: 'warn',
    },
    {
      id: 'sip',
      x: c3.x, y: ROW_C, row: 3, w: c3.w,
      kicker: 'SIP',
      title: `sip:{call_id}@${sipDomain}`,
      note: 'plain outbound <Dial><Sip> — no bridge, no trunk',
      state: 'live',
      emphasis: 'secondary',
    },
    {
      id: 'agent',
      x: c3.x, y: ROW_D, row: 4, w: c3.w,
      kicker: 'RETELL_AGENT_ID',
      title: 'Retell AI agent answers',
      ...bind(env.RETELL_AGENT_ID),
      placeholder: 'agent_… (provision first)',
      tone: 'accent',
      icon: <Robot size={ICON} style={{ color: 'var(--accent)' }} />,
    },
  ];

  return {
    // The canvas IS the frame — columns() pins the last column's right edge to `width`.
    width,
    height: ROW_D + 110,
    nodes,
    edges: [
      { from: 'caller', to: 'twilio' },
      { from: 'twilio', to: 'voice' },
      { from: 'voice', to: 'owner', label: 'first', tone: 'ok' },
      { from: 'owner', to: 'connected', fromSide: 'b', toSide: 't', label: 'answered', tone: 'ok' },
      // Drops into the TOP of no-answer, not its left side. Entering from the left meant the
      // path ran horizontally across the node's own interior to reach it.
      { from: 'voice', to: 'noanswer', fromSide: 'b', toSide: 't', label: 'no answer', tone: 'warn', dashed: true },
      { from: 'noanswer', to: 'sip', dashed: true },
      { from: 'sip', to: 'agent', fromSide: 'b', toSide: 't', dashed: true },
    ],
  };
}

export default function CallRoutingFlow({ site }: { site: SiteInfo }) {
  return (
    // No caption: the step's lede already explains the automation, and repeating it here was
    // the same duplication this redesign is removing — just in prose instead of a table.
    <FlowFigure build={(w) => callRoutingModel(site, w)} eyebrow="Inbound call routing" />
  );
}
