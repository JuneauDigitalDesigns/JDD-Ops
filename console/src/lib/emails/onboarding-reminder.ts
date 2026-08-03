/** JDD-branded HTML email sent when a client hasn't completed their onboarding wizard. */

export interface OnboardingReminderParams {
  signerName: string;
  signerEmail: string;
  sessionId: string;
  brandName: string;
  plan: string;
  siteUrl?: string;
}

const BRAND_COLOR = '#1a56db';
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export function buildOnboardingReminderEmail(p: OnboardingReminderParams): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = p.signerName.split(' ')[0] || p.signerName;
  const portalBase = p.siteUrl || 'https://juneaudigitaldesigns.com';
  const ctaUrl = `${portalBase}/portal/sign-in`;
  const planLabel = p.plan.charAt(0).toUpperCase() + p.plan.slice(1);

  const subject = `Don't forget — complete your website setup, ${firstName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:${FONT_STACK};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:17px;font-weight:700;color:#111;letter-spacing:-0.4px;">
                Juneau Digital Designs
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:36px 32px;border:1px solid #e5e7eb;">

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                Hi ${escHtml(firstName)},
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                You're almost there! You signed up for the <strong>${escHtml(planLabel)}</strong> plan
                ${p.brandName ? `for <strong>${escHtml(p.brandName)}</strong> ` : ''}but haven't
                finished the onboarding wizard yet. It only takes a few minutes and gives us everything
                we need to start building your site.
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
                Click below to sign in to your portal and pick up where you left off:
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:8px;background:${BRAND_COLOR};">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;
                              color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:-0.2px;">
                      Complete my onboarding →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.6;">
                If you have any questions before getting started, just reply to this email.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 0 0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                Juneau Digital Designs &middot; Baton Rouge, LA
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${firstName},

You haven't completed your onboarding wizard yet for your ${planLabel} plan${p.brandName ? ` (${p.brandName})` : ''}.

Sign in to your portal to finish up: ${ctaUrl}

It only takes a few minutes. Reply to this email with any questions.

— Juneau Digital Designs`;

  return { subject, html, text };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
