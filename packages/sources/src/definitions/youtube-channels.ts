import { RssSourceAdapter } from "../rss-adapter.js";
import type { SourceDefinition } from "../types.js";

interface YouTubeChannelConfig {
  slug: string;
  name: string;
  handle: string;
  channelId: string;
}

const YOUTUBE_FEED_BASE_URL = "https://www.youtube.com/feeds/videos.xml";

export const youtubeChannelConfigs = [
  {
    slug: "openai",
    name: "OpenAI",
    handle: "OpenAI",
    channelId: "UCXZCJLdBC09xxGZ6gcdrc6A",
  },
  {
    slug: "anthropic",
    name: "Anthropic",
    handle: "anthropic-ai",
    channelId: "UCrDwWp7EBBv4NwvScIpBDOA",
  },
  {
    slug: "google-deepmind",
    name: "Google DeepMind",
    handle: "GoogleDeepMind",
    channelId: "UCP7jMXSY2xbc3KCAE0MHQ-A",
  },
  {
    slug: "hugging-face",
    name: "Hugging Face",
    handle: "HuggingFace",
    channelId: "UCHlNU7kIZhRgSbhHvFoy72w",
  },
  {
    slug: "nvidia-developer",
    name: "NVIDIA Developer",
    handle: "NVIDIADeveloper",
    channelId: "UCBHcMCGaiJhv-ESTcWGJPcw",
  },
] as const satisfies readonly YouTubeChannelConfig[];

export const youtubeChannelSources = youtubeChannelConfigs.map(
  (config) =>
    ({
      key: `youtube-${config.slug}`,
      name: `YouTube · ${config.name}`,
      type: "media",
      reliability: "primary",
      connectorKey: `rss:youtube:${config.slug}`,
      homepageUrl: `https://www.youtube.com/@${config.handle}`,
      feedUrl: `${YOUTUBE_FEED_BASE_URL}?channel_id=${config.channelId}`,
      language: "en",
      isFirstParty: true,
      allowFullText: false,
      fetchIntervalMinutes: 60,
    }) satisfies SourceDefinition,
);

export function createYouTubeChannelAdapters(fetchImpl?: typeof fetch) {
  return youtubeChannelSources.map(
    (definition) =>
      new RssSourceAdapter({
        key: definition.connectorKey,
        feedUrl: definition.feedUrl ?? "",
        contentType: "post",
        language: "en",
        maxItems: 15,
        includeContent: false,
        useContentAsExcerpt: true,
        maxExcerptCharacters: 1_500,
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
  );
}
