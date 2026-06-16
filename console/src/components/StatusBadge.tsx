import type { ClientStatus } from '@/lib/types';

const MAP: Record<ClientStatus, { label: string; cls: string }> = {
  'needs-build': { label: 'Needs build', cls: 'badge-warn' },
  ready: { label: 'Ready to provision', cls: 'badge-accent' },
  provisioned: { label: 'Wire callback', cls: 'badge-accent' },
  'portal-pending': { label: 'Portal + checkpoints', cls: 'badge-ok' },
  live: { label: 'Live', cls: 'badge-ok' },
  unknown: { label: 'Unknown', cls: '' },
};

export default function StatusBadge({ status }: { status: ClientStatus }) {
  const { label, cls } = MAP[status] ?? MAP.unknown;
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {label}
    </span>
  );
}
