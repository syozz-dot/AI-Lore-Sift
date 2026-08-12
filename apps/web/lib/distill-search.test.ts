import { describe, expect, it } from "vitest";

import {
  normalizePrivateSearchQuery,
  privateSearchPattern,
} from "./distill-search";

describe("private search query", () => {
  it("normalizes whitespace and caps the query", () => {
    expect(normalizePrivateSearchQuery("  Agent   workflow  ")).toBe(
      "Agent workflow",
    );
    expect(normalizePrivateSearchQuery("x".repeat(200))).toHaveLength(120);
  });

  it("returns no pattern for empty or invalid values", () => {
    expect(privateSearchPattern("   ")).toBeNull();
    expect(privateSearchPattern(null)).toBeNull();
    expect(privateSearchPattern("模型评测")).toBe("%模型评测%");
    expect(privateSearchPattern("100%_ready")).toBe("%100\\%\\_ready%");
  });
});
