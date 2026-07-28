import { afterEach, describe, expect, it } from "vitest";

import {
  createConfiguredStoryAnalyzer,
  DeepSeekStoryAnalyzer,
  DEFAULT_DEEPSEEK_BASE_URL,
  DEFAULT_DEEPSEEK_STORY_ANALYSIS_MODEL,
  DEFAULT_GATEWAY_STORY_ANALYSIS_MODEL,
  DEFAULT_STORY_ANALYSIS_MODEL,
  OpenAIStoryAnalyzer,
  VercelGatewayStoryAnalyzer,
} from "./story-analysis.js";

const originalOpenAIKey = process.env.OPENAI_API_KEY;
const originalOpenAIModel = process.env.OPENAI_MODEL;
const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalDeepSeekModel = process.env.DEEPSEEK_MODEL;
const originalDeepSeekBaseURL = process.env.DEEPSEEK_BASE_URL;
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;
const originalModel = process.env.AI_GATEWAY_MODEL;

afterEach(() => {
  restoreEnvironment("OPENAI_API_KEY", originalOpenAIKey);
  restoreEnvironment("OPENAI_MODEL", originalOpenAIModel);
  restoreEnvironment("DEEPSEEK_API_KEY", originalDeepSeekKey);
  restoreEnvironment("DEEPSEEK_MODEL", originalDeepSeekModel);
  restoreEnvironment("DEEPSEEK_BASE_URL", originalDeepSeekBaseURL);
  restoreEnvironment("AI_GATEWAY_API_KEY", originalGatewayKey);
  restoreEnvironment("VERCEL_OIDC_TOKEN", originalOidcToken);
  restoreEnvironment("AI_GATEWAY_MODEL", originalModel);
});

describe("Story analysis configuration", () => {
  it("stays disabled locally when no Gateway identity is available", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;

    expect(createConfiguredStoryAnalyzer()).toBeNull();
  });

  it("uses the deployment identity and supports a model override", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    process.env.AI_GATEWAY_MODEL = "test/cheap-model";

    const analyzer = createConfiguredStoryAnalyzer({
      authorizationToken: "test-oidc-token",
    });

    expect(analyzer).toBeInstanceOf(VercelGatewayStoryAnalyzer);
    expect((analyzer as VercelGatewayStoryAnalyzer).model).toBe(
      "test/cheap-model",
    );
  });

  it("prefers a direct OpenAI key and supports a model override", () => {
    delete process.env.DEEPSEEK_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "test-nano-model";

    const analyzer = createConfiguredStoryAnalyzer({
      authorizationToken: "test-oidc-token",
    });

    expect(analyzer).toBeInstanceOf(OpenAIStoryAnalyzer);
    expect((analyzer as OpenAIStoryAnalyzer).model).toBe("test-nano-model");
  });

  it("defaults direct OpenAI analysis to GPT-5 nano", () => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_MODEL;

    const analyzer = createConfiguredStoryAnalyzer({
      openAIApiKey: "test-openai-key",
    });

    expect((analyzer as OpenAIStoryAnalyzer).model).toBe(
      DEFAULT_STORY_ANALYSIS_MODEL,
    );
  });

  it("defaults Gateway analysis to the OpenAI-qualified model", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.AI_GATEWAY_MODEL;

    const analyzer = createConfiguredStoryAnalyzer({
      authorizationToken: "test-oidc-token",
    });

    expect((analyzer as VercelGatewayStoryAnalyzer).model).toBe(
      DEFAULT_GATEWAY_STORY_ANALYSIS_MODEL,
    );
  });

  it("prefers a direct DeepSeek key and supports compatible endpoints", () => {
    process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
    process.env.DEEPSEEK_MODEL = "deepseek-test-model";
    process.env.DEEPSEEK_BASE_URL = "https://gateway.example/v1/";
    process.env.OPENAI_API_KEY = "test-openai-key";

    const analyzer = createConfiguredStoryAnalyzer({
      authorizationToken: "test-oidc-token",
    });

    expect(analyzer).toBeInstanceOf(DeepSeekStoryAnalyzer);
    expect((analyzer as DeepSeekStoryAnalyzer).model).toBe(
      "deepseek-test-model",
    );
    expect((analyzer as DeepSeekStoryAnalyzer).baseURL).toBe(
      "https://gateway.example/v1",
    );
  });

  it("defaults direct DeepSeek analysis to V4 Flash", () => {
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.DEEPSEEK_BASE_URL;

    const analyzer = createConfiguredStoryAnalyzer({
      deepSeekApiKey: "test-deepseek-key",
    });

    expect((analyzer as DeepSeekStoryAnalyzer).model).toBe(
      DEFAULT_DEEPSEEK_STORY_ANALYSIS_MODEL,
    );
    expect((analyzer as DeepSeekStoryAnalyzer).baseURL).toBe(
      DEFAULT_DEEPSEEK_BASE_URL,
    );
  });

  it("requests non-thinking JSON analysis from DeepSeek", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const analyzer = new DeepSeekStoryAnalyzer({
      apiKey: "test-deepseek-key",
      fetch: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: `<think>内部推理不应进入结果</think>
\`\`\`json
${JSON.stringify({
  translatedTitle: "中文标题",
  factualSummary: "事实摘要",
  whyItMatters: "值得关注",
  underlyingLogic: "底层逻辑",
  productImpact: "产品影响",
  productOpportunities: ["产品机会"],
  openQuestions: ["待确认问题"],
  confidence: 0.8,
})}
\`\`\``,
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const result = await analyzer.analyze({
      storyId: "story-1",
      title: "Original title",
      contentType: "product",
      evidence: [
        {
          id: "item-1",
          sourceName: "Example",
          title: "Original title",
          excerpt: "Evidence excerpt",
          originalUrl: "https://example.com/story",
          publishedAt: new Date("2026-07-17T00:00:00.000Z"),
        },
      ],
    });

    expect(requestBody?.model).toBe(DEFAULT_DEEPSEEK_STORY_ANALYSIS_MODEL);
    expect(requestBody?.thinking).toEqual({ type: "disabled" });
    expect(requestBody?.response_format).toEqual({ type: "json_object" });
    expect(requestBody?.max_tokens).toBe(1_600);
    const messages = requestBody?.messages as
      Array<{ role: string; content: string }> | undefined;
    expect(messages?.[1]?.content).toContain("为什么值得试");
    expect(messages?.[1]?.content).toContain("上手前仍未知");
    expect(result.provider).toBe("deepseek");
    expect(result.translatedTitle).toBe("中文标题");
  });
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
