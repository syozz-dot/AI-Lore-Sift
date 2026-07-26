import { RssSourceAdapter } from "../rss-adapter.js";
import type { SourceDefinition } from "../types.js";

interface Wechat2RssConfig {
  slug: string;
  account: string;
  feedId: string;
}

const WECHAT2RSS_BASE_URL = "https://wechat2rss.xlab.app";

export const wechat2RssConfigs = [
  {
    slug: "jiqizhixin",
    account: "机器之心",
    feedId: "51e92aad2728acdd1fda7314be32b16639353001",
  },
  {
    slug: "paperweekly",
    account: "PaperWeekly",
    feedId: "3be891c2f4e526629ab055a297cc2cd6c1f0a563",
  },
  {
    slug: "aiera",
    account: "新智元",
    feedId: "ede30346413ea70dbef5d485ea5cbb95cca446e7",
  },
  {
    slug: "qbitai",
    account: "量子位",
    feedId: "7131b577c61365cb47e81000738c10d872685908",
  },
  {
    slug: "geekpark",
    account: "极客公园",
    feedId: "1a5aec98e71c707c8ca092bc2c255b9d4bac477d",
  },
  {
    slug: "chaping",
    account: "差评",
    feedId: "8d839de8dd3290a1f1be7a94423cccb30c1b087d",
  },
] as const satisfies readonly Wechat2RssConfig[];

export const wechat2RssSources = wechat2RssConfigs.map(
  (config) =>
    ({
      key: `wechat-${config.slug}`,
      name: `公众号 · ${config.account}`,
      type: "social",
      reliability: "high",
      connectorKey: `rss:wechat2rss:${config.slug}`,
      homepageUrl: `${WECHAT2RSS_BASE_URL}/list/all`,
      feedUrl: `${WECHAT2RSS_BASE_URL}/feed/${config.feedId}.xml`,
      language: "zh",
      isFirstParty: false,
      allowFullText: false,
      fetchIntervalMinutes: 360,
    }) satisfies SourceDefinition,
);

export function createWechat2RssAdapters(fetchImpl?: typeof fetch) {
  return wechat2RssSources.map(
    (definition) =>
      new RssSourceAdapter({
        key: definition.connectorKey,
        feedUrl: definition.feedUrl ?? "",
        contentType: "news",
        language: "zh",
        maxItems: 20,
        includeContent: false,
        useContentAsExcerpt: true,
        maxExcerptCharacters: 2_000,
        ...(fetchImpl ? { fetchImpl } : {}),
      }),
  );
}
