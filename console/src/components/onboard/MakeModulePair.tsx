'use client';
// Faithful replicas of the two Make.com module panels the operator edits by hand.
//
// These are deliberately NOT themed to the console. Make's UI is white and this reproduces it —
// the whole point is that what's on screen matches what's in front of you in the other tab, so
// "do this" and "this is what it looks like" are the same picture. Every colour here is a
// literal, not a token, for exactly that reason.
//
// The two panels sit side by side joined by a dot trail that runs Airtable blue → Twilio red,
// because they are one flow: the webhook fires, the row is written, the owner is texted.
//
// Clicking any expression box copies the RAW `{{…}}` text (never the prettified pill labels)
// and keeps that box marked, so a ten-field mapping is a visible checklist of how far you got.

import { useCallback, useState } from 'react';
import { ArrowsClockwise, Check } from '@phosphor-icons/react';
import { makeModulesForSite, type MakeField, type MakeModule, type MakeToken } from '@/lib/make-modules';
import type { ClientContext, SiteInfo } from '@/lib/types';

const PILL: Record<MakeToken['k'], React.CSSProperties> = {
  var: { background: '#b4295c', color: '#fff' },
  varlt: { background: '#fdeef4', color: '#b4295c', border: '1px solid #f3bed3' },
  op: { background: '#3fae6a', color: '#fff' },
  fn: { background: '#eceef1', color: '#4a5159' },
  nl: { background: '#d9c9f2', color: '#5b3c96' },
  lit: { color: '#2b3137', fontSize: 12.5 },
  txt: { color: '#2b3137', fontSize: 12.5 },
};

function Pill({ token }: { token: MakeToken }) {
  const plain = token.k === 'lit' || token.k === 'txt';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 3,
        fontSize: 11.5,
        fontWeight: 500,
        padding: plain ? '2px 2px' : '2px 6px',
        lineHeight: 1.45,
        whiteSpace: 'nowrap',
        ...PILL[token.k],
      }}
    >
      {token.t}
    </span>
  );
}

function ExprBox({ field, copied, onCopy }: { field: MakeField; copied: boolean; onCopy: (raw: string) => void }) {
  const [hover, setHover] = useState(false);
  const expr = field.expr!;
  const multi = expr.lines.length > 1;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onCopy(expr.raw)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCopy(expr.raw); } }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Click to copy"
      style={{
        position: 'relative',
        border: `1px solid ${copied ? '#2f9e5e' : hover ? '#2d7ff9' : '#d0d5db'}`,
        boxShadow: hover && !copied ? '0 0 0 3px rgba(45,127,249,.1)' : undefined,
        borderRadius: 3,
        background: copied ? '#f2fbf5' : '#fff',
        padding: multi ? 9 : '7px 9px',
        minHeight: 33,
        display: 'flex',
        flexDirection: multi ? 'column' : 'row',
        alignItems: multi ? 'flex-start' : 'center',
        flexWrap: multi ? 'nowrap' : 'wrap',
        gap: multi ? 3 : 4,
        cursor: 'pointer',
        transition: 'border-color .15s, box-shadow .15s, background .15s',
      }}
    >
      {expr.lines.map((line, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          {line.map((tk, j) => <Pill key={j} token={tk} />)}
        </span>
      ))}
      <span
        style={{
          position: 'absolute', right: 7,
          top: multi ? 9 : '50%', transform: multi ? undefined : 'translateY(-50%)',
          fontSize: 9.5, fontWeight: 700, letterSpacing: '.03em',
          padding: copied ? '2px 7px' : 0, borderRadius: 999,
          background: copied ? '#2f9e5e' : 'transparent',
          color: copied ? '#fff' : '#9aa1a9',
          textTransform: copied ? 'none' : 'uppercase',
          opacity: copied ? 1 : hover ? 1 : 0,
          transition: 'opacity .18s',
          pointerEvents: 'none',
        }}
      >
        {copied ? '✓ copied' : 'copy'}
      </span>
    </div>
  );
}

