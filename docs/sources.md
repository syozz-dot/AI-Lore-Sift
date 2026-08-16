# Sources

Source definitions are code-reviewed configuration. Each definition records provenance, reliability, copyright policy, fetch frequency, and the connector used to retrieve it.

## Current sources

### OpenAI News

- Homepage: <https://openai.com/news/>
- Feed: <https://openai.com/news/rss.xml>
- Classification: first-party official blog, primary reliability
- Connector: RSS 2.0
- Schedule target: every 30 minutes
- Content policy: store titles, descriptions, links, categories, and source timestamps; do not store full article content

The first run accepts at most 50 of the newest feed entries. Later runs use a 24-hour overlap around the previous successful run and rely on exact URL/external-ID deduplication. The overlap prevents delayed or backfilled feed entries from being skipped.

### arXiv AI

- Homepage: <https://arxiv.org/>
- API: <https://export.arxiv.org/api/query>
- Query: `cs.AI OR cs.CL OR cs.LG`, newest submissions first
- Classification: primary paper repository
- Schedule target: every 60 minutes
- Content policy: store paper metadata and abstract; do not fetch or store PDF full text

The adapter distinguishes the original `published` timestamp from `updated`, preserves all authors and categories in metadata, and exposes the PDF as evidence metadata. It can retrieve up to five 100-entry pages, waiting three seconds between API requests, and stops once it crosses the previous-run checkpoint.

### Product Hunt

- Homepage: <https://www.producthunt.com/>
- Feed: <https://www.producthunt.com/feed>
- Classification: product launch directory, high reliability for launch metadata
- Connector: Atom
- Schedule target: every 60 minutes
- Content policy: store product name, tagline, Product Hunt link, maker name, and launch timestamp; do not store full page content

Product Hunt entries are stored as `product`, not as news or releases. The feed represents maker-submitted launch information, so product claims remain attributed to Product Hunt and are not treated as independently verified facts. The relevance scorer keeps AI products and filters unrelated launches.

### GitHub releases

Configured repositories:

- [Ollama](https://github.com/ollama/ollama/releases) — [Atom feed](https://github.com/ollama/ollama/releases.atom)
- [vLLM](https://github.com/vllm-project/vllm/releases) — [Atom feed](https://github.com/vllm-project/vllm/releases.atom)

These are first-party project release records. RC, alpha, beta, preview, and pre-release tags are filtered out by default. GitHub's Atom feed supplies `updated` rather than a dedicated publication field, so the timestamp is explicitly stored with `inferred` confidence.

## Adapter behavior

The generic RSS adapter supports RSS 2.0 and Atom entry shapes. It:

- preserves valid source publication timestamps with `exact` confidence;
- leaves missing or invalid publication timestamps unknown rather than replacing them with fetch time;
- filters incrementally only when a valid source timestamp exists;
- strips markup from descriptions used as excerpts;
- can derive a bounded excerpt from Atom content for release feeds;
- makes full-content storage an explicit per-source choice;
- extracts bounded image, video-preview, and audio metadata from RSS content,
  enclosures, and media thumbnails;
- fails loudly on HTTP errors so source health can become degraded.

## Default curated social discovery

### AIHOT selected X and WeChat items

- API: <https://aihot.virxact.com/api/v1/items>
- Classification: third-party discovery layer, medium reliability
- Selection: only AIHOT `selected` items whose source begins with `X:` or
  `公众号：`
- Schedule target: every 60 minutes
- Content policy: store the curated title, summary, original link, original
  source label, and AIHOT attribution metadata; do not store full article
  content

The connector uses the original X or WeChat URL as the item URL so exact
deduplication can still work when the same item arrives from another connector.
The canonical AIHOT item URL and attribution are retained in raw metadata.
AIHOT is a discovery dependency rather than an independent factual source, so
the original account remains visible and claims are not treated as
multi-source confirmation.

### Public Wechat2RSS feeds

The default configuration subscribes to the public feeds for 机器之心,
PaperWeekly, 新智元, 量子位, 极客公园, and 差评. Each account has its own
source-health record and a six-hour schedule target.

The RSS entries preserve the original `mp.weixin.qq.com` article link,
publication timestamp, bounded excerpt, and image metadata. Full article HTML
is not stored. Feed images are served through the same signed media-proxy
policy as other known WeChat image hosts.

## Optional curated social sources

### X curated accounts

Set `X_BEARER_TOKEN` to register the source. The adapter uses X API v2 recent
search, only requests posts from a reviewed account list, excludes reposts,
and expands attached media in the same request. Override the default account
list with the comma-separated `X_MONITORED_ACCOUNTS` variable.

Posts retain their source text, account attribution, canonical X URL, exact
publication timestamp, and image or video-preview metadata. The source is not
registered when the token is absent, so an unconfigured deployment does not
report a false source-health failure.

### WeChat curated accounts

WeChat collection is intentionally split into two services:

1. A stateful, always-on We-MP-RSS-compatible collector maintains QR login,
   account subscriptions, and article retrieval.
2. AILore Sift consumes the private RSS endpoint through
   `WECHAT_RSS_URL`.

The collector should subscribe only to reviewed accounts. The optional
`WECHAT_MONITORED_ACCOUNTS` list adds a second author check when the feed
exposes author metadata. `WECHAT_RSS_AUTHORIZATION` can carry a private feed
credential.

The adapter derives a bounded excerpt and media metadata from the feed but does
not persist WeChat full text because this source has `allowFullText` disabled.
The excerpt remains available for relevance scoring and Chinese analysis.

## Rich content and media policy

Items record whether stored content is plain text or HTML and keep a separate
bounded media-asset list. HTML is sanitized on the server before rendering:
scripts, inline styles, forms, frames, and event handlers are removed; outbound
links are hardened; and only a conservative editorial tag set remains.

Known X and WeChat image hosts can be served through the signed `/api/media`
proxy. The proxy validates the host on every redirect, accepts images only,
enforces a 10 MB response limit, and caches successful responses. Unknown
hosts remain direct source links rather than becoming an open proxy.
