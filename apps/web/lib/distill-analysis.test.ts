import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateDistillation,
  generateDistillationResponse,
  normalizeDistillFollowUp,
} from "./distill-analysis";

const originalApiKey = process.env.DEEPSEEK_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalApiKey === undefined) {
    delete process.env.DEEPSEEK_API_KEY;
  } else {
    process.env.DEEPSEEK_API_KEY = originalApiKey;
  }
});

describe("distill analysis generation", () => {
  it("preserves paragraph breaks in follow-up answers", () => {
    expect(
      normalizeDistillFollowUp(
        "直接答案。  \n\n  1. 第一条说明。 \n 2. 第二条说明。",
      ),
    ).toBe("直接答案。\n\n1. 第一条说明。\n2. 第二条说明。");
  });

  it("retries with a compact response when the first output is truncated", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "length",
                message: { content: '{"title":"被截断的结果"' },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    title: "模型服务商性能评估方法",
                    verdict: "read",
                    verdictReason:
                      "材料给出了可复用的评估方法和证据边界，值得阅读全文。",
                    summary:
                      "文章说明如何比较不同模型服务商，并把速度、稳定性与成本放进同一评估框架。",
                    keyPoints: [
                      {
                        title: "统一评估口径",
                        detail:
                          "在相同任务和请求条件下记录延迟、错误率与价格，避免只比较单一指标。",
                        evidenceParagraphs: [1],
                      },
                    ],
                    claims: [
                      {
                        claim: "服务商表现需要结合多项指标判断。",
                        type: "author_view",
                        confidence: "high",
                        evidenceParagraphs: [1],
                      },
                    ],
                    transferableInsights: [
                      "选择服务商时应先固定任务与流量条件，再综合比较延迟、稳定性和成本。",
                    ],
                    cautions: [],
                    followUpQuestions: ["如何设计一组可重复的评估任务？"],
                    personalizedInsights: [],
                  }),
                },
              },
            ],
            usage: { completion_tokens: 380 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateDistillation({
      sourceTitle: "Evaluate LLM provider performance",
      sourceUrl: "https://example.com/article",
      paragraphs: ["文章提出应同时评估速度、稳定性和成本。"],
    });

    expect(result.title).toBe("模型服务商性能评估方法");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    ) as {
      max_tokens: number;
      messages: Array<{ content: string }>;
    };
    expect(retryBody.max_tokens).toBe(5_200);
    expect(retryBody.messages.at(-1)?.content).toContain("更紧凑");
  });

  it("sends private context only in a separate non-persisted personalization request", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    title: "规则文件的工程化写法",
                    verdict: "read",
                    verdictReason: "材料给出了可执行规则与验证方法。",
                    summary: "文章解释如何把抽象原则改写为可执行规则。",
                    keyPoints: [
                      {
                        title: "规则必须可执行",
                        detail: "每条规则需要包含触发条件与对应动作。",
                        evidenceParagraphs: [1],
                      },
                    ],
                    claims: [
                      {
                        claim: "作者建议使用条件到动作格式。",
                        type: "author_view",
                        confidence: "high",
                        evidenceParagraphs: [1],
                      },
                    ],
                    transferableInsights: ["规则需要同时写明触发条件和动作。"],
                    cautions: [],
                    followUpQuestions: ["如何验证规则已经执行？"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    personalizedInsights: [
                      {
                        title: "可迁移到国际化需求",
                        detail:
                          "可以把语言变更写成触发条件，把同步更新语言包写成动作。",
                        basis: "profile",
                        evidenceParagraphs: [1],
                      },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateDistillationResponse({
      sourceTitle: "规则写法",
      sourceUrl: null,
      paragraphs: ["每条规则都要写成遇到条件 X 就执行动作 Y。"],
      personalization: {
        purpose: "把工程实践迁移到产品国际化需求",
        directions: "国际化",
        currentContext: "正在整理多语言验收规则",
        preferredHelp: "给出可执行迁移",
        boundaries: "不把推测写成事实",
        memories: [],
      },
    });

    expect(result.personalizedInsights[0]?.basis).toBe("profile");
    expect(result.personalizationError).toBeNull();
    expect(result.persisted).not.toHaveProperty("personalizedInsights");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const genericBody = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body),
    ) as { messages: Array<{ content: string }> };
    const personalizedBody = JSON.parse(
      String(fetchMock.mock.calls[1]?.[1]?.body),
    ) as {
      messages: Array<{ content: string }>;
    };
    expect(genericBody.messages.at(-1)?.content).not.toContain(
      "产品国际化需求",
    );
    expect(personalizedBody.messages.at(-1)?.content).toContain(
      "<private_context>",
    );
    expect(personalizedBody.messages.at(-1)?.content).toContain(
      "产品国际化需求",
    );
  });

  it("keeps the generic result when the optional personalization call fails", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    title: "产品更新说明",
                    verdict: "skim",
                    verdictReason: "材料只说明功能上线，掌握摘要即可。",
                    summary: "材料宣布一项功能上线，并说明了适用范围。",
                    keyPoints: [],
                    claims: [],
                    transferableInsights: [],
                    cautions: ["没有提供性能数据。"],
                    followUpQuestions: ["功能面向哪些用户？"],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "provider error" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateDistillationResponse({
      sourceTitle: "产品更新",
      sourceUrl: null,
      paragraphs: ["今天上线一项新功能。"],
      personalization: {
        purpose: "跟踪产品变化",
        directions: "AI 产品",
        currentContext: "",
        preferredHelp: "",
        boundaries: "",
        memories: [],
      },
    });

    expect(result.persisted.title).toBe("产品更新说明");
    expect(result.personalizedInsights).toEqual([]);
    expect(result.personalizationError).toBe(
      "个性化关联生成失败，通用脱水已完成。",
    );
  });
});
