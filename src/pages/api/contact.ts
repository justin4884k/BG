import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const prerender = false; // this route is a serverless function

const resend = new Resend(import.meta.env.RESEND_API_KEY);

// Destination inbox — set via env var, falls back to a placeholder
const TO_EMAIL   = import.meta.env.CONTACT_TO_EMAIL   ?? 'info@brazengrace.org';
const FROM_EMAIL = import.meta.env.CONTACT_FROM_EMAIL ?? 'contact@brazengrace.org';

export const POST: APIRoute = async ({ request }) => {
  // ── Parse body ────────────────────────────────────────────────
  let body: Record<string, string>;
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    body = await request.json();
  } else {
    const fd = await request.formData();
    body = Object.fromEntries(
      [...fd.entries()].map(([k, v]) => [k, String(v)])
    );
  }

  const { first_name, last_name, email, phone, subject, message } = body;

  // ── Validate required fields ──────────────────────────────────
  if (!first_name?.trim() || !email?.trim() || !message?.trim()) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Please fill in all required fields.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Please enter a valid email address.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const fullName = [first_name, last_name].filter(Boolean).join(' ');
  const subjectLabel = subject ? subjectMap[subject] ?? subject : 'General enquiry';

  // ── Send notification email to church ────────────────────────
  const { error: sendError } = await resend.emails.send({
    from: `Rest Church Contact Form <${FROM_EMAIL}>`,
    to:   [TO_EMAIL],
    replyTo: `${fullName} <${email}>`,
    subject: `[Rest Church] ${subjectLabel} — ${fullName}`,
    html: notificationHtml({ fullName, email, phone, subjectLabel, message }),
    text: notificationText({ fullName, email, phone, subjectLabel, message }),
  });

  if (sendError) {
    console.error('Resend error:', sendError);
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to send message. Please try again or call us directly.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Send auto-reply to the visitor ───────────────────────────
  await resend.emails.send({
    from: `Rest Church <${FROM_EMAIL}>`,
    to:   [email],
    subject: 'We received your message — Rest Church',
    html: autoReplyHtml({ firstName: first_name }),
    text: autoReplyText({ firstName: first_name }),
  });

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

// ── Helpers ───────────────────────────────────────────────────────

const subjectMap: Record<string, string> = {
  connect:    'Connect with the church',
  prayer:     'Prayer request',
  jesus:      'Learn more about Jesus',
  ministries: 'Join a ministry',
  give:       'Question about giving',
  general:    'General question',
};

function notificationHtml(d: {
  fullName: string; email: string; phone?: string;
  subjectLabel: string; message: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1B2B4B;padding:28px 32px;">
            <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#C9973A;">Rest Church</p>
            <h1 style="margin:6px 0 0;font-size:20px;color:#ffffff;font-weight:600;">New Contact Form Submission</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${row('Name',    d.fullName)}
              ${row('Email',   `<a href="mailto:${d.email}" style="color:#1B2B4B;">${d.email}</a>`)}
              ${d.phone ? row('Phone', d.phone) : ''}
              ${row('Subject', d.subjectLabel)}
            </table>

            <div style="margin-top:24px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#6B7280;">Message</p>
              <div style="background:#f9fafb;border-left:3px solid #C9973A;border-radius:0 8px 8px 0;padding:16px 20px;font-size:15px;color:#374151;line-height:1.7;white-space:pre-wrap;">${escHtml(d.message)}</div>
            </div>

            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
              <a href="mailto:${d.email}?subject=Re: Your message to Rest Church"
                 style="display:inline-block;background:#C9973A;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:50px;font-size:14px;font-weight:600;">
                Reply to ${d.fullName.split(' ')[0]}
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              This message was sent via the contact form at brazengrace.org
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function notificationText(d: {
  fullName: string; email: string; phone?: string;
  subjectLabel: string; message: string;
}) {
  return [
    'New contact form submission — Rest Church',
    '═'.repeat(46),
    `Name:    ${d.fullName}`,
    `Email:   ${d.email}`,
    d.phone ? `Phone:   ${d.phone}` : '',
    `Subject: ${d.subjectLabel}`,
    '',
    'Message:',
    d.message,
    '',
    '─'.repeat(46),
    'Sent via brazengrace.org contact form',
  ].filter(l => l !== null).join('\n');
}

function autoReplyHtml({ firstName }: { firstName: string }) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <tr>
          <td style="background:#1B2B4B;padding:28px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#C9973A;">Rest Church</p>
            <h1 style="margin:0;font-size:22px;color:#ffffff;font-weight:600;">We got your message!</h1>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <p style="margin:0 0 16px;font-size:16px;color:#374151;line-height:1.7;">
              Hi ${escHtml(firstName)},
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#6B7280;line-height:1.75;">
              Thanks for reaching out to Rest Church! We've received your message
              and someone from our team will get back to you soon.
            </p>
            <p style="margin:0 0 32px;font-size:15px;color:#6B7280;line-height:1.75;">
              In the meantime, join us this <strong style="color:#1B2B4B;">Sunday at 10 AM</strong> —
              in person at 19314 US-281 N, Suite 101, San Antonio TX, or livestream on YouTube.
            </p>
            <a href="https://brazengrace.org"
               style="display:inline-block;background:#C9973A;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:50px;font-size:15px;font-weight:600;">
              Visit Our Website
            </a>
          </td>
        </tr>

        <tr>
          <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#6B7280;">Questions? Call us: <a href="tel:+12106502087" style="color:#1B2B4B;font-weight:600;">+1 (210) 650-2087</a></p>
            <p style="margin:0;font-size:12px;color:#9ca3af;">19314 US-281 N, Suite 101 · San Antonio, TX 78256</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function autoReplyText({ firstName }: { firstName: string }) {
  return `Hi ${firstName},

Thanks for reaching out to Rest Church! We've received your message and someone from our team will get back to you soon.

Join us this Sunday at 10 AM — in person at 19314 US-281 N, Suite 101, San Antonio TX, or livestream on YouTube.

Questions? Call us: +1 (210) 650-2087

Rest Church
brazengrace.org`;
}

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;width:90px;vertical-align:top;">
      <span style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;">${label}</span>
    </td>
    <td style="padding:8px 0 8px 16px;border-bottom:1px solid #f3f4f6;font-size:14px;color:#1f2937;">${value}</td>
  </tr>`;
}

function escHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
