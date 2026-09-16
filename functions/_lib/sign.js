/* =========================================================================
   Signed payloads.

   There is no database, so the inquiry details travel inside the reply link
   itself. Anyone holding a link could otherwise send mail as Wavenly to any
   address they liked, so the payload is HMAC-signed: the server will only ever
   send to the address inside a signature it produced.

   Web Crypto only — this runs on the Edge runtime, where Node's `crypto` and
   `Buffer` are unavailable.
   ========================================================================= */

const enc = new TextEncoder();
const dec = new TextDecoder();

const bytesToB64url = (bytes) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const b64urlToBytes = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export const encodePayload = (obj) => bytesToB64url(enc.encode(JSON.stringify(obj)));

export const decodePayload = (b64) => {
  try {
    return JSON.parse(dec.decode(b64urlToBytes(b64)));
  } catch {
    return null;
  }
};

const hmacKey = (secret) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export const sign = async (b64, secret) => {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(b64));
  return bytesToB64url(new Uint8Array(sig));
};

/* crypto.subtle.verify does the comparison in constant time, which a manual
   string === would not. */
export const verify = async (b64, signature, secret) => {
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret), b64urlToBytes(signature), enc.encode(b64));
  } catch {
    return false;
  }
};

export const MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;   // 60 days

/* Returns the payload only if the signature is ours and the link is not stale,
   so a link leaked out of an old inbox stops working. */
export const openSigned = async (b64, signature, secret) => {
  if (!b64 || !signature) return null;
  if (!(await verify(b64, signature, secret))) return null;
  const payload = decodePayload(b64);
  if (!payload || typeof payload.at !== 'number') return null;
  if (Date.now() - payload.at > MAX_AGE_MS) return null;
  return payload;
};
