import type {
  RawSourceItem,
  SourceAdapter,
  SourceFetchContext,
  SourceMediaAsset,
} from "./types.js";

interface XUser {
  id: string;
  name: string;
  username: string;
}

interface XMedia {
  media_key: string;
  type: "photo" | "video" | "animated_gif";
  url?: string;
  preview_image_url?: string;
  width?: number;
  height?: number;
  alt_text?: string;
}

interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  lang?: string;
  attachments?: { media_keys?: string[] };
}

interface XRecentSearchResponse {
  data?: XTweet[];
  includes?: {
    users?: XUser[];
    media?: XMedia[];
  };
  errors?: Array<{ detail?: string; title?: string }>;
}

export interface XSourceAdapterOptions {
  key: string;
  bearerToken: string;
  accounts: string[];
  maxItems?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function titleFromTweet(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > 140
    ? `${singleLine.slice(0, 137).trimEnd()}…`
    : singleLine;
}

function toMediaAsset(media: XMedia): SourceMediaAsset | null {
  const url = media.url ?? media.preview_image_url;
  if (!url) return null;
  return {
    type: media.type === "photo" ? "image" : "video",
    url,
    ...(media.preview_image_url ? { previewUrl: media.preview_image_url } : {}),
    ...(media.alt_text ? { alt: media.alt_text } : {}),
    ...(media.width ? { width: media.width } : {}),
    ...(media.height ? { height: media.height } : {}),
  };
}

export class XSourceAdapter implements SourceAdapter {
  readonly key: string;
  readonly #options: Required<
    Pick<
      XSourceAdapterOptions,
      "bearerToken" | "accounts" | "maxItems" | "timeoutMs"
    >
  >;
  readonly #fetch: typeof fetch;

  constructor(options: XSourceAdapterOptions) {
    if (!options.bearerToken.trim()) {
      throw new Error("X bearer token is required");
    }
    if (options.accounts.length === 0) {
      throw new Error("At least one X account is required");
    }
    this.key = options.key;
    this.#options = {
      bearerToken: options.bearerToken.trim(),
      accounts: [
        ...new Set(options.accounts.map((value) => value.replace(/^@/, ""))),
      ],
      maxItems: Math.min(Math.max(options.maxItems ?? 40, 10), 100),
      timeoutMs: options.timeoutMs ?? 20_000,
    };
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async fetch(context: SourceFetchContext): Promise<RawSourceItem[]> {
    const endpoint = new URL("https://api.x.com/2/tweets/search/recent");
    endpoint.searchParams.set(
      "query",
      `(${this.#options.accounts.map((account) => `from:${account}`).join(" OR ")}) -is:retweet`,
    );
    endpoint.searchParams.set("max_results", String(this.#options.maxItems));
    endpoint.searchParams.set(
      "tweet.fields",
      "id,text,author_id,created_at,lang,attachments",
    );
    endpoint.searchParams.set("expansions", "author_id,attachments.media_keys");
    endpoint.searchParams.set("user.fields", "id,name,username");
    endpoint.searchParams.set(
      "media.fields",
      "media_key,type,url,preview_image_url,width,height,alt_text",
    );
    if (context.since) {
      const latestAllowed = new Date(context.now.getTime() - 15_000);
      const requestedStart =
        context.since.getTime() < latestAllowed.getTime()
          ? context.since
          : new Date(latestAllowed.getTime() - 60_000);
      const earliestAllowed = new Date(
        context.now.getTime() - (6 * 24 + 23) * 60 * 60 * 1_000,
      );
      const startTime =
        requestedStart.getTime() < earliestAllowed.getTime()
          ? earliestAllowed
          : requestedStart;
      endpoint.searchParams.set("start_time", startTime.toISOString());
    }

    const response = await this.#fetch(endpoint, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${this.#options.bearerToken}`,
        "user-agent":
          "AI-News-Navigator/0.1 (+https://github.com/syozz-dot/ai-news-navigator)",
      },
      signal: AbortSignal.timeout(this.#options.timeoutMs),
    });
    const payload = (await response.json()) as XRecentSearchResponse;
    if (!response.ok) {
      const detail = payload.errors
        ?.map((error) => error.detail ?? error.title)
        .filter(Boolean)
        .join("; ");
      throw new Error(
        `X request failed with ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }

    const users = new Map(
      (payload.includes?.users ?? []).map((user) => [user.id, user]),
    );
    const media = new Map(
      (payload.includes?.media ?? []).map((asset) => [asset.media_key, asset]),
    );

    return (payload.data ?? []).flatMap((tweet): RawSourceItem[] => {
      const user = tweet.author_id ? users.get(tweet.author_id) : undefined;
      if (!user || !tweet.text.trim()) return [];
      const mediaAssets = (tweet.attachments?.media_keys ?? [])
        .map((key) => media.get(key))
        .filter((asset): asset is XMedia => Boolean(asset))
        .map(toMediaAsset)
        .filter((asset): asset is SourceMediaAsset => Boolean(asset));
      return [
        {
          externalId: tweet.id,
          contentType: "news",
          title: titleFromTweet(tweet.text),
          url: `https://x.com/${user.username}/status/${tweet.id}`,
          excerpt: tweet.text,
          content: tweet.text,
          contentFormat: "text",
          author: `${user.name} (@${user.username})`,
          ...(tweet.lang ? { language: tweet.lang } : {}),
          ...(tweet.created_at ? { publishedAt: tweet.created_at } : {}),
          publicationTimeConfidence: tweet.created_at ? "exact" : "unknown",
          ...(mediaAssets.length ? { mediaAssets } : {}),
          metadata: {
            platform: "x",
            username: user.username,
            authorId: user.id,
          },
        },
      ];
    });
  }
}
