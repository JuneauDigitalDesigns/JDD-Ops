'use client';
// Post-call logging + owner SMS.
//
// Today this chain is split across three steps in two different phases, so nowhere in the app
// can you see it end to end. The node that matters most is the FILTER: it's the reason a
// client-answered call never logs and never texts, and it's the first thing to check when the
// owner complains about missing rows. It gets its own seam here rather than living in a
// parenthetical.

import { Funnel, PhoneDisconnect, Table, ChatText, WebhooksLogo } from '@phosphor-icons/react';
import type { SiteInfo } from '@/lib/types';
import FlowFigure from './FlowFigure';
import { columns } from './layout';
import type { FlowModel, FlowNode } from './types';

const ICON = 15;

// The two outcomes stack in the right column; rows are spaced for a wrapped value.
const ROW_TOP = 0;
const ROW_BOTTOM = 180;

function bind(v: string | undefined): Pick<FlowNode, 'state' | 'value'> {
  return v ? { state: 'live', value: v } : { state: 'pending' };
}

export function postCallModel(site: SiteInfo, width: number): FlowModel {
  const env = site.env;

  // call ends · webhook · filter · the two outcomes
  const [c0, c1, c2, c3] = columns(width, [0.95, 1.35, 1.2, 1.25]);

  const nodes: FlowNode[] = [
    {
      id: 'ended',
      x: c0.x, y: 96, row: 1, w: c0.w,
      title: 'AI call ends',
      note: 'Retell fires call_analyzed',
      state: 'live',
      icon: <PhoneDisconnect size={ICON} style={{ color: 'var(--fg-3)' }} />,
    },
    {
      id: 'webhook',
      x: c1.x, y: 78, row: 1, w: c1.w,
      kicker: 'RETELL_POST_CALL_WEBHOOK_URL',
      title: 'Make webhook',
      ...bind(env.RETELL_POST_CALL_WEBHOOK_URL),
      placeholder: 'set by onboard.js after the clone',
      tone: 'accent',
      icon: <WebhooksLogo size={ICON} style={{ color: 'var(--accent)' }} />,
    },
    {
      id: 'filter',
      x: c2.x, y: 78, row: 1, w: c2.w,
      kicker: 'THE PART PEOPLE FORGET',
      title: 'Filter: AI-handled only',
      note: 'drops client-answered calls, so they never log or text',
      state: 'live',
      tone: 'warn',
      icon: <Funnel size={ICON} weight="fill" style={{ color: 'var(--warn)' }} />,
    },
    {
      id: 'airtable',
      x: c3.x, y: ROW_TOP, row: 0, w: c3.w,
      kicker: 'AIRTABLE_BASE_ID',
      title: 'Call Log row',
      ...bind(env.AIRTABLE_BASE_ID),
      placeholder: 'app… (provision first)',
      tone: 'ok',
      icon: <Table size={ICON} style={{ color: 'var(--ok)' }} />,
    },
    {
      id: 'sms',
      x: c3.x, y: ROW_BOTTOM, row: 2, w: c3.w,
      kicker: 'TWILIO SMS → OWNER',
      title: 'Brief to the owner',
      ...bind(env.CLIENT_FORWARD_PHONE),
      placeholder: 'the owner’s number',
      note: `from ${env.TWILIO_NUMBER ?? 'the client’s Twilio number'}`,
      tone: 'ok',
      icon: <ChatText size={ICON} style={{ color: 'var(--ok)' }} />,
    },
  ];

  return {
    // The canvas IS the frame — columns() pins the last column's right edge to `width`.
    width,
    height: ROW_BOTTOM + 130,
    nodes,
    edges: [
      { from: 'ended', to: 'webhook' },
      { from: 'webhook', to: 'filter' },
      { from: 'filter', to: 'airtable', label: 'passed', tone: 'ok' },
      { from: 'filter', to: 'sms', label: 'passed', tone: 'ok' },
    ],
  };
}

export default function PostCallFlow({ site }: { site: SiteInfo }) {
  return (
    <FlowFigure
      build={(w) => postCallModel(site, w)}
      eyebrow="Post-call logging & owner SMS"
      footer={
        <p className="text-[11.5px] leading-[1.5] text-fg3">
          Nothing arriving? Walk it backwards: Retell call log (did the call complete?) → the Make scenario’s
          History (did the webhook fire, did the filter pass, did a module error?) → Twilio Messaging logs
          (is the number registered for SMS yet?).
        </p>
      }
    />
  );
}
