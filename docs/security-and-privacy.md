# Security and privacy boundary

This repository is public. Security must not depend on implementation details,
route names, or client code staying hidden.

## Current private workspace boundary

The Distill workspace is intentionally **single-owner**. It uses an
environment-only access key and a separate HMAC session secret. Sessions are
HttpOnly, Secure in production, SameSite Strict, and expire after 12 hours.
Private routes reject cross-origin mutations, opt out of browser and CDN
caching, suppress referrers, deny framing, and opt out of search indexing.

This is not yet a zero-storage or multi-user privacy architecture. Distill
source text, generated analysis, follow-up messages, saved documents, and
knowledge cards are stored in PostgreSQL under one configured owner ID. Do not
open this workspace to multiple users until those records are migrated to the
planned browser-local, per-user memory layer or a reviewed tenant-isolated
server design.

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
3. Add a platform-level rate limit to `POST /api/distill/session`. The in-process
   limiter is defense in depth and is not globally consistent across serverless
   instances.
4. Limit database and model-provider credentials to the minimum required scope,
   rotate them periodically, and revoke them immediately after suspected
   disclosure.
5. Keep database backups and logs under the same private-data policy as the live
   database. Do not log submitted text, generated answers, access keys, cookies,
   or authorization headers.
6. Run `pnpm security:secrets` and `pnpm security:audit` before each push. CI
   performs both checks. Enable GitHub secret scanning and push protection on
   the repository as additional controls.

If a secret was ever committed, deleting the file is insufficient: rotate the
secret first, then purge the value from Git history and invalidate affected
sessions.
