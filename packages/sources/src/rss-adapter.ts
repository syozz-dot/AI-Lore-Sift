import { XMLParser } from "fast-xml-parser";

import type {
  ContentType,
  RawSourceItem,
  SourceAdapter,
  SourceFetchContext,
  SourceMediaAsset,
} from "./types.js";

const DEFAULT_ACCEPT =
  "application/rss+xml, application/atom+xml, application/xml, text/xml";

export interface RssSourceAdapterOptions {
  key: string;
  feedUrl: string;
  contentType: ContentType;
  language?: string;
  maxItems?: number;
  includeContent?: boolean;
  useContentAsExcerpt?: boolean;
  maxExcerptCharacters?: number;
  datedConfidence?: "exact" | "inferred";
  timeoutMs?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

type XmlRecord = Record<string, unknown>;

function isRecord(value: unknown): value is XmlRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function textValue(value: unknown): string | undefined {
  if (typeof value === "string" || typeof value === "number") {
    const text = String(value).trim();
    return text || undefined;
  }

  if (Array.isArray(value)) {
    return value.map(textValue).find((text) => text !== undefined);
  }

  if (isRecord(value)) {
    return textValue(value["#text"] ?? value.value);
  }

  return undefined;
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(
    /&(#\d+|#x[\da-f]+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return namedEntities[code.toLowerCase()] ?? entity;
    },
  );
}

function htmlToText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const text = decodeHtmlEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

  return text || undefined;
}

