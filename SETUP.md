# Wavenly — Cloudflare Pages handoff

This is a static marketing site with two Cloudflare Pages Functions. It has no
database and no build step.

## How inquiries work

```text
Website form → POST /api/inquiry → Resend → Wavenly inbox
                                          ↓
                              signed reply link in the email
                                          ↓
                         /studio → POST /api/reply → client
                                          ↓
                               BCC copy → Wavenly inbox
```

The original inquiry is stored only in the inbox email. The reply link carries
an HMAC-signed payload, so `/api/reply` can send only to an address issued by
`/api/inquiry`; it never trusts a recipient supplied by the browser.

## Project structure

| Path | Purpose |
|---|---|
| `index.html`, `styles.css`, `script.js` | Public marketing site |
| `studio.html` | Private reply composer linked from inquiry emails |
| `functions/api/inquiry.js` | Sends a new inquiry to the Wavenly inbox |
| `functions/api/reply.js` | Sends a passcode-protected reply to the signed recipient |
| `functions/_lib/sign.js` | Web Crypto HMAC payload signing and verification |
| `functions/_lib/email.js` | Resend REST transport and email templates |
| `_headers`, `_redirects`, `robots.txt` | Cloudflare Pages routing, headers, and crawler policy |

## Production setup

1. Sign in to Cloudflare with an account that can create Pages projects:

   ```bash
   npx wrangler login
   npx wrangler whoami
   ```

2. Create a Pages project if it does not exist. Replace `wavenly` if you want a
   different project slug:

   ```bash
   npx wrangler pages project create wavenly --production-branch main
   ```

3. In **Cloudflare Dashboard → Workers & Pages → wavenly → Settings → Variables
   and Secrets**, add the following for the **Production** environment. Mark the
   sensitive values as encrypted secrets.

   | Name | Secret? | Value |
   |---|---:|---|
   | `RESEND_API_KEY` | Yes | API key from Resend |
   | `RESEND_FROM` | No | A sender on a Resend-verified domain, for example `Wavenly <hello@yourdomain.com>` |
   | `WAVENLY_INBOX` | No | The inbox that receives inquiries |
   | `SITE_URL` | No | Canonical public origin, for example `https://wavenly.com` |
   | `SIGNING_SECRET` | Yes | Generate with `openssl rand -hex 32` |
   | `STUDIO_PASSCODE` | Yes | A long private passcode for the reply composer |

   Add the same values to Preview only if preview deployments should process
   real email. Otherwise, omit `RESEND_API_KEY` from Preview so it fails safely.

4. Deploy the current directory:

   ```bash
   npx wrangler pages deploy . --project-name wavenly --branch main
   ```

5. Attach the custom domain in the Pages dashboard, update `SITE_URL` to that
   exact HTTPS origin, then redeploy. This is required because reply links are
   generated from `SITE_URL`.

## Local development

Use a local secrets file; it is ignored by Git:

```bash
cp .env.example .dev.vars
npx wrangler pages dev . --compatibility-date=2024-11-01
```

Wrangler serves the static site and Pages Functions together, normally at
`http://localhost:8788`. A plain static server will not run `/api` endpoints.

## Operational notes

- **Reply from the inbox:** inquiry emails set `reply-to` to the client, so
  normal Gmail reply works without opening the composer.
- **Reply composer:** the link opens `/studio`. The browser remembers the
  passcode locally, but the function verifies it on every send.
- **Archive:** label the Wavenly inbox’s inquiry emails; that inbox is the
  system of record. Resend provides the delivery log.
- **Secret rotation:** changing `SIGNING_SECRET` invalidates all existing reply
  links. Existing Gmail replies still work.
- **Spam:** the form uses a honeypot and a minimum completion time. If spam
  becomes material, add Cloudflare Turnstile before the form is put under a
  rate-limited data store.

Cloudflare Pages Functions receive production bindings from `context.env`; do
not add `process.env` reads to files under `functions/`.
