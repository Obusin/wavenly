/* =========================================================================
   POST /api/inquiry            Cloudflare Pages Function

   Takes a website form submission and emails it to the Wavenly inbox. That
   email is the only record — nothing is written anywhere.

   Pages routes by filename, and exporting `onRequestPost` alone means any
   other method gets a 405 from the platform.
   ========================================================================= */

import { encodePayload, sign } from '../_lib/sign.js';
import { send, settings, inquiryEmail } from '../_lib/email.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost({ request, env }) {
  const secret = env.SIGNING_SECRET;
  if (!secret) return json({ ok: false, error: 'Server is not configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Expected JSON' }, 400);
  }

  /* Spam gates. Without storage there is no real rate limiting here, so these
     stop cheap bots only; Cloudflare's own protections cover volume. */
  if (clean(body.company, 200)) return json({ ok: true });          // honeypot: pretend it worked
  if (Number(body.elapsed) < 2000) return json({ ok: true });        // filled faster than a human reads

  const name = clean(body.name, 120);
  const email = clean(body.email, 200);
  const trade = clean(body.trade, 80);
  const details = clean(body.details, 4000);

  const errors = {};
  if (name.length < 2) errors.name = 'Please tell us your name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
  if (details.length < 3) errors.details = 'Please add your business name.';
  if (Object.keys(errors).length) return json({ ok: false, errors }, 422);

  const { inbox, site } = settings(env);

  /* The reply link carries the client's details, signed, so the composer needs
     no lookup and the reply endpoint can only ever send to this address. */
  const payload = encodePayload({ n: name, e: email, t: trade, d: details, at: Date.now() });
  const signature = await sign(payload, secret);
  const replyUrl = `${site}/studio?d=${payload}&s=${signature}`;

  const received = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Los_Angeles',
  }).format(new Date()) + ' PT';

  const result = await send(env, {
    to: inbox,
    replyTo: email,                               // so plain Reply in Gmail reaches the client
    subject: `New inquiry — ${name}${trade ? ` (${trade})` : ''}`,
    html: inquiryEmail({ name, email, trade, details, replyUrl, meta: received, site }),
  });

  if (!result.ok) {
    console.error('inquiry send failed', result);
    return json({ ok: false, error: 'Could not send right now' }, 502);
  }

  return json({ ok: true });
}
