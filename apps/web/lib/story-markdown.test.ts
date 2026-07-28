import { describe, expect, it } from "vitest";

import { buildStoryMarkdown, type StoryMarkdownInput } from "./story-markdown";

const story: StoryMarkdownInput = {
  slug: "example-story",
  title: "示例中文标题",
  originalTitle: "Example original title",
  contentType: "模型",
  sourceName: "Example Source",
  publishedAt: "2026年7月20日 09:00",
  relevanceScore: "88",
  sourceCount: 1,
  status: "已确认",
  factualSummary: "发生了一项可验证的更新。",
  whyItMatters: "它降低了产品接入成本。",
  underlyingLogic: null,
  productImpact: "团队可以更快完成集成。",
  productOpportunities: ["验证新的工作流。"],
  openQuestions: ["真实环境表现如何？"],
  matchedSignals: ["模型发布"],
  analysisProvider: "deepseek",
  analysisModel: "deepseek-v4-flash",
  evidence: [
    {
      sourceName: "Example Source",
      title: "Primary source",
      url: "https://example.com/source",
      publishedAt: "2026年7月20日 08:00",
      contentType: "模型",
      relevanceScore: "90",
      excerpt: "原始来源摘要。",
    },
  ],
};

describe("buildStoryMarkdown", () => {
  it("exports analysis and complete source metadata", () => {
    const markdown = buildStoryMarkdown(
      story,
      "https://navigator.test/stories/example-story",
    );

    expect(markdown).toContain('primary_source: "Example Source"');
    expect(markdown).toContain('url: "https://example.com/source"');
    expect(markdown).toContain("## 来源证据");
    expect(markdown).toContain("[Primary source](https://example.com/source)");
    expect(markdown).toContain("## 为什么重要");
    expect(markdown).not.toContain("## 底层逻辑");
  });

  it("uses product-oriented section labels for product stories", () => {
    const markdown = buildStoryMarkdown({
      ...story,
      contentType: "产品",
      underlyingLogic: "它通过结构化工作流完成任务。",
    });

    expect(markdown).toContain("## 产品速览");
    expect(markdown).toContain("## 为什么值得试");
    expect(markdown).toContain("## 核心能力");
    expect(markdown).toContain("## 适合谁与使用场景");
    expect(markdown).toContain("## 建议尝试的用法");
    expect(markdown).toContain("## 上手前待确认");
    expect(markdown).not.toContain("## 产品与商业机会");
  });
});
