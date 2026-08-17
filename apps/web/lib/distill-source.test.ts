import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

import {
  parseReaderDocument,
  prepareDistillSource,
  splitDistillParagraphs,
} from "./distill-source";

describe("distill source preparation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

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

  it("keeps ordinary external pages on the bounded HTML fetch path", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          `<html><head><title>外部网页测试</title></head><body><main>
          <p>第一段介绍外部网页的背景和需要解决的问题，并解释为什么现有方案无法满足真实使用场景，确保正文信息足够完整。</p>
          <p>第二段说明具体做法、关键步骤与执行过程中需要保留的证据，同时列出输入、处理和输出之间可以复核的关系。</p>
          <p>第三段补充适用边界、潜在风险和后续可以继续验证的方向，避免读者把尚未确认的推断直接当成事实。</p>
        </main></body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const source = await prepareDistillSource("https://example.com/article");

    expect(source.sourceTitle).toBe("外部网页测试");
    expect(source.sourceUrl).toBe("https://example.com/article");
    expect(source.rawText).toContain("具体做法");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("allows a trusted internal resolver to bypass public self-fetching", async () => {
    const fetchMock = vi.fn();
    const resolveInternalUrl = vi.fn(async (url: URL) => ({
      sourceType: "url" as const,
      sourceUrl: url.toString(),
      sourceTitle: "站内 Story",
      sourceAuthor: "AILore Sift",
      rawText:
        "站内 Story 已直接从数据层读取，避免 Cloudflare Worker 通过公开域名再次请求自身。".repeat(
          4,
        ),
      paragraphs: [
        "站内 Story 已直接从数据层读取，避免 Cloudflare Worker 通过公开域名再次请求自身。".repeat(
          4,
        ),
      ],
    }));
    vi.stubGlobal("fetch", fetchMock);

    const source = await prepareDistillSource(
      "https://ailoresift.com/stories/example-story",
      { resolveInternalUrl },
    );

    expect(source.sourceTitle).toBe("站内 Story");
    expect(resolveInternalUrl).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses both nested and flat reader responses", () => {
    expect(
      parseReaderDocument({
        data: {
          title: "公众号文章标题",
          author: "测试作者",
          content: "这是一段由正文读取服务返回的内容。",
        },
      }),
    ).toMatchObject({
      title: "公众号文章标题",
      author: "测试作者",
    });
    expect(
      parseReaderDocument({
        title: "扁平响应",
        content: "另一种兼容响应。",
      }).content,
    ).toContain("兼容响应");
  });

  it("uses the dedicated reader path for WeChat articles", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe(
        "https://r.jina.ai/https://mp.weixin.qq.com/s/test-article",
      );
      return new Response(
        JSON.stringify({
          data: {
            title: "如何把一篇长文变成可复用知识",
            author: "测试公众号",
            content: [
              "# 如何把一篇长文变成可复用知识",
              "",
              "第一部分说明文章的背景，并给出为什么需要知识沉淀的真实原因。很多内容虽然被收藏，却因为缺少稳定结构和来源记录而很难再次利用。",
              "",
              "第二部分解释具体方法，包括提取事实、保留证据和整理可复用结论。每条判断都需要对应原文片段，避免把模型推断误写成已经确认的事实。",
              "",
              "第三部分说明质量边界，提醒读者不要把未经验证的推断写成事实。完成整理后，还要让读者能够回到原始文章检查上下文。",
            ].join("\n"),
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const source = await prepareDistillSource(
      "https://mp.weixin.qq.com/s/test-article",
    );

    expect(source.sourceUrl).toBe("https://mp.weixin.qq.com/s/test-article");
    expect(source.sourceTitle).toBe("如何把一篇长文变成可复用知识");
    expect(source.sourceAuthor).toBe("测试公众号");
    expect(source.rawText).toContain("保留证据");
    expect(source.paragraphs.length).toBeGreaterThanOrEqual(3);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports a WeChat access failure instead of a fake size error", async () => {
    const oversizedShell = new Uint8Array(2_500_100);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("reader unavailable", { status: 502 }),
      )
      .mockResolvedValueOnce(
        new Response(oversizedShell, {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      prepareDistillSource("https://mp.weixin.qq.com/s/blocked-article"),
    ).rejects.toThrow("微信公众号限制了本次正文读取");
  });
});
