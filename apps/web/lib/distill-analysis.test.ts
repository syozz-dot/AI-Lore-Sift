import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateDistillation,
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
});
