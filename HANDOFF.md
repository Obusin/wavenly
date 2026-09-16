# Wavenly — production handoff

Last updated: 2026-09-16

## Live service

- Canonical site: `https://www.wavenly.co`
- Bare domain: `https://wavenly.co` permanently redirects to the `www` domain.
- Hosting: Vercel, project `obus-projects-4da2cbd1/wavenly`.
- Repository: `https://github.com/Obusin/wavenly` (public), branch `main`.
- Registrar: Namecheap. DNS is delegated to Vercel — **Cloudflare is no longer in the request path**.
- Nameservers: `ns1.vercel-dns.com` and `ns2.vercel-dns.com`.

## DNS and email

- Vercel currently hosts the DNS zone for `wavenly.co`.
- Google Workspace receiving mail was restored with `MX @ → smtp.google.com` at priority `1`.
- Intended public/contact address: `hello@wavenly.co`.
- Before relying on the address, send a normal external test message to it and confirm it arrives in Google Workspace.
- If the previous Google Workspace DNS zone had custom SPF, DKIM, DMARC, or verification TXT records, recreate them in Vercel DNS. A nameserver migration does not carry those records over.

## Vercel environment variables

All values are configured as Production secrets. Do not put secret values in this document or commit them.

| Variable | Status / purpose |
| --- | --- |
| `SIGNING_SECRET` | Set. Signs studio reply links. |
| `STUDIO_PASSCODE` | Set. Protects the reply composer. |
| `SITE_URL` | Set to `https://www.wavenly.co`. |
| `WAVENLY_INBOX` | Set to `hello@wavenly.co`. |
| `RESEND_FROM` | Set to `Wavenly <hello@wavenly.co>`. |
| `RESEND_API_KEY` | **Still required.** Create a sending-only key in Resend after verifying `wavenly.co`, then add it as a Production secret. |

### Email state

The form sends to `POST /api/inquiry`; Vercel’s adapter runs the existing email handler. Until `RESEND_API_KEY` exists and Resend verifies the sending domain, form submissions intentionally fail rather than silently lose leads. The form must be tested after setup.

The studio reply flow uses `/studio` and `POST /api/reply`. It is also dependent on Resend.

## Whop tracking

- Whop Pixel is installed in `index.html` once, in the document `<head>`.
- Business scope: `biz_aGYisl5OI6TMwa`.
- Every public page load sends `page`.
- `script.js` sends `lead` only after a successful, likely-human inquiry submission. It does not send enquiry details or count failed/honeypot/too-fast submissions.
- Manually verify from a normal browser with no content blocker:
  1. Visit `https://www.wavenly.co`.
  2. Open `https://whop.com/dashboard/biz_aGYisl5OI6TMwa/websites`.
  3. Confirm the domain has a recent **Last event**.
- After Resend is complete, submit a real test enquiry and confirm a Whop `lead` conversion.

## Relevant files

| File | Responsibility |
| --- | --- |
| `index.html` | Main marketing site and Whop Pixel. |
| `script.js` | Form UX and post-success Whop `lead` event. |
| `functions/api/inquiry.js` | Original web-standard inquiry handler. |
| `functions/api/reply.js` | Original web-standard studio reply handler. |
| `api/_adapter.js` | Vercel adapter for the existing request handlers. |
| `api/inquiry.js`, `api/reply.js` | Vercel serverless function entry points. |
| `functions/_lib/email.js` | Resend REST sender and email templates. |
| `vercel.json` | Root static output, `/studio` rewrite, apex-to-`www` redirect, security headers. |

## Recent production changes

- `4fb2b07` — Serve the static site from the repository root on Vercel.
- `e958646` / `7cd6e25` — Canonical domain setup; final direction is `wavenly.co` → `www.wavenly.co`.
- `12bb4b7` — Install Whop Pixel page tracking.
- `5154a20` — Track successful enquiries as Whop `lead` conversions.

## Handoff checks

1. Confirm `www.wavenly.co` loads and `wavenly.co` redirects to it.
2. Confirm `hello@wavenly.co` can receive external mail in Google Workspace.
3. Finish Resend domain verification, add `RESEND_API_KEY`, redeploy, then submit a real enquiry.
4. Confirm the enquiry arrives at `hello@wavenly.co`, the studio reply works, and Whop records both `page` and `lead`.
5. Review the visible contact mailto and form error fallback in `index.html` / `script.js`: they still reference the old Gmail address and should be changed to `hello@wavenly.co` if that is the intended public contact address.

## Local worktree note

There are unrelated, unstaged local edits in `.gitignore` and `index.html`, plus untracked local agent folders. Preserve and review them separately; do not use a destructive Git reset during the next handoff.
