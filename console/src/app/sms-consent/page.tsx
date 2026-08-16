import SmsConsentView from '@/components/SmsConsentView';

/**
 * Consent proof, on its own route.
 *
 * Not a section of /manage: consent belongs to an owner and a mobile number, not to a
 * site. One client with three enterprise sites has one consent record, and the question
 * this screen answers ("who agreed to be texted at this number?") arrives with a phone
 * number attached, not a slug.
 */
export const dynamic = 'force-dynamic';

export default function SmsConsentPage() {
  return <SmsConsentView />;
}
