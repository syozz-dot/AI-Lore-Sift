import { RssSourceAdapter } from "./rss-adapter.js";
import type {
  RawSourceItem,
  SourceAdapter,
  SourceFetchContext,
} from "./types.js";

export interface WeChatRssAdapterOptions {
  key: string;
  feedUrl: string;
  accounts: string[];
  authorization?: string;
  maxItems?: number;
  fetchImpl?: typeof fetch;
}

export class WeChatRssAdapter implements SourceAdapter {
  readonly key: string;
  readonly #accounts: string[];
  readonly #rss: RssSourceAdapter;

  constructor(options: WeChatRssAdapterOptions) {
    this.key = options.key;
    this.#accounts = options.accounts.map((account) => account.toLowerCase());
    this.#rss = new RssSourceAdapter({
      key: options.key,
      feedUrl: options.feedUrl,
      contentType: "news",
      language: "zh",
      maxItems: options.maxItems ?? 40,
      includeContent: false,
      useContentAsExcerpt: true,
      maxExcerptCharacters: 2_000,
      ...(options.authorization
        ? { headers: { authorization: options.authorization } }
        : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  }

  async fetch(context: SourceFetchContext): Promise<RawSourceItem[]> {
    const items = await this.#rss.fetch(context);
    return items
      .filter((item) => {
        if (this.#accounts.length === 0) return true;
        if (!item.author?.trim()) return true;
        const haystack = `${item.author ?? ""} ${item.title}`.toLowerCase();
        return this.#accounts.some((account) => haystack.includes(account));
      })
      .map((item) => ({
        ...item,
        metadata: {
          ...item.metadata,
          platform: "wechat",
          monitoredAccounts: this.#accounts,
        },
      }));
  }
}
