import { describe, expect, it } from "vitest";

import { selectPromotedStoryMedia } from "./story-media";

describe("selectPromotedStoryMedia", () => {
  it("promotes a product image and filters decorative assets", () => {
    const selected = selectPromotedStoryMedia(
      [
        {
          type: "image",
          url: "https://example.com/logo.png",
          width: 120,
          height: 120,
        },
        {
          type: "image",
          url: "https://example.com/product-shot.jpg?utm_source=rss",
          width: 1600,
          height: 900,
          alt: "产品界面",
        },
      ],
      { contentType: "product", sourceName: "Product Hunt" },
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.imageUrl).toContain("product-shot.jpg");
  });

  it("uses video previews and rejects profile images", () => {
    const selected = selectPromotedStoryMedia(
      [
        {
          type: "image",
          url: "https://pbs.twimg.com/profile_images/account.jpg",
          width: 800,
          height: 800,
        },
        {
          type: "video",
          url: "https://video.twimg.com/video.mp4",
          previewUrl: "https://pbs.twimg.com/media/preview.jpg",
          width: 1280,
          height: 720,
        },
      ],
      { contentType: "news", sourceName: "AIHOT · X" },
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.type).toBe("video");
  });

  it("keeps ordinary news text-only", () => {
    expect(
      selectPromotedStoryMedia(
        [
          {
            type: "image",
            url: "https://example.com/news.jpg",
            width: 1200,
            height: 630,
          },
        ],
        { contentType: "news", sourceName: "OpenAI News" },
      ),
    ).toEqual([]);
  });
});
