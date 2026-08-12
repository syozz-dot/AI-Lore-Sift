import { describe, expect, it, vi } from "vitest";

import {
  createYouTubeChannelAdapters,
  youtubeChannelConfigs,
  youtubeChannelSources,
} from "./youtube-channels.js";

describe("YouTube channel sources", () => {
  it("registers unique first-party feeds with matching adapters", () => {
    const adapters = createYouTubeChannelAdapters(vi.fn<typeof fetch>());

    expect(youtubeChannelSources).toHaveLength(5);
    expect(
      new Set(youtubeChannelSources.map((source) => source.key)).size,
    ).toBe(5);
    expect(
      new Set(youtubeChannelConfigs.map((config) => config.channelId)).size,
    ).toBe(5);

    for (const [index, source] of youtubeChannelSources.entries()) {
      expect(source).toMatchObject({
        type: "media",
        reliability: "primary",
        isFirstParty: true,
        allowFullText: false,
      });
      expect(source.feedUrl).toMatch(
        /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?channel_id=UC/u,
      );
      expect(adapters[index]?.key).toBe(source.connectorKey);
    }
  });

  it("parses YouTube Atom descriptions and thumbnails without an API key", async () => {
    const feed = `<?xml version="1.0" encoding="UTF-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom"
        xmlns:media="http://search.yahoo.com/mrss/"
        xmlns:yt="http://www.youtube.com/xml/schemas/2015">
        <entry>
          <id>yt:video:video-1</id>
          <yt:videoId>video-1</yt:videoId>
          <title>Building reliable AI agents</title>
          <link rel="alternate" href="https://www.youtube.com/watch?v=video-1" />
          <author><name>OpenAI</name></author>
          <published>2026-08-12T01:00:00Z</published>
          <media:group>
            <media:thumbnail url="https://i.ytimg.com/vi/video-1/hqdefault.jpg" width="480" height="360" />
            <media:description>A practical discussion about agent reliability.</media:description>
          </media:group>
        </entry>
      </feed>`;
    const adapters = createYouTubeChannelAdapters(
      vi.fn(async () => Promise.resolve(new Response(feed))),
    );

    await expect(
      adapters[0]?.fetch({ now: new Date("2026-08-12T02:00:00Z") }),
    ).resolves.toEqual([
      expect.objectContaining({
        contentType: "post",
        title: "Building reliable AI agents",
        url: "https://www.youtube.com/watch?v=video-1",
        excerpt: "A practical discussion about agent reliability.",
        author: "OpenAI",
        mediaAssets: [
          expect.objectContaining({
            type: "image",
            url: "https://i.ytimg.com/vi/video-1/hqdefault.jpg",
            width: 480,
            height: 360,
          }),
        ],
      }),
    ]);
  });
});
