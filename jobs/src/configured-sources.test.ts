import { SourceRegistry } from "@ai-news-navigator/sources";
import { afterEach, describe, expect, it } from "vitest";

import { createConfiguredSources } from "./configured-sources.js";

describe("configured sources", () => {
  const originalXToken = process.env.X_BEARER_TOKEN;
  const originalWeChatUrl = process.env.WECHAT_RSS_URL;

  afterEach(() => {
    if (originalXToken === undefined) delete process.env.X_BEARER_TOKEN;
    else process.env.X_BEARER_TOKEN = originalXToken;
    if (originalWeChatUrl === undefined) delete process.env.WECHAT_RSS_URL;
    else process.env.WECHAT_RSS_URL = originalWeChatUrl;
  });

  it("registers every source with a unique matching adapter", () => {
    delete process.env.X_BEARER_TOKEN;
    delete process.env.WECHAT_RSS_URL;
    const registry = new SourceRegistry();

    for (const source of createConfiguredSources()) {
      registry.register(source.definition, source.adapter);
    }

    expect(registry.list().map((source) => source.key)).toEqual([
      "openai-news",
      "product-hunt",
      "arxiv-ai",
      "hugging-face-models",
      "anthropic-news",
      "google-ai-blog",
      "google-deepmind-blog",
      "hugging-face-daily-papers",
      "hacker-news-ai",
      "techcrunch-ai",
      "ars-technica-ai",
      "venturebeat-ai",
      "the-decoder",
      "github-ollama-ollama-releases",
      "github-vllm-project-vllm-releases",
      "aihot-social-discovery",
      "wechat-jiqizhixin",
      "wechat-paperweekly",
      "wechat-aiera",
      "wechat-qbitai",
      "wechat-geekpark",
      "wechat-chaping",
      "youtube-openai",
      "youtube-anthropic",
      "youtube-google-deepmind",
      "youtube-hugging-face",
      "youtube-nvidia-developer",
    ]);
  });

  it("registers social collectors only when configured", () => {
    process.env.X_BEARER_TOKEN = "test-token";
    process.env.WECHAT_RSS_URL = "https://example.com/wechat.xml";

    expect(
      createConfiguredSources().map((source) => source.definition.key),
    ).toEqual(
      expect.arrayContaining([
        "x-curated-ai-accounts",
        "wechat-curated-ai-accounts",
      ]),
    );
  });
});
