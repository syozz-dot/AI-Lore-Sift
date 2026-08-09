import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import { RssSourceAdapter } from "./rss-adapter.js";

const fixture = await readFile(
  new URL("./fixtures/openai-news.xml", import.meta.url),
  "utf8",
);

function fixtureFetch(): typeof fetch {
  return vi.fn(async () =>
    Promise.resolve(
      new Response(fixture, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      }),
    ),
  );
}

describe("RssSourceAdapter", () => {
  it("maps RSS items while preserving source publication time", async () => {
    const adapter = new RssSourceAdapter({
      key: "rss:test",
      feedUrl: "https://example.com/rss.xml",
      contentType: "news",
      language: "en",
      fetchImpl: fixtureFetch(),
    });

    const items = await adapter.fetch({
      now: new Date("2026-07-16T04:00:00Z"),
    });

    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({
      externalId: "https://openai.com/index/first-update",
      title: "First official update",
      excerpt: "Research & release details.",
      author: "OpenAI",
      language: "en",
      publishedAt: new Date("2026-07-16T03:00:00Z"),
      publicationTimeConfidence: "exact",
      metadata: {
        feedUrl: "https://example.com/rss.xml",
        categories: ["Research", "Product"],
      },
    });
    expect(items[0]?.content).toBeUndefined();
  });

  it("filters old entries before applying the safety limit", async () => {
    const adapter = new RssSourceAdapter({
      key: "rss:test",
      feedUrl: "https://example.com/rss.xml",
      contentType: "news",
      maxItems: 1,
      fetchImpl: fixtureFetch(),
    });

    const items = await adapter.fetch({
      now: new Date("2026-07-16T04:00:00Z"),
      since: new Date("2026-07-15T13:00:00Z"),
    });

    expect(items.map((item) => item.title)).toEqual(["First official update"]);
  });

  it("surfaces HTTP failures to source-run health tracking", async () => {
    const fetchImpl: typeof fetch = vi.fn(async () =>
      Promise.resolve(new Response("unavailable", { status: 503 })),
    );
    const adapter = new RssSourceAdapter({
      key: "rss:test",
      feedUrl: "https://example.com/rss.xml",
      contentType: "news",
      fetchImpl,
    });

    await expect(
      adapter.fetch({ now: new Date("2026-07-16T04:00:00Z") }),
    ).rejects.toThrow("RSS request failed with 503");
  });

  it("supports Atom entries and rejects a non-feed response", async () => {
    const atom = `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom &amp; update</title>
          <link rel="alternate" href="https://example.com/atom-update" />
          <id>atom-1</id>
          <published>2026-07-16T02:30:00Z</published>
          <author><name>Example Author</name></author>
          <category term="Research" />
        </entry>
      </feed>`;
    const atomAdapter = new RssSourceAdapter({
      key: "atom:test",
      feedUrl: "https://example.com/atom.xml",
      contentType: "post",
      fetchImpl: vi.fn(async () => Promise.resolve(new Response(atom))),
    });

    await expect(
      atomAdapter.fetch({ now: new Date("2026-07-16T04:00:00Z") }),
    ).resolves.toEqual([
      expect.objectContaining({
        title: "Atom & update",
        url: "https://example.com/atom-update",
        author: "Example Author",
        publishedAt: new Date("2026-07-16T02:30:00Z"),
      }),
    ]);

    const htmlAdapter = new RssSourceAdapter({
      key: "rss:html",
      feedUrl: "https://example.com/rss.xml",
      contentType: "news",
      fetchImpl: vi.fn(async () =>
        Promise.resolve(new Response("<html><body>Not a feed</body></html>")),
      ),
    });

    await expect(
      htmlAdapter.fetch({ now: new Date("2026-07-16T04:00:00Z") }),
    ).rejects.toThrow("does not contain an RSS or Atom feed");
  });

  it("preserves allowed HTML content and extracts deduplicated media", async () => {
    const rss = `<?xml version="1.0"?>
      <rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
        <channel>
          <item>
            <title>Rich update</title>
            <link>https://example.com/rich</link>
            <content:encoded><![CDATA[
              <p>Full text</p>
              <img
                src="https://images.example.com/pixel.gif"
                data-original="https://images.example.com/diagram.png"
                alt="Provider benchmark chart"
                width="1280"
                height="720"
              />
            ]]></content:encoded>
            <enclosure url="https://images.example.com/diagram.png" type="image/png" />
          </item>
        </channel>
      </rss>`;
    const adapter = new RssSourceAdapter({
      key: "rss:rich",
      feedUrl: "https://example.com/rss.xml",
      contentType: "news",
      includeContent: true,
      fetchImpl: vi.fn(async () => Promise.resolve(new Response(rss))),
    });

    const [item] = await adapter.fetch({
      now: new Date("2026-07-16T04:00:00Z"),
    });

    expect(item).toMatchObject({
      contentFormat: "html",
      mediaAssets: [
        {
          type: "image",
          url: "https://images.example.com/diagram.png",
          alt: "Provider benchmark chart",
          width: 1280,
          height: 720,
        },
      ],
    });
    expect(item?.content).toContain("<p>Full text</p>");
  });
});
