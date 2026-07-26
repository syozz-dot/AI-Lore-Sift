import { createHash } from "node:crypto";

import type {
  ContentFormat,
  ContentType,
  PublicationTimeConfidence,
  RawSourceItem,
  SourceMediaAsset,
} from "@ai-news-navigator/sources";

import { canonicalizeUrl } from "./canonical-url.js";

export interface NormalizedItem {
  sourceId: string;
  externalId: string | null;
  contentType: ContentType;
  title: string;
  originalTitle: string | null;
  excerpt: string | null;
  content: string | null;
  contentFormat: ContentFormat;
  mediaAssets: SourceMediaAsset[];
  author: string | null;
  language: string | null;
  originalUrl: string;
  canonicalUrl: string;
  canonicalUrlHash: string;
  contentHash: string;
  sourcePublishedAt: Date | null;
  publicationTimeConfidence: PublicationTimeConfidence;
  discoveredAt: Date;
  fetchedAt: Date;
  rawMetadata: Record<string, unknown>;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function normalizeContent(
  value: string | undefined,
  format: ContentFormat,
): string | null {
  if (format === "html") {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
  return normalizeText(value);
}

function normalizeMediaAssets(
  assets: SourceMediaAsset[] | undefined,
): SourceMediaAsset[] {
  const seen = new Set<string>();
  const normalized: SourceMediaAsset[] = [];

  for (const asset of assets ?? []) {
    let url: URL;
    try {
      url = new URL(asset.url);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(url.protocol) || seen.has(url.href)) {
      continue;
    }
    seen.add(url.href);
    normalized.push({ ...asset, url: url.href });
  }

  return normalized.slice(0, 12);
}

function parsePublicationTime(
  value: Date | string | null | undefined,
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeItem(input: {
  sourceId: string;
  raw: RawSourceItem;
  fetchedAt: Date;
  discoveredAt?: Date;
}): NormalizedItem {
  const title = normalizeText(input.raw.title);
  if (!title) {
    throw new Error("Source item title is required");
  }

  const canonicalUrl = canonicalizeUrl(input.raw.url);
  const sourcePublishedAt = parsePublicationTime(input.raw.publishedAt);
  const excerpt = normalizeText(input.raw.excerpt);
  const contentFormat = input.raw.contentFormat ?? "text";
  const content = normalizeContent(input.raw.content, contentFormat);
  const mediaAssets = normalizeMediaAssets(input.raw.mediaAssets);
  const originalTitle = normalizeText(input.raw.originalTitle);
  const author = normalizeText(input.raw.author);

  const requestedConfidence = input.raw.publicationTimeConfidence;
  const publicationTimeConfidence = sourcePublishedAt
    ? (requestedConfidence ?? "exact")
    : "unknown";

  const contentFingerprint = [title, excerpt ?? "", content ?? ""]
    .join("\n")
    .toLowerCase();

  return {
    sourceId: input.sourceId,
    externalId: input.raw.externalId?.trim() || null,
    contentType: input.raw.contentType,
    title,
    originalTitle,
    excerpt,
    content,
    contentFormat,
    mediaAssets,
    author,
    language: input.raw.language?.trim().toLowerCase() || null,
    originalUrl: input.raw.url.trim(),
    canonicalUrl,
    canonicalUrlHash: sha256(canonicalUrl),
    contentHash: sha256(contentFingerprint),
    sourcePublishedAt,
    publicationTimeConfidence,
    discoveredAt: input.discoveredAt ?? input.fetchedAt,
    fetchedAt: input.fetchedAt,
    rawMetadata: input.raw.metadata ?? {},
  };
}
