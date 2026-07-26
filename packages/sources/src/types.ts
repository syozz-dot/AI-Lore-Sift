export type SourceType =
  | "official_blog"
  | "rss"
  | "arxiv"
  | "github"
  | "product_hunt"
  | "hacker_news"
  | "media"
  | "social"
  | "other";

export type SourceReliability = "primary" | "high" | "medium" | "low";

export type ContentType =
  "news" | "paper" | "product" | "model" | "release" | "post" | "other";

export type PublicationTimeConfidence = "exact" | "inferred" | "unknown";

export type ContentFormat = "text" | "html";

export interface SourceMediaAsset {
  type: "image" | "video" | "audio";
  url: string;
  previewUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface SourceDefinition {
  key: string;
  name: string;
  type: SourceType;
  reliability: SourceReliability;
  connectorKey: string;
  homepageUrl: string;
  language?: string;
  feedUrl?: string;
  isFirstParty: boolean;
  allowFullText: boolean;
  fetchIntervalMinutes: number;
}

export interface RawSourceItem {
  externalId?: string;
  contentType: ContentType;
  title: string;
  originalTitle?: string;
  url: string;
  excerpt?: string;
  content?: string;
  contentFormat?: ContentFormat;
  mediaAssets?: SourceMediaAsset[];
  author?: string;
  language?: string;
  publishedAt?: Date | string | null;
  publicationTimeConfidence?: PublicationTimeConfidence;
  metadata?: Record<string, unknown>;
}

export interface SourceFetchContext {
  now: Date;
  since?: Date;
}

export interface SourceAdapter {
  readonly key: string;
  fetch(context: SourceFetchContext): Promise<RawSourceItem[]>;
}
