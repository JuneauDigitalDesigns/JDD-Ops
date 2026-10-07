/**
 * Client-facing notification when the operator updates a support ticket from the console:
 * either a new reply on the thread or a status change. One branded email with a single link
 * back to the portal Support thread, so the client is pulled back in-product.
 *
 * The send lives here (not in the portal) because the operator write happens in the console;
 * the portal has no operator-write path. Recipient is the ticket's own accountEmail, never the
 * operator address. Mirrors the client-directed welcome email, not the operator notifications.
 *
 * Never throws: the status change / reply has already been persisted by the time this runs, so
 * a mail failure must not turn a completed operation into an error.
 *
 * No em-dashes anywhere in the copy.
 */
import { getResend } from '../resend';
import { TICKET_STATUSES, type Ticket, type TicketStatus } from '@jdd/schema';

const BRAND_COLOR = '#1a56db';
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  waiting_on_client: 'Waiting on you',
  resolved: 'Resolved',
  closed: 'Closed',
};

export type TicketUpdateKind = 'reply' | 'status';

function portalLink(ticket: Ticket): string {
  const params = new URLSearchParams({ site: ticket.siteSlug, open: ticket.id });
  return `https://juneaudigitaldesigns.com/portal/support?${params.toString()}`;
}

export function buildTicketUpdateEmail(ticket: Ticket, kind: TicketUpdateKind): {
  subject: string;
  html: string;
  text: string;
} {
  const link = portalLink(ticket);
  const statusLabel = STATUS_LABEL[ticket.status] ?? ticket.status;
  // The latest operator message, when this is a reply notification.
  const lastOperatorMsg = [...ticket.messages].reverse().find((m) => m.author === 'operator');
  const preview = kind === 'reply' ? (lastOperatorMsg?.text ?? '').trim() : '';

  const subject =
    kind === 'reply'
      ? `New reply on your ticket: ${ticket.subject}`
      : `Ticket ${statusLabel.toLowerCase()}: ${ticket.subject}`;

  const lead =
    kind === 'reply'
      ? 'Juneau Digital Designs replied to your support ticket.'
      : `Your support ticket is now marked ${statusLabel}.`;

  const previewBlock = preview
    ? `
              <div style="background:#f9fafb;border-left:3px solid ${BRAND_COLOR};border-radius:8px;padding:14px 16px;margin:0 0 24px;">
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${escHtml(preview)}</p>
              </div>`
    : '';

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

          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:17px;font-weight:700;color:#111;letter-spacing:-0.4px;">
                Juneau Digital Designs
              </span>
            </td>
          </tr>

          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:36px 32px;border:1px solid #e5e7eb;">

              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
                ${escHtml(lead)}
              </p>

              <p style="margin:0 0 20px;font-size:15px;color:#111;line-height:1.6;font-weight:600;">
                ${escHtml(ticket.subject)}
              </p>
${previewBlock}
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:8px;background:${BRAND_COLOR};">
                    <a href="${link}"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;
                              color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:-0.2px;">
                      View ticket
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                You can reply from the portal, or just reply to this email.
              </p>

            </td>
          </tr>

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

  const text = `${lead}

Ticket: ${ticket.subject}
${preview ? `\n${preview}\n` : ''}
View ticket: ${link}

You can reply from the portal, or just reply to this email.

Juneau Digital Designs`;

  return { subject, html, text };
}

/**
 * Build and send the notification, swallowing every error. Returns true only when Resend
 * accepted the message. The recipient is deliberately kept out of any log line.
 */
export async function notifyClientOfTicketUpdate(
  ticket: Ticket,
  kind: TicketUpdateKind,
): Promise<boolean> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[ticket-update] RESEND_API_KEY not set — skipping client email');
      return false;
    }
    const to = ticket.accountEmail?.trim();
    if (!to) return false;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || 'Juneau Digital Designs <hello@juneaudigitaldesigns.com>';
    const { subject, html, text } = buildTicketUpdateEmail(ticket, kind);
    const result = await getResend().emails.send({ from: fromEmail, to, subject, html, text });
    if (result.error) {
      console.error('[ticket-update] Resend error', result.error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[ticket-update] send threw', e);
    return false;
  }
}

/** Exposed for callers that want to show the human status label (kept in one place). */
export function ticketStatusLabel(status: TicketStatus): string {
  return STATUS_LABEL[status] ?? status;
}

// Referenced so a future status addition to TICKET_STATUSES surfaces here as a type error
// if STATUS_LABEL is not kept complete.
const _STATUS_COVERAGE: Record<(typeof TICKET_STATUSES)[number], string> = STATUS_LABEL;
void _STATUS_COVERAGE;

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
