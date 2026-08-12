import {
  aiHotSocialDiscoverySource,
  anthropicNewsSource,
  arxivAiSource,
  arsTechnicaAiSource,
  createAnthropicNewsAdapter,
  createAiHotSocialDiscoveryAdapter,
  createArxivAiAdapter,
  createArsTechnicaAiAdapter,
  createGoogleAiBlogAdapter,
  createGoogleDeepMindBlogAdapter,
  createHackerNewsAiAdapter,
  createHuggingFaceDailyPapersAdapter,
  createHuggingFaceModelsAdapter,
  createOpenAiNewsAdapter,
  createOllamaReleaseAdapter,
  createProductHuntAdapter,
  createTechCrunchAiAdapter,
  createTheDecoderAdapter,
  createVentureBeatAiAdapter,
  createVllmReleaseAdapter,
  createWechat2RssAdapters,
  createWeChatCuratedAccountsAdapter,
  createXCuratedAccountsAdapter,
  createYouTubeChannelAdapters,
  DEFAULT_WECHAT_MONITORED_ACCOUNTS,
  DEFAULT_X_MONITORED_ACCOUNTS,
  googleAiBlogSource,
  googleDeepMindBlogSource,
  hackerNewsAiSource,
  huggingFaceDailyPapersSource,
  huggingFaceModelsSource,
  openAiNewsSource,
  ollamaReleaseSource,
  productHuntSource,
  parseMonitoredAccounts,
  techCrunchAiSource,
  theDecoderSource,
  ventureBeatAiSource,
  vllmReleaseSource,
  wechat2RssSources,
  weChatCuratedAccountsSource,
  xCuratedAccountsSource,
  youtubeChannelSources,
  type SourceAdapter,
  type SourceDefinition,
} from "@ai-news-navigator/sources";

export interface ConfiguredSource {
  definition: SourceDefinition;
  adapter: SourceAdapter;
}

export function createConfiguredSources(): ConfiguredSource[] {
  const wechat2RssAdapters = createWechat2RssAdapters();
  const youtubeChannelAdapters = createYouTubeChannelAdapters();
  const configured: ConfiguredSource[] = [
    {
      definition: openAiNewsSource,
      adapter: createOpenAiNewsAdapter(),
    },
    {
      definition: productHuntSource,
      adapter: createProductHuntAdapter(),
    },
    {
      definition: arxivAiSource,
      adapter: createArxivAiAdapter(),
    },
    {
      definition: huggingFaceModelsSource,
      adapter: createHuggingFaceModelsAdapter(),
    },
    {
      definition: anthropicNewsSource,
      adapter: createAnthropicNewsAdapter(),
    },
    {
      definition: googleAiBlogSource,
      adapter: createGoogleAiBlogAdapter(),
    },
    {
      definition: googleDeepMindBlogSource,
      adapter: createGoogleDeepMindBlogAdapter(),
    },
    {
      definition: huggingFaceDailyPapersSource,
      adapter: createHuggingFaceDailyPapersAdapter(),
    },
    {
      definition: hackerNewsAiSource,
      adapter: createHackerNewsAiAdapter(),
    },
    {
      definition: techCrunchAiSource,
      adapter: createTechCrunchAiAdapter(),
    },
    {
      definition: arsTechnicaAiSource,
      adapter: createArsTechnicaAiAdapter(),
    },
    {
      definition: ventureBeatAiSource,
      adapter: createVentureBeatAiAdapter(),
    },
    {
      definition: theDecoderSource,
      adapter: createTheDecoderAdapter(),
    },
    {
      definition: ollamaReleaseSource,
      adapter: createOllamaReleaseAdapter(),
    },
    {
      definition: vllmReleaseSource,
      adapter: createVllmReleaseAdapter(),
    },
    {
      definition: aiHotSocialDiscoverySource,
      adapter: createAiHotSocialDiscoveryAdapter(),
    },
    ...wechat2RssSources.map((definition, index) => ({
      definition,
      adapter: wechat2RssAdapters[index]!,
    })),
    ...youtubeChannelSources.map((definition, index) => ({
      definition,
      adapter: youtubeChannelAdapters[index]!,
    })),
  ];

  const xBearerToken = process.env.X_BEARER_TOKEN?.trim();
  if (xBearerToken) {
    configured.push({
      definition: xCuratedAccountsSource,
      adapter: createXCuratedAccountsAdapter({
        bearerToken: xBearerToken,
        accounts: parseMonitoredAccounts(
          process.env.X_MONITORED_ACCOUNTS,
          DEFAULT_X_MONITORED_ACCOUNTS,
        ),
      }),
    });
  }

  const weChatFeedUrl = process.env.WECHAT_RSS_URL?.trim();
  if (weChatFeedUrl) {
    configured.push({
      definition: {
        ...weChatCuratedAccountsSource,
        feedUrl: weChatFeedUrl,
      },
      adapter: createWeChatCuratedAccountsAdapter({
        feedUrl: weChatFeedUrl,
        accounts: parseMonitoredAccounts(
          process.env.WECHAT_MONITORED_ACCOUNTS,
          DEFAULT_WECHAT_MONITORED_ACCOUNTS,
        ),
        ...(process.env.WECHAT_RSS_AUTHORIZATION?.trim()
          ? {
              authorization: process.env.WECHAT_RSS_AUTHORIZATION.trim(),
            }
          : {}),
      }),
    });
  }

  return configured;
}
