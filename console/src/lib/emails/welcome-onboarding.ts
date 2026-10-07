/**
 * JDD-branded welcome email for a client who has been converted from a lead but hasn't signed up
 * on the agency site yet. Its one job is to get them to the sign-up link, which is the gate in
 * front of onboarding.
 *
 * No em-dashes anywhere in the copy.
 */
import { welcomeSignupUrl } from '../welcomeLink';

export interface WelcomeEmailParams {
  /** Business name, for the greeting. */
  clientName: string;
  plan: 'starter' | 'growth' | 'enterprise';
}

const BRAND_COLOR = '#1a56db';
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export function buildWelcomeEmail(p: WelcomeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const ctaUrl = welcomeSignupUrl(p.plan);
  const planLabel = p.plan.charAt(0).toUpperCase() + p.plan.slice(1);
  const name = p.clientName.trim();

  const subject = `Welcome to Juneau Digital Designs${name ? `, ${name}` : ''}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(subject)}</title>
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
                Hi${name ? ` ${escHtml(name)}` : ''},
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                Welcome to Juneau Digital Designs. We are glad to be working with you, and we are ready
                to start on your website.
              </p>

              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.6;">
                The next step is to create your account and finish a short onboarding form for the
                <strong>${escHtml(planLabel)}</strong> plan. It takes about five minutes and gives us
                everything we need to build your site.
              </p>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:8px;background:${BRAND_COLOR};">
                    <a href="${ctaUrl}"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;
                              color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:-0.2px;">
                      Get started
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.6;">
                Once you finish, we take it from there. If you have any questions along the way, just
                reply to this email.
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

  const text = `Hi${name ? ` ${name}` : ''},

Welcome to Juneau Digital Designs. We are glad to be working with you, and we are ready to start on your website.

The next step is to create your account and finish a short onboarding form for the ${planLabel} plan. It takes about five minutes and gives us everything we need to build your site.

Get started: ${ctaUrl}

Once you finish, we take it from there. If you have any questions along the way, just reply to this email.

Juneau Digital Designs`;

  return { subject, html, text };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
