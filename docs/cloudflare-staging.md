# Cloudflare Workers deployment

This project uses `@opennextjs/cloudflare` for a full-stack Next.js Worker. The
Cloudflare deployment is a separate runtime target, not a proxy in front of the
Vercel deployment. The same accepted Worker currently serves
`ailoresift.com`, `www.ailoresift.com`, and `staging.ailoresift.com`; its
canonical site URL is the apex domain.

## Verified local baseline

- Next.js 16.2.11 builds through OpenNext 1.20.2.
- Wrangler 4.123.0 packages the Worker at about 7.3 MB uncompressed and 1.53 MB
  gzip, below the current 3 MB compressed Workers Free upload limit.
- `/distill` and `/settings` return HTTP 200 under the local Workers runtime.
- `POST /api/distill/preview` reaches application validation under the local
  Workers runtime.
- The free plan's 10 ms CPU limit is still a production risk for SSR, article
  cleaning, and authentication. Use Workers Paid for the production candidate
  and verify CPU time in Workers Observability before moving traffic.

## Staging setup

1. Authenticate locally:

   ```bash
   corepack pnpm --filter @ai-news-navigator/web exec wrangler login
   ```

2. Add secrets one by one. Never place their values in this repository or shell
   history; run the command and paste the value into Wrangler's hidden prompt:

   ```bash
   corepack pnpm --filter @ai-news-navigator/web exec wrangler secret put DISTILL_SESSION_SECRET
   corepack pnpm --filter @ai-news-navigator/web exec wrangler secret put DISTILL_ACCESS_KEY
   corepack pnpm --filter @ai-news-navigator/web exec wrangler secret put DATABASE_URL
   corepack pnpm --filter @ai-news-navigator/web exec wrangler secret put DEEPSEEK_API_KEY
   corepack pnpm --filter @ai-news-navigator/web exec wrangler secret put DEEPSEEK_BASE_URL
   ```

   Add only the optional provider/source secrets actually used by the deployment.
   `DISTILL_OWNER_ID` is non-secret and may remain a normal environment variable.
   `wrangler.jsonc` selects the Neon serverless WebSocket driver for Workers;
   Vercel and Node jobs continue using Postgres.js by default.

3. Keep `DISTILL_GUEST_PROTECTION_MODE=rate-limit` for Mainland-China-facing
   staging. `wrangler.jsonc` already sets this mode and the per-isolate emergency
   model-call ceiling. Do not add Turnstile to this path.

4. Deploy the Worker:

   ```bash
   corepack pnpm --filter @ai-news-navigator/web cf:deploy
   ```

5. Verify the generated `workers.dev` URL before adding any custom domain:

   - `/`, `/distill`, `/settings`, and one Story detail page return normally.
   - Anonymous Distill succeeds once, then rejects the same browser.
   - The result and follow-up messages do not create PostgreSQL Distill rows.
   - The owner access-key session can run repeatedly and still writes owner data.
   - A source URL, direct text input, personalization opt-in, and three follow-ups
     all complete within the configured Worker CPU limit.

## Production anti-abuse layers

The application-level defenses are deliberately portable across Vercel and
Cloudflare:

1. A signed HttpOnly cookie records the one successful anonymous preview and
   three successful follow-ups.
2. A pseudonymous HMAC fingerprint limits repeated model attempts in a ten-minute
   window. Raw IP addresses and submitted content are not stored.
3. A per-process daily circuit breaker caps anonymous model calls. This is only
   an emergency brake; Worker isolates do not share an exact counter.
4. Add Cloudflare WAF rate-limiting rules for POST requests to
   `/api/distill/preview`, `/api/distill/preview/messages`, and
   `/api/distill/session`. Start conservatively, observe legitimate shared-IP
   traffic, then tighten. Do not include request bodies in logging or rule keys.
5. Configure a hard provider spend limit and alert. This is the final cost
   boundary if cookies, fingerprints, or distributed edge counters are bypassed.

Do not describe either the browser cookie or Cloudflare's eventually consistent
edge counter as proof of one unique human. The goal is bounded model spend, not
identity verification.

## Dual-deployment boundary

During migration, Vercel may remain the PR preview, backup, and only scheduler.
Cloudflare has no Cron Trigger in this deployment. Do not enable the same
refresh/analyze schedule on both providers. Vercel remains the only scheduler
and may also remain a preview/backup deployment while the public apex domain is
served by Cloudflare.
