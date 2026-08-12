import { describe, expect, it } from "vitest";

import { buildDistillMarkdown } from "./distill-markdown";

describe("distill markdown export", () => {
  it("keeps the source and evidence references in the export", () => {
    const markdown = buildDistillMarkdown(
      {
        id: "document-1",
        title: "一份有证据锚点的脱水结果",
        sourceTitle: "Original title",
        sourceUrl: "https://example.com/article",
        sourceAuthor: "Author",
        verdict: "read",
        verdictReason: "原文的方法和证据值得完整阅读。",
        estimatedReadingMinutes: 12,
        summary: "这里是一份三分钟脱水。",
        keyPoints: [
          {
            title: "核心方法",
            detail: "作者提出了一种可以复用的方法。",
            evidenceParagraphs: [2, 4],
          },
        ],
        claims: [
          {
            claim: "材料明确描述了方法。",
            type: "fact",
            evidenceParagraphs: [2],
            confidence: "high",
          },
        ],
        transferableInsights: ["先建立证据，再生成结论。"],
        cautions: ["当前只有一个来源。"],
        followUpQuestions: ["是否存在独立验证？"],
        personalizedInsights: [
          {
            title: "可用于当前评测工作",
            detail: "先固定测试条件，再比较不同服务商。",
            basis: "profile",
            evidenceParagraphs: [2],
            knowledgeReferences: [
              {
                id: "knowledge-1",
                kind: "card",
                title: "服务商测试需要固定变量",
                sourceDocumentId: "document-history-1",
              },
            ],
          },
        ],
        createdAt: "2026-07-27T00:00:00.000Z",
      },
      "https://example.com/distill/document-1",
    );

    expect(markdown).toContain("https://example.com/article");
    expect(markdown).toContain("P2、P4");
    expect(markdown).toContain("## 阅读边界");
    expect(markdown).toContain("## 与我的目标有关");
    expect(markdown).toContain("关联历史：服务商测试需要固定变量");
  });
});
