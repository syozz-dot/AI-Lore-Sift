import { describe, expect, it, vi } from "vitest";

import { AiHotSocialAdapter } from "./aihot-social-adapter.js";

describe("AIHOT social adapter", () => {
  it("keeps selected X and WeChat items with original links and attribution", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "x-1",
              title: "一条 X 精选动态",
              originalTitle: "Original X post",
              summary: "这是摘要。",
              source: { name: "X：OpenAI (@OpenAI)" },
              links: {
                aihot: "https://aihot.virxact.com/items/x-1",
                original: "https://x.com/OpenAI/status/1",
              },
              category: "industry",
              publishedAt: "2026-07-27T01:00:00.000Z",
              selected: true,
              score: 88,
              attribution: {
                name: "AI HOT",
                url: "https://aihot.virxact.com/items/x-1",
              },
            },
            {
              id: "wx-1",
              title: "一条公众号精选内容",
              source: { name: "公众号：机器之心" },
              links: {
                aihot: "https://aihot.virxact.com/items/wx-1",
                original: "https://mp.weixin.qq.com/s/example",
              },
              category: "paper",
              discoveredAt: "2026-07-27T00:30:00.000Z",
            },
            {
              id: "rss-1",
              title: "普通 RSS 内容",
              source: { name: "IT之家（RSS）" },
              links: {
                aihot: "https://aihot.virxact.com/items/rss-1",
                original: "https://example.com/rss-1",
              },
              category: "industry",
            },
          ],
          page: { hasMore: false, nextCursor: null },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const adapter = new AiHotSocialAdapter({
      key: "aihot:selected-social",
      fetchImpl,
    });

    const items = await adapter.fetch({
      now: new Date("2026-07-27T02:00:00.000Z"),
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      externalId: "x-1",
      contentType: "news",
      originalTitle: "Original X post",
      url: "https://x.com/OpenAI/status/1",
      author: "X：OpenAI (@OpenAI)",
      publicationTimeConfidence: "exact",
      metadata: {
        platform: "x",
        aggregator: "AIHOT",
        attributionName: "AI HOT",
        aihotCanonical: "https://aihot.virxact.com/items/x-1",
        aihotScore: 88,
      },
    });
    expect(items[1]).toMatchObject({
      externalId: "wx-1",
      contentType: "paper",
      url: "https://mp.weixin.qq.com/s/example",
      publicationTimeConfidence: "inferred",
      metadata: {
        platform: "wechat",
        aihotCanonical: "https://aihot.virxact.com/items/wx-1",
      },
    });
  });

  it("paginates until it finds a social item", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "rss-1",
                title: "普通 RSS 内容",
                source: { name: "媒体（RSS）" },
                links: { original: "https://example.com/rss-1" },
              },
            ],
            page: { hasMore: true, nextCursor: "next-page" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "x-2",
                title: "第二页 X 内容",
                source: { name: "X: Anthropic (@AnthropicAI)" },
                links: { original: "https://x.com/AnthropicAI/status/2" },
              },
            ],
            page: { hasMore: false, nextCursor: null },
          }),
          { status: 200 },
        ),
      );
    const adapter = new AiHotSocialAdapter({
      key: "aihot:selected-social",
      fetchImpl,
      pageSize: 1,
    });

    const items = await adapter.fetch({ now: new Date() });

    expect(items).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain("cursor=next-page");
  });
});
