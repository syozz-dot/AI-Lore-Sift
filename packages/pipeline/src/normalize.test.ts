import { describe, expect, it } from "vitest";

import { normalizeItem } from "./normalize.js";

describe("normalizeItem", () => {
  it("keeps source publication time separate from discovery time", () => {
    const fetchedAt = new Date("2026-07-16T08:00:00.000Z");
    const item = normalizeItem({
      sourceId: "source-1",
      fetchedAt,
      raw: {
        contentType: "news",
        title: "  A new model launches  ",
        url: "https://example.com/model?utm_medium=social",
        excerpt: "A concise   summary.",
        publishedAt: "2026-07-15T10:30:00.000Z",
      },
    });

    expect(item.title).toBe("A new model launches");
    expect(item.excerpt).toBe("A concise summary.");
    expect(item.canonicalUrl).toBe("https://example.com/model");
    expect(item.sourcePublishedAt?.toISOString()).toBe(
      "2026-07-15T10:30:00.000Z",
    );
    expect(item.discoveredAt).toEqual(fetchedAt);
    expect(item.publicationTimeConfidence).toBe("exact");
  });

  it("marks invalid publication timestamps as unknown", () => {
    const item = normalizeItem({
      sourceId: "source-1",
      fetchedAt: new Date("2026-07-16T08:00:00.000Z"),
      raw: {
        contentType: "post",
        title: "A post without a reliable timestamp",
        url: "https://example.com/post",
        publishedAt: "not-a-date",
        publicationTimeConfidence: "exact",
      },
    });

    expect(item.sourcePublishedAt).toBeNull();
    expect(item.publicationTimeConfidence).toBe("unknown");
  });

  it("preserves HTML structure and rejects unsafe media URLs", () => {
    const item = normalizeItem({
      sourceId: "source-1",
      fetchedAt: new Date("2026-07-16T08:00:00.000Z"),
      raw: {
        contentType: "post",
        title: "Rich post",
        url: "https://example.com/post",
        content: "<p>First</p>\n<p>Second</p>",
        contentFormat: "html",
        mediaAssets: [
          { type: "image", url: "https://images.example.com/cover.jpg" },
          { type: "image", url: "javascript:alert(1)" },
        ],
      },
    });

    expect(item.content).toBe("<p>First</p>\n<p>Second</p>");
    expect(item.contentFormat).toBe("html");
    expect(item.mediaAssets).toEqual([
      { type: "image", url: "https://images.example.com/cover.jpg" },
    ]);
  });
});
