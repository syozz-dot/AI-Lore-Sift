import { describe, expect, it } from "vitest";

import {
  DISTILL_V2_EVALUATION_CASES,
  evaluateDistillOutput,
} from "./distill-evaluation";

describe("Distill V2 evaluation contract", () => {
  it("covers the six planned material families", () => {
    expect(
      new Set(DISTILL_V2_EVALUATION_CASES.map((item) => item.kind)),
    ).toEqual(
      new Set([
        "product_release",
        "technical_report",
        "engineering_practice",
        "industry_analysis",
        "opinion",
        "low_information_promotion",
      ]),
    );
  });

  it("flags promotional overclaiming and forced knowledge cards", () => {
    const promotional = DISTILL_V2_EVALUATION_CASES.find(
      (item) => item.id === "promotional-copy",
    );
    expect(promotional).toBeDefined();
    const result = evaluateDistillOutput(promotional!, {
      verdict: "read",
      text: "这是一款划时代产品，值得持续关注。",
      transferableInsights: ["每个产品都应全面重塑工作方式。"],
      evidenceReferences: [[]],
    });
    expect(result.verdict).toBe(false);
    expect(result.forbidden).toContain("划时代");
    expect(result.insightCount).toBe(false);
    expect(result.evidence).toBe(false);
  });

  it("does not treat an empty evidence set as passing", () => {
    const productRelease = DISTILL_V2_EVALUATION_CASES.find(
      (item) => item.id === "product-release-thin",
    );
    expect(productRelease).toBeDefined();
    const result = evaluateDistillOutput(productRelease!, {
      verdict: "skim",
      text: "功能已上线，但缺少技术与限制信息。",
      transferableInsights: [],
      evidenceReferences: [],
    });
    expect(result.evidence).toBe(false);
  });
});
