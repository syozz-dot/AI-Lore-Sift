import { describe, expect, it, vi } from "vitest";

import {
  createWechat2RssAdapters,
  wechat2RssConfigs,
  wechat2RssSources,
} from "./wechat2rss.js";

describe("Wechat2RSS sources", () => {
  it("registers the public feeds with explicit provenance", () => {
    const adapters = createWechat2RssAdapters(vi.fn<typeof fetch>());

    expect(wechat2RssSources).toHaveLength(6);
    expect(new Set(wechat2RssSources.map((source) => source.key)).size).toBe(6);
    expect(wechat2RssConfigs.map((config) => config.account)).toEqual([
      "机器之心",
      "PaperWeekly",
      "新智元",
      "量子位",
      "极客公园",
      "差评",
    ]);

    for (const [index, source] of wechat2RssSources.entries()) {
      expect(source).toMatchObject({
        type: "social",
        reliability: "high",
        isFirstParty: false,
        allowFullText: false,
      });
      expect(source.feedUrl).toMatch(
        /^https:\/\/wechat2rss\.xlab\.app\/feed\/.+\.xml$/u,
      );
      expect(adapters[index]?.key).toBe(source.connectorKey);
    }
  });
});
