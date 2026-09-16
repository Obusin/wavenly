/* =========================================================================
   POST /api/reply              Cloudflare Pages Function

   Sends your reply to the client. Two things have to hold:

     1. the signed payload must be one we issued and still in date, which is
        what pins the recipient — the address is never taken from the request
     2. the passcode must match, so a leaked link alone is not enough to send
        mail as Wavenly

   The reply is BCC'd to the inbox so the exchange stays in one place.
   ========================================================================= */

import { openSigned } from '../_lib/sign.js';
import { send, settings, replyEmail } from '../_lib/email.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

/* Constant-time compare so the passcode cannot be guessed a character at a
   time from response timing. */
const sameSecret = (a, b) => {
  const x = String(a ?? '');
  const y = String(b ?? '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
};

export async function onRequestPost({ request, env }) {
  const secret = env.SIGNING_SECRET;
  const passcode = env.STUDIO_PASSCODE;
  if (!secret || !passcode) return json({ ok: false, error: 'Server is not configured' }, 500);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Expected JSON' }, 400);
  }

  if (!sameSecret(body.passcode, passcode)) {
    return json({ ok: false, error: 'Wrong passcode' }, 401);
  }

  const payload = await openSigned(clean(body.d, 8000), clean(body.s, 400), secret);
  if (!payload) return json({ ok: false, error: 'This reply link is invalid or has expired' }, 400);

  const subject = clean(body.subject, 200) || 'About your free website review';
  const message = clean(body.body, 8000);
  const fromName = clean(body.fromName, 80) || 'Mark — Wavenly';
  if (message.length < 10) return json({ ok: false, error: 'Write a little more first' }, 422);

  const { inbox, site } = settings(env);

  const result = await send(env, {
    to: payload.e,                     // the signed address, never the request's
    bcc: inbox,                        // keeps the thread in the inbox that holds the record
    replyTo: inbox,
    subject,
    html: replyEmail({ name: payload.n, body: message, fromName, site }),
  });

  if (!result.ok) {
    console.error('reply send failed', result);
    return json({ ok: false, error: 'Could not send right now' }, 502);
  }

  return json({ ok: true, to: payload.e });
}
