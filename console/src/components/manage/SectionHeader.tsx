export { default } from '@/components/shell/PageHeader';

/**
 * `SectionHeader` is now an alias for the console-wide <PageHeader>.
 *
 * It was /manage's own header until the root index and the board screens needed the same
 * block — their titles used to sit in the navbar, which is wayfinding only now. Rather than
 * a third copy, the implementation moved to shell/ and this name stayed so the six /manage
 * sections read naturally.
 */
