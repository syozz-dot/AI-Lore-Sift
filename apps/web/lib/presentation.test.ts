import { describe, expect, it } from "vitest";

import {
  categoryScoreLabel,
  formatCalendarDate,
  selectFeedInterpretation,
  signalLabel,
} from "./presentation.js";

describe("Chinese rule presentation", () => {
  it("translates current deterministic signal identifiers", () => {
    expect(signalLabel("ai:agents")).toBe("智能体");
    expect(signalLabel("product:safety-policy")).toBe("安全与治理");
  });

  it("labels scores by content category", () => {
    expect(categoryScoreLabel("model")).toBe("模型评分");
    expect(categoryScoreLabel("product")).toBe("产品评分");
    expect(categoryScoreLabel(null)).toBe("类别评分");
  });

  it("does not present rule metadata as product meaning", () => {
    expect(
      selectFeedInterpretation({
        contentType: "paper",
        excerpt: "Original paper abstract",
        factualSummary: null,
        whyItMatters: null,
      }),
    ).toBeNull();
  });

  it("keeps a real product description while analysis is pending", () => {
    expect(
      selectFeedInterpretation({
        contentType: "product",
        excerpt: "A real product description",
        factualSummary: null,
        whyItMatters: null,
      }),
    ).toBe("A real product description");
  });

  it("formats an issue date in the Shanghai calendar without timezone drift", () => {
    expect(formatCalendarDate("2026-07-19")).toContain("2026年7月19日");
  });
});
