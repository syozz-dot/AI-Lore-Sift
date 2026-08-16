# Security and privacy boundary

This repository is public. Security must not depend on implementation details,
route names, or client code staying hidden.

## Public one-time preview boundary

Public visitors can complete one Distill preview and up to three follow-up
questions. The server fetches and analyzes the submitted material but does not
insert the source, analysis, messages, profile, or knowledge into PostgreSQL.
The response is written to IndexedDB by the browser. Local profile and knowledge
are sent to the model only after explicit per-request opt-in.

The one-time marker is an HttpOnly, Secure-in-production, SameSite Strict HMAC
cookie. It is an abuse-control signal rather than proof of a unique human:
visitors can clear cookies or change clients. Production requires an explicit
`DISTILL_GUEST_PROTECTION_MODE`: use `rate-limit` where a client-side challenge
is unreliable, or `turnstile` when both Turnstile keys are configured. Both
modes retain a pseudonymous per-client request window and a daily model-call
circuit breaker in each running process. These counters store only HMAC-derived
client keys, counts, and reset times; they never store submitted text.

The in-process counters are defense in depth, not a globally consistent quota
across serverless instances or Worker isolates. Add a platform WAF rate limit
to `/api/distill/preview` and `/api/distill/preview/messages`, and set a hard
spend/quota alert at the model provider. Turnstile and WAF metadata must not
include submitted text. The owner session uses separate authenticated routes and
does not consume guest limits.

Browser-local data is not a server backup. It is readable by scripts on the same
origin and can be removed by the browser or the user. The encrypted export under
`/settings` is the recovery path; raw source text remains excluded unless the
user explicitly includes it.

## Owner workspace boundary

The Distill workspace is intentionally **single-owner**. It uses an
environment-only access key and a separate HMAC session secret. Sessions are
HttpOnly, Secure in production, SameSite Strict, and expire after 12 hours.
Private routes reject cross-origin mutations, opt out of browser and CDN
caching, suppress referrers, deny framing, and opt out of search indexing.

The owner workspace is not a zero-storage or multi-user privacy architecture. Distill
source text, generated analysis, follow-up messages, saved documents, and
knowledge cards are stored in PostgreSQL under one configured owner ID. Do not
share the owner access key or expose owner routes as a multi-user account system.

The first browser-local foundation is available under `/settings`. It stores the
user-authored reading profile, explicitly approved memories, and versioned
future Distill/knowledge records in IndexedDB. Existing favorites remain in
localStorage for compatibility. The page can request persistent browser storage
and can export all of this browser-local state as an AES-GCM encrypted backup;
raw source text is excluded unless the user opts in. None of these mechanisms
is a server backup, and local browser data remains readable by scripts running
on the same origin. The current PostgreSQL Distill history is not migrated or
deleted by this phase.

Model providers receive the source text required for distillation and follow-up
answers. Their retention and training policies remain an external privacy
boundary; configure only providers whose terms are acceptable for the imported
content.

## Production requirements

1. Generate `DISTILL_ACCESS_KEY` (12+ characters recommended; 6 is the legacy
   compatibility minimum) and
   `DISTILL_SESSION_SECRET` (32+ characters) independently. Never reuse them.
2. Store all secrets only in the deployment environment. Do not put them in
   source files, screenshots, issue text, build logs, or analytics events.
3. Set `DISTILL_GUEST_PROTECTION_MODE=rate-limit` for a challenge-free public
   preview, or set it to `turnstile` and configure
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY` plus `TURNSTILE_SECRET_KEY` as a matched
   widget. Production fails closed when the selected mode is incomplete;
   `disabled` is rejected in production. Set
   `DISTILL_GUEST_DAILY_MODEL_LIMIT` to a conservative emergency ceiling.
4. Add platform-level rate limits to `POST /api/distill/session`,
   `POST /api/distill/preview`, and `POST /api/distill/preview/messages`. The
   in-process limiter is defense in depth and is not globally consistent across
   serverless instances.
5. Limit database and model-provider credentials to the minimum required scope,
   rotate them periodically, and revoke them immediately after suspected
   disclosure.
6. Keep database backups and logs under the same private-data policy as the live
   database. Do not log submitted text, generated answers, access keys, cookies,
   or authorization headers.
7. Run `pnpm security:secrets` and `pnpm security:audit` before each push. CI
   performs both checks. Enable GitHub secret scanning and push protection on
   the repository as additional controls.

If a secret was ever committed, deleting the file is insufficient: rotate the
secret first, then purge the value from Git history and invalidate affected
sessions.
