import { describe, expect, it } from "vitest";

import { decodeRouteSegment } from "./route-params";

describe("decodeRouteSegment", () => {
  it("decodes encoded Chinese story slugs", () => {
    expect(
      decodeRouteSegment(
        "kimi-%E5%8F%91%E5%B8%83%E8%A7%86%E8%A7%89%E6%84%9F%E7%9F%A5",
      ),
    ).toBe("kimi-发布视觉感知");
  });

  it("keeps already decoded and malformed values usable", () => {
    expect(decodeRouteSegment("kimi-发布视觉感知")).toBe("kimi-发布视觉感知");
    expect(decodeRouteSegment("%E0%A4%A")).toBe("%E0%A4%A");
  });
});
