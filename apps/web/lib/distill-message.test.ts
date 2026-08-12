import { describe, expect, it } from "vitest";

import { distillMessageBlocks } from "./distill-message";

describe("distill follow-up message formatting", () => {
  it("attaches orphan bullet markers to the following paragraph", () => {
    expect(
      distillMessageBlocks(
        "建议覆盖四个维度： -\n\n短提示与长提示。\n\n-\n\n易提示与难提示。",
      ),
    ).toEqual([
      { kind: "paragraph", content: "建议覆盖四个维度：" },
      {
        kind: "list",
        content: ["短提示与长提示。", "易提示与难提示。"],
      },
    ]);
  });

  it("keeps numbered points together and removes inline markdown", () => {
    expect(
      distillMessageBlocks(
        "直接答案。\n\n1. **短提示**：记录首 token 延迟。\n2. 长提示：记录吞吐量。",
      ),
    ).toEqual([
      { kind: "paragraph", content: "直接答案。" },
      {
        kind: "list",
        content: ["短提示：记录首 token 延迟。", "长提示：记录吞吐量。"],
      },
    ]);
  });
});
