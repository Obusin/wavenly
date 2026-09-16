# Cloudflare Pages readiness report

**Status:** ready to deploy; not yet published.

## What was completed

- Migrated server logic to Cloudflare Pages Functions:
  - `POST /api/inquiry`
  - `POST /api/reply`
- Moved shared modules to `functions/_lib/`.
- Replaced Node/host-specific configuration access with Cloudflare’s request
  bindings (`context.env`).
- Added Pages deployment files: `_headers`, `_redirects`, `robots.txt`, and
  `package.json` scripts.
- Added a stateless inquiry/reply email system using Resend’s REST API and Web
  Crypto HMAC signatures.
- Updated the operational guide for Cloudflare Pages in [SETUP.md](SETUP.md).

## Verification completed

| Check | Result |
|---|---|
| HTML validation | Passed |
| Browser JavaScript syntax | Passed |
| Pages Function syntax | Passed for all four function modules |
| Inquiry function | Passed with a stubbed Resend transport |
| Signed reply flow | Passed; recipient is read only from the signed payload |
| Reply BCC | Passed; copy is delivered to the configured Wavenly inbox |
| Wrong passcode rejection | Passed with HTTP 401 |
| Local Cloudflare Pages runtime | Passed; static route served and `/api/inquiry` was discovered by Wrangler |

The original handoff noted failed end-to-end assertions. Those assertions parsed
an HTML email URL as if its query separator were a literal `&`; the email
correctly encodes it as `&amp;`. Re-running the test with proper HTML handling
passed the complete inquiry-to-reply flow.

## Deployment blocker

Wrangler is installed, but the local Cloudflare authentication session is
expired. The project cannot be deployed until an authorized user either runs:

```bash
npx wrangler login
```

or provides a `CLOUDFLARE_API_TOKEN` with permission to manage the intended
Cloudflare Pages project.

No production secrets were found or exposed during this handoff.

The `npm run dev` and `npm run deploy` scripts invoke Wrangler through `npx`,
so no global Wrangler installation is required.

## Before first production deploy

1. Authenticate Wrangler and create/select the Pages project.
2. Set the six production variables and secrets listed in [SETUP.md](SETUP.md).
3. Verify the sender domain in Resend before setting `RESEND_FROM`.
4. Deploy, attach the custom domain, set `SITE_URL` to the final HTTPS origin,
   and deploy once more.
5. Submit a real inquiry, confirm inbox delivery, open the signed reply link,
   send a test reply, and confirm the BCC copy arrives.

## Security posture

- No database: the inbox is the inquiry archive.
- Client address and inquiry details are HMAC-signed before they appear in the
  reply link.
- Reply endpoint does not accept an arbitrary recipient.
- Reply endpoint requires a separate server-verified passcode.
- Email HTML values are escaped before rendering.
- `_headers` disables framing and enables basic browser security headers.
- `/studio` is blocked from indexing in both headers and `robots.txt`.

## Recommended next improvement

Add Cloudflare Turnstile to the inquiry form if spam becomes a problem. It is
not required for launch; the current honeypot and completion-time gate provide
only lightweight bot filtering.
