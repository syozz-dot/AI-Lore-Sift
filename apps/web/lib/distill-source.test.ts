import { describe, expect, it } from "vitest";

import { prepareDistillSource, splitDistillParagraphs } from "./distill-source";

describe("distill source preparation", () => {
  it("turns pasted text into stable evidence paragraphs", async () => {
    const source = await prepareDistillSource(
      [
        "第一段说明问题背景和为什么需要新的处理方法。",
        "第二段给出具体做法，并说明输入、处理和输出之间的关系。",
        "第三段描述当前证据边界，提醒读者不要把推断当成事实。",
      ].join("\n\n"),
    );

    expect(source.sourceType).toBe("text");
    expect(source.sourceUrl).toBeNull();
    expect(source.paragraphs).toHaveLength(3);
    expect(source.paragraphs[1]).toContain("具体做法");
  });

  it("splits a long single block without losing its reading order", () => {
    const paragraphs = splitDistillParagraphs(
      "这是第一句话，用来说明背景。".repeat(18) +
        "这是第二部分，用来补充方法和结果。".repeat(18),
    );

    expect(paragraphs.length).toBeGreaterThan(1);
    expect(paragraphs.join(" ")).toContain("补充方法和结果");
  });
});
