import { describe, expect, it, vi } from "vitest";

import {
  arsTechnicaAiSource,
  createArsTechnicaAiAdapter,
  createGoogleAiBlogAdapter,
  createGoogleDeepMindBlogAdapter,
  createHackerNewsAiAdapter,
  createTechCrunchAiAdapter,
  createTheDecoderAdapter,
  createVentureBeatAiAdapter,
  googleAiBlogSource,
  googleDeepMindBlogSource,
  hackerNewsAiSource,
  techCrunchAiSource,
  theDecoderSource,
  ventureBeatAiSource,
} from "./curated-rss.js";

describe("curated RSS sources", () => {
  it("assigns explicit provenance and matching adapters", () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const pairs = [
      [googleAiBlogSource, createGoogleAiBlogAdapter(fetchImpl)],
      [googleDeepMindBlogSource, createGoogleDeepMindBlogAdapter(fetchImpl)],
      [hackerNewsAiSource, createHackerNewsAiAdapter(fetchImpl)],
      [techCrunchAiSource, createTechCrunchAiAdapter(fetchImpl)],
      [arsTechnicaAiSource, createArsTechnicaAiAdapter(fetchImpl)],
      [ventureBeatAiSource, createVentureBeatAiAdapter(fetchImpl)],
      [theDecoderSource, createTheDecoderAdapter(fetchImpl)],
    ] as const;

    for (const [definition, adapter] of pairs) {
      expect(definition.feedUrl).toMatch(/^https:\/\//u);
      expect(adapter.key).toBe(definition.connectorKey);
    }
    expect(googleAiBlogSource).toMatchObject({
      isFirstParty: true,
      reliability: "primary",
    });
    expect(hackerNewsAiSource).toMatchObject({
      isFirstParty: false,
      reliability: "medium",
    });
  });
});
