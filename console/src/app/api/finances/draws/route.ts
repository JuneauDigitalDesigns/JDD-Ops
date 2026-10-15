import { ledgerHandlers } from '@/lib/financeLedgerRoutes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST, PATCH, DELETE } = ledgerHandlers('draw');
