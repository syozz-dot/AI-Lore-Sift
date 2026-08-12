# AI News Navigator

AI News Navigator is an open-source AI industry intelligence product for product managers, founders, and researchers.

It is designed to answer three questions:

1. What actually happened?
2. Why does it matter?
3. What product or business opportunity could follow?

The single-owner Distill workspace adds a user-directed knowledge flow: paste a web
page or long text, receive a reading verdict and evidence-anchored Chinese
distillation, then save the result to the knowledge library. Access is private,
but the current implementation stores source text, analysis, follow-up messages,
and saved knowledge in PostgreSQL. It must not be presented as a zero-storage or
multi-user privacy system.

## Project status

V2 foundation work is in progress. PostgreSQL-backed ingestion covers official news, arXiv AI papers, and selected first-party GitHub releases. Explainable relevance scoring, conservative Story clustering, and the first public reading interface are now available.

## Architecture

```text
Source adapters
  -> Fetch
  -> Normalize
  -> Canonical URL and content hash
  -> Exact deduplication
  -> Store items
  -> Cluster stories
  -> Score and analyze
  -> Publish
```

The core domain separates raw source items from stories:

- `Source`: where information comes from and whether the connector is healthy.
- `Item`: one article, paper, release, post, or product page.
- `Story`: one real-world event supported by one or more items.
- `Topic`: a company, model, technology, or content category used for navigation.

See [docs/architecture.md](docs/architecture.md) for the current boundaries.

## Workspace

```text
apps/web             Public Story feed, detail pages, and JSON API
packages/database    PostgreSQL schema and database client
packages/sources     Source contracts, registry, and RSS adapters
packages/pipeline    Normalization, exact deduplication, and ingestion
packages/intelligence Explainable relevance scoring and Story clustering
jobs                 PostgreSQL repository and ingestion entry points
docs                 Product and engineering documentation
```

## Local development

Requirements:

- Node.js 22.12 or newer
- pnpm 11
- Docker, or an existing PostgreSQL instance

```bash
cp .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm check
pnpm test
pnpm ingest:due
pnpm process:stories
pnpm sources:health
pnpm dev:web
```

Configured sources include official AI labs, selected technology media,
Product Hunt, arXiv AI categories, Hugging Face model and paper radar, and
stable releases from Ollama and vLLM. AIHOT selected social discovery and six
public Wechat2RSS account feeds provide a no-credential baseline for X and
WeChat coverage. Official X API collection and a private We-MP-RSS-compatible
WeChat feed remain optional. See [docs/sources.md](docs/sources.md) for source
policy, rich-media handling, attribution, and adapter behavior.

Scheduling is database-driven with exponential failure backoff and per-source leases. See [docs/operations.md](docs/operations.md) for commands, health semantics, and the deployment boundary.

Relevant items are grouped with a conservative, versioned clustering baseline. See [docs/intelligence.md](docs/intelligence.md) for scoring signals, merge guards, and current limitations.

The web app reads only persisted PostgreSQL data. It does not inject sample news when the database is missing or empty. The Story feed is available at `/`, Story details at `/stories/[slug]`, and JSON endpoints under `/api/stories` and `/api/health/sources`.

The private workspace lives at `/distill`, and saved knowledge lives at
`/knowledge`. Configure `DISTILL_ACCESS_KEY` and `DISTILL_SESSION_SECRET` before
using it. Platform video imports are intentionally adapter boundaries rather
than public scraping endpoints in the first release.

Because this is a public repository, secrets must live only in deployment
environment variables. Run `pnpm security:secrets` before pushing, and review
[docs/security-and-privacy.md](docs/security-and-privacy.md) before exposing the
private workspace or importing sensitive material.

Production web deployments run committed Drizzle migrations before the Next.js build. When available, migrations use `DATABASE_URL_UNPOOLED`; application requests continue to use the pooled `DATABASE_URL`.

## Product principles

- Facts and AI interpretation are stored and presented separately.
- Original publication time is never replaced by crawl time.
- Every AI conclusion must link back to source evidence.
- Ranking is multi-signal; the LLM is not the sole ranking authority.
- A broken source must be visible in source health, not silently become an empty section.

## License

[MIT](LICENSE)
