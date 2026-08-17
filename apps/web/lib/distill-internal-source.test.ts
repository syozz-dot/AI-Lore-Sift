import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isInternalSiteUrl,
  resolveInternalStorySource,
} from "./distill-internal-source";

function storyRecord() {
  return {
    title: "Anthropic CEO on AI trust",
    translatedTitle: "Anthropic CEO 谈 AI 信任危机",
    factualSummary: "文章讨论公众对 AI 公司的信任下降，以及企业需要如何回应。",
    excerpt: "公众反弹不仅是技术问题，也与企业透明度有关。",
    contentType: "news",
    sourceName: "测试信源",
    primaryAuthor: "测试作者",
    sourceContent: null,
    sourceContentFormat: "text" as const,
    sourceAllowsFullText: false,
    analysis: {
      translatedTitle: "Anthropic CEO 谈 AI 信任危机",
      factualSummary:
        "文章讨论公众对 AI 公司的信任下降，以及企业需要如何回应。",
      whyItMatters:
        "AI 产品的接受度不仅由能力决定，也取决于可解释性和治理承诺。",
      underlyingLogic:
        "当技术影响扩大而决策过程不透明时，用户会把不确定性转化为不信任。",
      productImpact: "产品团队需要把透明度、可控性和申诉路径纳入核心体验。",
      productOpportunities: ["建立面向用户的模型行为说明与风险反馈闭环。"],
      openQuestions: ["文中没有提供信任变化的长期量化数据。"],
    },
    evidence: [
      {
        title: "原始报道",
        excerpt: "报道引用了 CEO 对 AI 信任问题的完整回应。",
        sourceName: "测试媒体",
        originalUrl: "https://example.com/source",
      },
    ],
  };
}

describe("internal Story distill source", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recognizes production, staging, backup, and configured site hosts", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");

    expect(isInternalSiteUrl(new URL("https://ailoresift.com/stories/a"))).toBe(
      true,
    );
    expect(
      isInternalSiteUrl(new URL("https://www.ailoresift.com/stories/a")),
    ).toBe(true);
    expect(
      isInternalSiteUrl(new URL("https://staging.ailoresift.com/stories/a")),
    ).toBe(true);
    expect(
      isInternalSiteUrl(
        new URL("https://ai-news-navigator-web.vercel.app/stories/a"),
      ),
    ).toBe(true);
    expect(isInternalSiteUrl(new URL("http://localhost:3000/stories/a"))).toBe(
      true,
    );
    expect(isInternalSiteUrl(new URL("https://example.com/stories/a"))).toBe(
      false,
    );
  });

  it("builds a readable source directly from a Story record", async () => {
    const loadStory = vi.fn(async () => storyRecord());
    const source = await resolveInternalStorySource(
      new URL("https://ailoresift.com/stories/trust-story"),
      loadStory,
    );

    expect(loadStory).toHaveBeenCalledWith("trust-story");
    expect(source?.sourceTitle).toBe("Anthropic CEO 谈 AI 信任危机");
    expect(source?.sourceAuthor).toBe("测试作者");
    expect(source?.rawText).toContain("为什么重要");
    expect(source?.rawText).toContain("来源证据");
    expect(source?.paragraphs.length).toBeGreaterThan(2);
  });

  it("returns null for external URLs without consulting the database", async () => {
    const loadStory = vi.fn(async () => storyRecord());

    await expect(
      resolveInternalStorySource(
        new URL("https://example.com/stories/trust-story"),
        loadStory,
      ),
    ).resolves.toBeNull();
    expect(loadStory).not.toHaveBeenCalled();
  });

  it("reports missing or unsupported internal pages clearly", async () => {
    const loadStory = vi.fn(async () => null);

    await expect(
      resolveInternalStorySource(
        new URL("https://ailoresift.com/stories/missing-story"),
        loadStory,
      ),
    ).rejects.toThrow("没有找到该站内 Story");
    await expect(
      resolveInternalStorySource(
        new URL("https://ailoresift.com/topics/agents"),
        loadStory,
      ),
    ).rejects.toThrow("站内链接目前仅支持 Story 详情页");
  });
});
