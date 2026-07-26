import { describe, expect, it, vi } from "vitest";

import { XSourceAdapter } from "./x-adapter.js";

describe("XSourceAdapter", () => {
  it("maps curated posts, authors and expanded media", async () => {
    let requestedUrl = "";
    const fetchImpl: typeof fetch = vi.fn(async (input) => {
      requestedUrl = String(input);
      return Promise.resolve(
        Response.json({
          data: [
            {
              id: "123",
              text: "A multimodal model is now available.",
              author_id: "user-1",
              created_at: "2026-07-27T04:00:00.000Z",
              lang: "en",
              attachments: { media_keys: ["media-1"] },
            },
          ],
          includes: {
            users: [{ id: "user-1", name: "OpenAI", username: "OpenAI" }],
            media: [
              {
                media_key: "media-1",
                type: "photo",
                url: "https://pbs.twimg.com/media/example.jpg",
                width: 1200,
                height: 675,
              },
            ],
          },
        }),
      );
    });
    const adapter = new XSourceAdapter({
      key: "x:test",
      bearerToken: "test-token",
      accounts: ["OpenAI"],
      fetchImpl,
    });

    await expect(
      adapter.fetch({ now: new Date("2026-07-27T05:00:00.000Z") }),
    ).resolves.toEqual([
      expect.objectContaining({
        externalId: "123",
        author: "OpenAI (@OpenAI)",
        url: "https://x.com/OpenAI/status/123",
        mediaAssets: [
          expect.objectContaining({
            type: "image",
            url: "https://pbs.twimg.com/media/example.jpg",
          }),
        ],
      }),
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(requestedUrl).toContain("from%3AOpenAI");
  });
});
