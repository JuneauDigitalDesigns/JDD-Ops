'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CaretDown, Check } from '@phosphor-icons/react';
import { STATUS_ORDER, type ClientStatus } from '@/lib/types';

const LABEL: Record<ClientStatus, string> = {
  'needs-build': 'Needs build',
  ready: 'Ready to provision',
  provisioned: 'Wire callback',
  'portal-pending': 'Portal + checkpoints',
  live: 'Live',
  unknown: 'Unknown',
};

const DOT: Record<ClientStatus, string> = {
  'needs-build': 'var(--warn)',
  ready: 'var(--accent)',
  provisioned: 'var(--accent)',
  'portal-pending': 'var(--ok)',
  live: 'var(--ok)',
  unknown: 'var(--fg-3)',
};

export default function StatusControl({
  value,
  detected,
  onChange,
}: {
  value: ClientStatus;
  detected: ClientStatus;
  onChange: (s: ClientStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="badge"
        style={{ background: 'var(--surface)', cursor: 'pointer' }}
        title="Set client status"
      >
        <span className="dot" style={{ color: DOT[value] }} />
        {LABEL[value]}
        <CaretDown size={11} style={{ marginLeft: 2, color: 'var(--fg-3)' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="panel absolute right-0 z-50 mt-1.5 w-[214px] overflow-hidden p-1"
          >
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(s);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="dot" style={{ color: DOT[s], width: 6, height: 6, borderRadius: 999, background: 'currentColor' }} />
                <span className="flex-1" style={{ color: s === value ? 'var(--fg)' : 'var(--fg-2)' }}>
                  {LABEL[s]}
                </span>
                {s === detected && <span className="kicker" style={{ fontSize: 9 }}>detected</span>}
                {s === value && <Check size={13} weight="bold" style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
