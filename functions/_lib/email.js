/* =========================================================================
   Resend transport + the two email templates.

   Cloudflare Workers have no `process.env` — bindings arrive per request on
   `context.env`. So nothing here reads config at module scope; `settings(env)`
   is called inside each handler and the result passed down.

   Calls the REST API with plain fetch rather than the Resend SDK, which pulls
   in Node-only dependencies and will not run on workerd. Same approach as the
   Nocta mailer.
   ========================================================================= */

export const settings = (env = {}) => ({
  /* Must be a sender on a domain verified in Resend. The fallback only
     delivers to the Resend account owner, so set RESEND_FROM in production. */
  from: env.RESEND_FROM || 'Wavenly <onboarding@resend.dev>',
  inbox: env.WAVENLY_INBOX || 'hello.wavenly@gmail.com',
  site: (env.SITE_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'https://wavenly.pages.dev')).replace(/\/$/, ''),
});

export const send = async (env, { to, subject, html, replyTo, bcc }) => {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set' };

  const { from } = settings(env);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(bcc ? { bcc: Array.isArray(bcc) ? bcc : [bcc] } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `Resend ${res.status}`, detail: detail.slice(0, 400) };
  }
  return { ok: true, id: (await res.json().catch(() => ({}))).id };
};

/* ── Templates ─────────────────────────────────────────────────────────────
   Inline styles and tables only: Gmail strips <style> blocks, Outlook ignores
   most modern layout. Light ground rather than the site's ink, because dark
   backgrounds render inconsistently across clients. */

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = '#0F1311';
const MUTED = '#5A625E';
const LINE = '#D6D2C8';
const BLUE = '#0040C0';

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const nl2br = (s) => esc(s).replace(/\r?\n/g, '<br>');

/* `label` is escaped here, so callers pass it raw. `value` is inserted as
   HTML, so callers must escape it themselves. */
const row = (label, value) => `
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid ${LINE};vertical-align:top;width:170px;
               font:500 11px ${FONT};letter-spacing:.14em;text-transform:uppercase;color:${MUTED};">
      ${esc(label)}
    </td>
    <td style="padding:14px 0;border-bottom:1px solid ${LINE};vertical-align:top;
               font:400 15px/1.55 ${FONT};color:${INK};">
      ${value}
    </td>
  </tr>`;

const shell = (inner, site) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#EDEAE3;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EDEAE3;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#FFFFFF;border:1px solid ${LINE};">
        <tr><td style="padding:32px 32px 28px;">${inner}</td></tr>
      </table>
      <p style="max-width:600px;margin:18px auto 0;font:400 12px/1.5 ${FONT};color:${MUTED};text-align:left;">
        Sent by the Wavenly website — ${esc(site)}
      </p>
    </td></tr>
  </table>
</body></html>`;

/* What lands in the Wavenly inbox. This email is the record: it carries every
   field, and the button opens the stateless reply composer. */
export const inquiryEmail = ({ name, email, trade, details, replyUrl, meta, site }) => shell(`
  <p style="margin:0 0 6px;font:500 11px ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${MUTED};">
    New inquiry
  </p>
  <h1 style="margin:0 0 24px;font:600 26px/1.15 ${FONT};letter-spacing:-.02em;color:${INK};">
    ${esc(name)}
  </h1>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};">
    ${row('Name', esc(name))}
    ${row('Email', `<a href="mailto:${esc(email)}" style="color:${BLUE};text-decoration:none;">${esc(email)}</a>`)}
    ${row('Trade', esc(trade || 'Not given'))}
    ${row('Business & site', nl2br(details))}
    ${row('Received', esc(meta))}
  </table>

  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 0;">
    <tr><td style="background:${BLUE};">
      <a href="${esc(replyUrl)}"
         style="display:inline-block;padding:15px 24px;font:600 14px ${FONT};color:#FFFFFF;text-decoration:none;">
        Reply to this inquiry &rarr;
      </a>
    </td></tr>
  </table>

  <p style="margin:18px 0 0;font:400 13px/1.6 ${FONT};color:${MUTED};">
    Or just hit Reply — this email's reply-to is set to ${esc(email)}.
  </p>
`, site);

/* What the client receives when you reply from the composer. */
export const replyEmail = ({ name, body, fromName, site }) => shell(`
  <p style="margin:0 0 6px;font:500 11px ${FONT};letter-spacing:.16em;text-transform:uppercase;color:${MUTED};">
    Wavenly
  </p>
  <h1 style="margin:0 0 22px;font:600 22px/1.2 ${FONT};letter-spacing:-.02em;color:${INK};">
    Hi ${esc(name)},
  </h1>
  <div style="font:400 15px/1.65 ${FONT};color:${INK};">${nl2br(body)}</div>
  <p style="margin:28px 0 0;padding-top:20px;border-top:1px solid ${LINE};
            font:400 14px/1.6 ${FONT};color:${MUTED};">
    ${esc(fromName)}<br>Wavenly — websites for service businesses
  </p>
`, site);
