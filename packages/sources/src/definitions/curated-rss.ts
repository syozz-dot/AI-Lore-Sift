import { RssSourceAdapter } from "../rss-adapter.js";
import type { ContentType, SourceDefinition } from "../types.js";

interface CuratedRssConfig {
  definition: SourceDefinition & { feedUrl: string };
  contentType: ContentType;
  maxItems?: number;
}

function createCuratedRssAdapter(
  config: CuratedRssConfig,
  fetchImpl?: typeof fetch,
): RssSourceAdapter {
  return new RssSourceAdapter({
    key: config.definition.connectorKey,
    feedUrl: config.definition.feedUrl,
    contentType: config.contentType,
    ...(config.definition.language
      ? { language: config.definition.language }
      : {}),
    maxItems: config.maxItems ?? 40,
    includeContent: config.definition.allowFullText,
    useContentAsExcerpt: true,
    maxExcerptCharacters: 1_800,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}

export const googleAiBlogSource = {
  key: "google-ai-blog",
  name: "Google AI Blog",
  type: "official_blog",
  reliability: "primary",
  connectorKey: "rss:google-ai-blog",
  homepageUrl: "https://blog.google/technology/ai/",
  feedUrl: "https://blog.google/technology/ai/rss/",
  language: "en",
  isFirstParty: true,
  allowFullText: false,
  fetchIntervalMinutes: 60,
} satisfies SourceDefinition;

export const googleDeepMindBlogSource = {
  key: "google-deepmind-blog",
  name: "Google DeepMind Blog",
  type: "official_blog",
  reliability: "primary",
  connectorKey: "rss:google-deepmind-blog",
  homepageUrl: "https://deepmind.google/discover/blog/",
  feedUrl: "https://deepmind.google/blog/rss.xml",
  language: "en",
  isFirstParty: true,
  allowFullText: false,
  fetchIntervalMinutes: 60,
} satisfies SourceDefinition;

export const hackerNewsAiSource = {
  key: "hacker-news-ai",
  name: "Hacker News AI",
  type: "hacker_news",
  reliability: "medium",
  connectorKey: "rss:hacker-news-ai",
  homepageUrl: "https://news.ycombinator.com/",
  feedUrl: "https://hnrss.org/newest?q=AI",
  language: "en",
  isFirstParty: false,
  allowFullText: false,
  fetchIntervalMinutes: 30,
} satisfies SourceDefinition;

export const techCrunchAiSource = {
  key: "techcrunch-ai",
  name: "TechCrunch AI",
  type: "media",
  reliability: "high",
  connectorKey: "rss:techcrunch-ai",
  homepageUrl: "https://techcrunch.com/category/artificial-intelligence/",
  feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/",
  language: "en",
  isFirstParty: false,
  allowFullText: false,
  fetchIntervalMinutes: 30,
} satisfies SourceDefinition;

export const arsTechnicaAiSource = {
  key: "ars-technica-ai",
  name: "Ars Technica AI",
  type: "media",
  reliability: "high",
  connectorKey: "rss:ars-technica-ai",
  homepageUrl: "https://arstechnica.com/ai/",
  feedUrl: "https://arstechnica.com/ai/feed/",
  language: "en",
  isFirstParty: false,
  allowFullText: false,
  fetchIntervalMinutes: 60,
} satisfies SourceDefinition;

export const ventureBeatAiSource = {
  key: "venturebeat-ai",
  name: "VentureBeat AI",
  type: "media",
  reliability: "high",
  connectorKey: "rss:venturebeat-ai",
  homepageUrl: "https://venturebeat.com/category/ai/",
  feedUrl: "https://venturebeat.com/category/ai/feed/",
  language: "en",
  isFirstParty: false,
  allowFullText: false,
  fetchIntervalMinutes: 30,
} satisfies SourceDefinition;

export const theDecoderSource = {
  key: "the-decoder",
  name: "The Decoder AI News",
  type: "media",
  reliability: "high",
  connectorKey: "rss:the-decoder",
  homepageUrl: "https://the-decoder.com/",
  feedUrl: "https://the-decoder.com/feed/",
  language: "en",
  isFirstParty: false,
  allowFullText: false,
  fetchIntervalMinutes: 30,
} satisfies SourceDefinition;

export function createGoogleAiBlogAdapter(fetchImpl?: typeof fetch) {
  return createCuratedRssAdapter(
    { definition: googleAiBlogSource, contentType: "news" },
    fetchImpl,
  );
}

export function createGoogleDeepMindBlogAdapter(fetchImpl?: typeof fetch) {
  return createCuratedRssAdapter(
    { definition: googleDeepMindBlogSource, contentType: "news" },
    fetchImpl,
  );
}

export function createHackerNewsAiAdapter(fetchImpl?: typeof fetch) {
  return createCuratedRssAdapter(
    { definition: hackerNewsAiSource, contentType: "post" },
    fetchImpl,
  );
}

export function createTechCrunchAiAdapter(fetchImpl?: typeof fetch) {
  return createCuratedRssAdapter(
    { definition: techCrunchAiSource, contentType: "news" },
    fetchImpl,
  );
}

export function createArsTechnicaAiAdapter(fetchImpl?: typeof fetch) {
  return createCuratedRssAdapter(
    { definition: arsTechnicaAiSource, contentType: "news" },
    fetchImpl,
  );
}

export function createVentureBeatAiAdapter(fetchImpl?: typeof fetch) {
  return createCuratedRssAdapter(
    { definition: ventureBeatAiSource, contentType: "news" },
    fetchImpl,
  );
}

export function createTheDecoderAdapter(fetchImpl?: typeof fetch) {
  return createCuratedRssAdapter(
    { definition: theDecoderSource, contentType: "news" },
    fetchImpl,
  );
}
