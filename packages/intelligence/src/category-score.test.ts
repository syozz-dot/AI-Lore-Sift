import { describe, expect, it } from "vitest";

import {
  CATEGORY_SCORE_STANDARDS,
  scoreStoryWithinCategory,
} from "./category-score.js";

const now = new Date("2026-08-12T08:00:00Z");

describe("category-specific story scoring", () => {
  it("uses a stronger freshness standard for news than for models", () => {
    expect(CATEGORY_SCORE_STANDARDS.news.freshnessWeight).toBeGreaterThan(
      CATEGORY_SCORE_STANDARDS.model.freshnessWeight,
    );
    expect(CATEGORY_SCORE_STANDARDS.model.relevanceWeight).toBeGreaterThan(
      CATEGORY_SCORE_STANDARDS.news.relevanceWeight,
    );
  });

  it("penalizes stale news more strongly than stale models", () => {
    const shared = {
      relevanceScore: 0.85,
      publishedAt: "2026-07-29T08:00:00Z",
      independentSourceCount: 1,
      sourceReliability: "primary" as const,
      isFirstParty: true,
      now,
    };

    const news = scoreStoryWithinCategory({ ...shared, contentType: "news" });
    const model = scoreStoryWithinCategory({
      ...shared,
      contentType: "model",
    });

    expect(model).toBeGreaterThan(news);
  });

  it("rewards independent confirmation within the same category", () => {
    const base = {
      contentType: "news" as const,
      relevanceScore: 0.7,
      publishedAt: "2026-08-12T06:00:00Z",
      sourceReliability: "high" as const,
      isFirstParty: false,
      now,
    };

    expect(
      scoreStoryWithinCategory({ ...base, independentSourceCount: 3 }),
    ).toBeGreaterThan(
      scoreStoryWithinCategory({ ...base, independentSourceCount: 1 }),
    );
  });
});
