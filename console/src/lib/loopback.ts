/**
 * Is this request addressed to the console on this machine?
 *
 * The console has no auth of any kind; it is safe only because it listens on localhost. Routes
 * that can move money or create accounts (through the agency's ops endpoints) check the Host
 * header too — an assumption isn't a control. Same rule as `stripe-lookup` and
 * `manage/plan/billing`, which carry their own copies of this.
 */
export function isLoopback(req: Request): boolean {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const hostname = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1' ||
    hostname.endsWith('.localhost')
  );
}
