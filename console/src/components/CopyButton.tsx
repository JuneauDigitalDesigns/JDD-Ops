'use client';
import { useState } from 'react';
import { Copy, Check } from '@phosphor-icons/react';

export default function CopyButton({
  value,
  label,
  disabled,
}: {
  value: string;
  label?: string;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      title={disabled ? 'Value not available yet' : 'Copy'}
      className="btn btn-sm shrink-0"
      style={copied ? { borderColor: 'var(--ok)', color: 'var(--ok)' } : undefined}
    >
      {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
      {label ?? (copied ? 'Copied' : 'Copy')}
    </button>
  );
}
