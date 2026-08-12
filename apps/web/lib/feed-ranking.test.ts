import { describe, expect, it } from "vitest";

import type { StoryFeedItem } from "./queries";
import { balanceStoryFeed } from "./feed-ranking";

function story(
  id: string,
  contentType: StoryFeedItem["contentType"],
  categoryScore: number,
): StoryFeedItem {
  return {
    id,
    slug: id,
    status: "emerging",
    title: id,
    translatedTitle: null,
    factualSummary: null,
    firstPublishedAt: new Date("2026-08-12T00:00:00Z"),
    lastPublishedAt: new Date("2026-08-12T00:00:00Z"),
    independentSourceCount: 1,
    relevanceScore: categoryScore,
    categoryScore,
    overallScore: null,
    confidence: null,
    primaryItemId: id,
    excerpt: null,
    originalUrl: null,
    contentType,
    sourceName: null,
    sourceSlug: null,
    matchedSignals: [],
    assessmentReasons: [],
    whyItMatters: null,
    hasAnalysis: false,
    topics: [],
  };
}

describe("balanced story feed", () => {
  it("rotates categories instead of filling the top with one type", () => {
    const ranked = balanceStoryFeed([
      story("model-1", "model", 0.99),
      story("model-2", "model", 0.98),
      story("model-3", "model", 0.97),
      story("news-1", "news", 0.7),
      story("product-1", "product", 0.68),
      story("paper-1", "paper", 0.65),
    ]);

    expect(ranked.slice(0, 4).map((item) => item.contentType)).toEqual([
      "news",
      "product",
      "model",
      "paper",
    ]);
    expect(ranked.at(-1)?.id).toBe("model-3");
  });

  it("keeps higher category scores first within a category", () => {
    const ranked = balanceStoryFeed([
      story("product-low", "product", 0.4),
      story("product-high", "product", 0.8),
    ]);

    expect(ranked.map((item) => item.id)).toEqual([
      "product-high",
      "product-low",
    ]);
  });
});
