import type { SourceDefinition } from "../types.js";
import { WeChatRssAdapter } from "../wechat-rss-adapter.js";
import { XSourceAdapter } from "../x-adapter.js";

export const xCuratedAccountsSource = {
  key: "x-curated-ai-accounts",
  name: "X 精选 AI 账号",
  type: "social",
  reliability: "primary",
  connectorKey: "x:curated-ai-accounts",
  homepageUrl: "https://x.com/",
  language: "en",
  isFirstParty: true,
  allowFullText: true,
  fetchIntervalMinutes: 30,
} satisfies SourceDefinition;

export const weChatCuratedAccountsSource = {
  key: "wechat-curated-ai-accounts",
  name: "精选 AI 公众号",
  type: "social",
  reliability: "high",
  connectorKey: "rss:wechat-curated-ai-accounts",
  homepageUrl: "https://mp.weixin.qq.com/",
  language: "zh",
  isFirstParty: false,
  allowFullText: false,
  fetchIntervalMinutes: 60,
} satisfies SourceDefinition;

export function createXCuratedAccountsAdapter(options: {
  bearerToken: string;
  accounts: string[];
  fetchImpl?: typeof fetch;
}) {
  return new XSourceAdapter({
    key: xCuratedAccountsSource.connectorKey,
    bearerToken: options.bearerToken,
    accounts: options.accounts,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
}

export function createWeChatCuratedAccountsAdapter(options: {
  feedUrl: string;
  accounts: string[];
  authorization?: string;
  fetchImpl?: typeof fetch;
}) {
  return new WeChatRssAdapter({
    key: weChatCuratedAccountsSource.connectorKey,
    feedUrl: options.feedUrl,
    accounts: options.accounts,
    ...(options.authorization ? { authorization: options.authorization } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
}