function parseDate(value: unknown): Date | undefined {
  const text = textValue(value);
  if (!text) {
    return undefined;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function linkValue(value: unknown): string | undefined {
  const direct = textValue(value);
  if (direct) {
    return direct;
  }

  const links = asArray(value).filter(isRecord);
  const preferred =
    links.find((link) => link["@rel"] === "alternate") ??
    links.find((link) => link["@rel"] === undefined) ??
    links[0];

  return preferred
    ? textValue(preferred["@href"] ?? preferred.href)
    : undefined;
}

function categoryValues(value: unknown): string[] {
  return asArray(value)
    .map((category) => {
      if (isRecord(category)) {
        return textValue(
          category["@term"] ?? category.term ?? category["#text"],
        );
      }
      return textValue(category);
    })
    .filter((category): category is string => Boolean(category));
}

function getFeedEntries(document: unknown): XmlRecord[] | null {
  if (!isRecord(document)) {
    return null;
  }

  const rss = document.rss;
  if (isRecord(rss) && isRecord(rss.channel)) {
    return asArray(rss.channel.item).filter(isRecord);
  }

  const feed = document.feed;
  if (isRecord(feed)) {
    return asArray(feed.entry).filter(isRecord);
  }

  return null;
}

function authorValue(entry: XmlRecord): string | undefined {
  const author = entry.author;
  if (isRecord(author)) {
    return textValue(author.name ?? author["#text"]);
  }
  return textValue(author ?? entry.creator);
}

function normalizeMediaUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const candidate = decodeHtmlEntities(value.trim());
  const absolute = candidate.startsWith("//")
    ? `https:${candidate}`
    : candidate;
  try {
    const url = new URL(absolute);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function mediaFromHtml(value: string | undefined): SourceMediaAsset[] {
  if (!value) return [];
  const assets: SourceMediaAsset[] = [];
  const imagePattern =
    /<img\b[^>]*\b(?:src|data-src|data-original)=["']([^"']+)["'][^>]*>/gi;
  for (const match of value.matchAll(imagePattern)) {
    const url = normalizeMediaUrl(match[1]);
    if (url) assets.push({ type: "image", url });
  }
  return assets;
}

function mediaFromEntry(entry: XmlRecord): SourceMediaAsset[] {
  const assets: SourceMediaAsset[] = [];
  const candidates = [
    ...asArray(entry.enclosure),
    ...asArray(entry.thumbnail),
    ...asArray(entry.content),
  ];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const url = normalizeMediaUrl(
      textValue(candidate["@url"] ?? candidate.url ?? candidate["@href"]),
    );
    if (!url) continue;
    const declaredType = textValue(candidate["@type"] ?? candidate.type) ?? "";
    const type = declaredType.startsWith("video/")
      ? "video"
      : declaredType.startsWith("audio/")
        ? "audio"
        : "image";
    assets.push({ type, url });
  }

  return assets;
}

function deduplicateMediaAssets(
  assets: SourceMediaAsset[],
): SourceMediaAsset[] {
  const seen = new Set<string>();
  return assets
    .filter((asset) => {
      if (seen.has(asset.url)) return false;
      seen.add(asset.url);
      return true;
    })
    .slice(0, 12);
}

export class RssSourceAdapter implements SourceAdapter {
  readonly key: string;

  readonly #options: Required<
    Pick<
      RssSourceAdapterOptions,
      | "feedUrl"
      | "contentType"
      | "maxItems"
      | "includeContent"
      | "useContentAsExcerpt"
      | "maxExcerptCharacters"
      | "datedConfidence"
      | "timeoutMs"
      | "userAgent"
    >
  > &
    Pick<RssSourceAdapterOptions, "language" | "headers">;
  readonly #fetch: typeof fetch;
  readonly #parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    removeNSPrefix: true,
    trimValues: true,
    parseTagValue: false,
  });

  constructor(options: RssSourceAdapterOptions) {
    if (options.maxItems !== undefined && options.maxItems < 1) {
      throw new Error("RSS maxItems must be at least 1");
    }
    if (
      options.maxExcerptCharacters !== undefined &&
      options.maxExcerptCharacters < 1
    ) {
      throw new Error("RSS maxExcerptCharacters must be at least 1");
    }

    this.key = options.key;
    this.#options = {
      feedUrl: options.feedUrl,
      contentType: options.contentType,
      maxItems: options.maxItems ?? 50,
      includeContent: options.includeContent ?? false,
      useContentAsExcerpt: options.useContentAsExcerpt ?? false,
      maxExcerptCharacters: options.maxExcerptCharacters ?? 2_000,
      datedConfidence: options.datedConfidence ?? "exact",
      timeoutMs: options.timeoutMs ?? 15_000,
      userAgent:
        options.userAgent ??
        "AI-News-Navigator/0.1 (+https://github.com/syozz-dot/ai-news-navigator)",
      ...(options.language ? { language: options.language } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
    };
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async fetch(context: SourceFetchContext): Promise<RawSourceItem[]> {
    const response = await this.#fetch(this.#options.feedUrl, {
      headers: {
        accept: DEFAULT_ACCEPT,
        "user-agent": this.#options.userAgent,
        ...this.#options.headers,
      },
      signal: AbortSignal.timeout(this.#options.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(
        `RSS request failed with ${response.status} ${response.statusText}`.trim(),
      );
    }

    const document = this.#parser.parse(await response.text()) as unknown;
    const entries = getFeedEntries(document);
    if (!entries) {
      throw new Error("RSS response does not contain an RSS or Atom feed");
    }
    const items: RawSourceItem[] = [];

    for (const entry of entries) {
      const title = htmlToText(textValue(entry.title));
      const url = linkValue(entry.link);
      if (!title || !url) {
        continue;
      }

      const publishedAt = parseDate(
        entry.pubDate ?? entry.published ?? entry.updated ?? entry.date,
      );
      if (
        context.since &&
        publishedAt &&
        publishedAt.getTime() <= context.since.getTime()
      ) {
        continue;
      }

      const summary = textValue(entry.description ?? entry.summary);
      const fullContent = textValue(entry.encoded ?? entry.content);
      const categories = categoryValues(entry.category);
      const externalId = textValue(entry.guid ?? entry.id);
      const excerptText = htmlToText(
        summary ??
          (this.#options.useContentAsExcerpt ? fullContent : undefined),
      );
      const excerpt = excerptText
        ? excerptText.slice(0, this.#options.maxExcerptCharacters).trim()
        : undefined;
      const author = authorValue(entry);
      const mediaAssets = deduplicateMediaAssets([
        ...mediaFromEntry(entry),
        ...mediaFromHtml(fullContent),
        ...mediaFromHtml(summary),
      ]);

      items.push({
        contentType: this.#options.contentType,
        title,
        url,
        ...(externalId ? { externalId } : {}),
        ...(excerpt ? { excerpt } : {}),
        ...(this.#options.includeContent && fullContent
          ? { content: fullContent, contentFormat: "html" as const }
          : {}),
        ...(mediaAssets.length ? { mediaAssets } : {}),
        ...(author ? { author } : {}),
        ...(this.#options.language ? { language: this.#options.language } : {}),
        ...(publishedAt ? { publishedAt } : {}),
        publicationTimeConfidence: publishedAt
          ? this.#options.datedConfidence
          : "unknown",
        metadata: {
          feedUrl: this.#options.feedUrl,
          categories,
        },
      });

      if (items.length >= this.#options.maxItems) {
        break;
      }
    }

    return items;
  }
}