function Switch() {
  return (
    <span style={{ width: 26, height: 14, borderRadius: 999, background: '#d4d9df', position: 'relative', flexShrink: 0, display: 'inline-block' }}>
      <span style={{ position: 'absolute', top: 2, left: 2, width: 10, height: 10, borderRadius: 999, background: '#fff' }} />
    </span>
  );
}

function Field({ field, copied, onCopy }: { field: MakeField; copied: boolean; onCopy: (raw: string) => void }) {
  if (field.group) {
    return (
      <div style={{ fontSize: 13, color: '#2b3137', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <span style={{ color: '#7b838c', fontSize: 9 }}>∨</span>{field.label}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2b3137' }}>
        <span style={{ color: '#7b838c', fontSize: 9, width: 10 }}>∨</span>
        {field.label}
        {field.required && <span style={{ color: '#e0384c', fontWeight: 700 }}>*</span>}
        {field.select?.map && (
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#868d96' }}>
            Map<Switch />
          </span>
        )}
      </span>

      {field.select && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div
            style={{
              flex: 1, minWidth: 0, border: `1px solid ${field.select.emphasis ? '#b4295c' : '#d0d5db'}`,
              borderRadius: 3, background: '#fff', padding: '7px 10px', fontSize: 13, color: '#2b3137',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: field.select.emphasis ? 600 : 400 }}>
              {field.select.value}
            </span>
            <span style={{ color: '#7b838c', fontSize: 9, flexShrink: 0 }}>∨</span>
          </div>
          {field.select.add && (
            <span style={{ border: '1px solid #d0d5db', borderRadius: 3, background: '#fff', fontSize: 13, padding: '7px 14px', color: '#2b3137' }}>
              Add
            </span>
          )}
          {field.select.refresh && (
            <span style={{ fontSize: 11.5, color: '#2d7ff9', display: 'flex', alignItems: 'center', gap: 4 }}>
              <ArrowsClockwise size={11} /> Refresh
            </span>
          )}
        </div>
      )}

      {field.expr && <ExprBox field={field} copied={copied} onCopy={onCopy} />}

      {field.unmapped && (
        <div style={{
          border: '1px dashed #d0d5db', borderRadius: 3, background: '#f7f8f9', padding: '7px 9px',
          minHeight: 33, display: 'flex', alignItems: 'center', fontSize: 12.5, color: '#9aa1a9',
        }}>
          {field.unmapped}
        </div>
      )}

      {field.help && (
        <div style={{ fontSize: 11.5, color: field.warn ? '#b4295c' : '#868d96', lineHeight: 1.45, fontWeight: field.warn ? 600 : 400 }}>
          {field.help}
        </div>
      )}
    </div>
  );
}

/** Make's Save button is per-app: Airtable's is the Make purple, HTTP's is Make's HTTP blue. */
const SAVE_COLOR: Record<MakeModule['app'], string> = { airtable: '#6b4ee6', http: '#1f6feb' };

function Panel({
  module: mod, copiedKeys, onCopy,
}: {
  module: MakeModule;
  copiedKeys: Set<string>;
  onCopy: (key: string, raw: string) => void;
}) {
  // Fields after a `group` header render indented, exactly as Make nests "Record".
  let inGroup = false;
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', minWidth: 0, flex: 1 }}>
      {/* canvas module badge */}
      <div style={{ flexShrink: 0, width: 74, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: 74, height: 74, borderRadius: 999, background: '#eef0f3', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ width: 54, height: 54, borderRadius: 999, background: mod.accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21 }}>
            {mod.app === 'airtable' ? '▦' : '⇄'}
          </div>
          <span style={{
            position: 'absolute', right: -1, top: 7, background: '#fff', border: '1px solid #d6dae0', color: '#4a5159',
            fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 17, height: 17,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>
            {mod.number}
          </span>
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 5, textAlign: 'center', whiteSpace: 'nowrap' }}>
            <b style={{ display: 'block', fontSize: 11, color: '#2b3137', fontWeight: 600 }}>{mod.title}</b>
            <span style={{ display: 'block', fontSize: 9.5, color: '#868d96' }}>{mod.subtitle}</span>
          </div>
        </div>
      </div>

      {/* the panel */}
      <div style={{
        flex: 1, minWidth: 0, background: '#fff', border: '1px solid #dfe3e8', borderRadius: 5,
        boxShadow: '0 10px 34px -16px rgba(16,24,40,.3)', display: 'flex', flexDirection: 'column',
        color: '#2b3137', maxHeight: 530,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px 10px', flexShrink: 0 }}>
          <h4 style={{ fontSize: 16, fontWeight: 600, color: '#1e242b', margin: 0 }}>{mod.title}</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, color: '#7b838c', fontSize: 14 }}>
            <span>⋮</span><span>⤢</span><span>?</span><span>✕</span>
          </div>
        </div>
        <div style={{ height: 2, margin: '0 15px', borderRadius: 2, background: mod.accent, flexShrink: 0 }} />

        <div className="make-scroll" style={{ overflowY: 'auto', padding: '14px 15px 16px', display: 'flex', flexDirection: 'column', gap: 13, flex: 1 }}>
          {mod.fields.map((f, i) => {
            if (f.group) { inGroup = true; return <Field key={i} field={f} copied={false} onCopy={() => {}} />; }
            const key = `${mod.app}:${f.label}`;
            const node = (
              <Field
                key={key}
                field={f}
                copied={copiedKeys.has(key)}
                onCopy={(raw) => onCopy(key, raw)}
              />
            );
            return inGroup ? <div key={key} style={{ paddingLeft: 15 }}>{node}</div> : node;
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', borderTop: '1px solid #e6e9ed', flexShrink: 0, background: '#fff', borderRadius: '0 0 5px 5px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5b636b', marginRight: 'auto' }}>
            <Switch />Show advanced settings
          </span>
          <span style={{ border: '1px solid #d0d5db', background: '#fff', borderRadius: 3, padding: '7px 17px', fontSize: 13, color: '#2b3137' }}>Cancel</span>
          <span style={{ borderRadius: 3, padding: '7px 17px', fontSize: 13, color: '#fff', background: SAVE_COLOR[mod.app] }}>Save</span>
        </div>
      </div>
    </div>
  );
}

/** The dot trail joining the two modules: Airtable blue → Twilio red. */
function DotTrail() {
  const colors = ['#2d7ff9', '#5a6fc4', '#874fa0', '#b43f73', '#f22f46'];
  return (
    <div className="make-trail" aria-hidden>
      {colors.map((c, i) => (
        <i key={i} style={{ background: c, animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

export default function MakeModulePair({ ctx, site }: { ctx: ClientContext; site: SiteInfo }) {
  const [copied, setCopied] = useState<Set<string>>(new Set());
  const modules = makeModulesForSite(ctx, site);

  const onCopy = useCallback((key: string, raw: string) => {
    void navigator.clipboard?.writeText(raw).catch(() => {});
    setCopied((prev) => new Set(prev).add(key));
  }, []);

  const total = modules.reduce((n, m) => n + m.fields.filter((f) => f.expr).length, 0);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="meta">
          Click any field to copy its expression — {copied.size} of {total} copied
        </span>
        {copied.size > 0 && (
          <button type="button" className="btn btn-xs" onClick={() => setCopied(new Set())}>
            Reset
          </button>
        )}
      </div>
      <div className="make-pair">
        <Panel module={modules[0]} copiedKeys={copied} onCopy={onCopy} />
        <DotTrail />
        <Panel module={modules[1]} copiedKeys={copied} onCopy={onCopy} />
      </div>
      {copied.size >= total && total > 0 && (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ok)' }}>
          <Check size={14} weight="bold" /> Every field copied — save both modules, then confirm the scenario is Active.
        </div>
      )}
    </div>
  );
}
