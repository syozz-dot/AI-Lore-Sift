import type {
  ContentType,
  RawSourceItem,
  SourceAdapter,
  SourceFetchContext,
} from "./types.js";

interface AiHotItem {
  id?: string;
  title?: string;
  originalTitle?: string | null;
  summary?: string | null;
  source?: { name?: string };
  links?: {
    aihot?: string;
    original?: string;
  };
  publishedAt?: string | null;
  discoveredAt?: string | null;
  category?: string | null;
  score?: number | null;
  selected?: boolean;
  attribution?: {
    name?: string;
    url?: string;
  };
}

interface AiHotItemsResponse {
  items?: AiHotItem[];
  page?: {
    hasMore?: boolean;
    nextCursor?: string | null;
  };
}

export interface AiHotSocialAdapterOptions {
  key: string;
  endpoint?: string;
  maxItems?: number;
  pageSize?: number;
  maxPages?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const SOCIAL_SOURCE_PATTERN = /^(?:X|公众号)\s*[:：]/iu;

function contentTypeFromCategory(
  category: string | null | undefined,
): ContentType {
  switch (category) {
    case "ai-models":
      return "model";
    case "ai-products":
      return "product";
    case "paper":
      return "paper";
    case "industry":
    case "tip":
      return "news";
    default:
      return "post";
  }
}

function platformFromSource(sourceName: string): "x" | "wechat" {
  return /^X\s*[:：]/iu.test(sourceName) ? "x" : "wechat";
}

function validHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export class AiHotSocialAdapter implements SourceAdapter {
  readonly key: string;
  readonly #options: Required<
    Pick<
      AiHotSocialAdapterOptions,
      "endpoint" | "maxItems" | "pageSize" | "maxPages" | "timeoutMs"
    >
  >;
  readonly #fetch: typeof fetch;

  constructor(options: AiHotSocialAdapterOptions) {
    this.key = options.key;
    this.#options = {
      endpoint: options.endpoint ?? "https://aihot.virxact.com/api/v1/items",
      maxItems: Math.min(Math.max(options.maxItems ?? 50, 1), 100),
      pageSize: Math.min(Math.max(options.pageSize ?? 100, 1), 100),
      maxPages: Math.min(Math.max(options.maxPages ?? 5, 1), 20),
      timeoutMs: options.timeoutMs ?? 20_000,
    };
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async fetch(context: SourceFetchContext): Promise<RawSourceItem[]> {
    const results: RawSourceItem[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < this.#options.maxPages; page += 1) {
      const endpoint = new URL(this.#options.endpoint);
      endpoint.searchParams.set("mode", "selected");
      endpoint.searchParams.set("window", "7d");
      endpoint.searchParams.set("by", "timeline");
      endpoint.searchParams.set("limit", String(this.#options.pageSize));
      if (cursor) endpoint.searchParams.set("cursor", cursor);

      const response = await this.#fetch(endpoint, {
        headers: {
          accept: "application/json",
          "user-agent":
            "AI-News-Navigator/0.1 (+https://github.com/syozz-dot/ai-news-navigator)",
        },
        signal: AbortSignal.timeout(this.#options.timeoutMs),
      });
      if (!response.ok) {
        throw new Error(
          `AIHOT request failed with ${response.status} ${response.statusText}`.trim(),
        );
      }

      const payload = (await response.json()) as AiHotItemsResponse;
      if (!Array.isArray(payload.items)) {
        throw new Error("AIHOT response does not contain an items array");
      }

      for (const item of payload.items) {
        const sourceName = item.source?.name?.trim();
        const title = item.title?.trim();
        const originalUrl = validHttpUrl(item.links?.original);
        if (
          !sourceName ||
          !SOCIAL_SOURCE_PATTERN.test(sourceName) ||
          !title ||
          !originalUrl
        ) {
          continue;
        }

        const publishedAt = item.publishedAt ?? item.discoveredAt ?? undefined;
        const freshnessTimestamp = item.discoveredAt ?? item.publishedAt;
        if (
          context.since &&
          freshnessTimestamp &&
          new Date(freshnessTimestamp).getTime() <= context.since.getTime()
        ) {
          continue;
        }

        const aihotCanonical = validHttpUrl(
          item.links?.aihot ?? item.attribution?.url,
        );
        const originalTitle = item.originalTitle?.trim();
        results.push({
          ...(item.id ? { externalId: item.id } : {}),
          contentType: contentTypeFromCategory(item.category),
          title,
          ...(originalTitle && originalTitle !== title
            ? { originalTitle }
            : {}),
          url: originalUrl,
          ...(item.summary?.trim() ? { excerpt: item.summary.trim() } : {}),
          author: sourceName,
          language: "zh",
          ...(publishedAt ? { publishedAt } : {}),
          publicationTimeConfidence: item.publishedAt ? "exact" : "inferred",
          metadata: {
            platform: platformFromSource(sourceName),
            aggregator: "AIHOT",
            attributionName: item.attribution?.name ?? "AI HOT",
            ...(aihotCanonical ? { aihotCanonical } : {}),
            originalUrl,
            originalSourceName: sourceName,
            ...(item.category ? { category: item.category } : {}),
            ...(typeof item.score === "number"
              ? { aihotScore: item.score }
              : {}),
            selected: item.selected ?? true,
            ...(item.discoveredAt ? { discoveredAt: item.discoveredAt } : {}),
          },
        });

        if (results.length >= this.#options.maxItems) return results;
      }

      cursor = payload.page?.nextCursor ?? undefined;
      if (!payload.page?.hasMore || !cursor) break;
    }

    return results;
  }
}
