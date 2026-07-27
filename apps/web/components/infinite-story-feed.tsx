"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { StoryFeedItem } from "../lib/queries";
import { StoryRow } from "./story-row";

const LOAD_SIZE = 15;

type SerializedStoryFeedItem = Omit<
  StoryFeedItem,
  "firstPublishedAt" | "lastPublishedAt"
> & {
  firstPublishedAt: string | null;
  lastPublishedAt: string | null;
};

type StoryFeedResponse = {
  items: SerializedStoryFeedItem[];
  total: number;
};

function reviveStory(story: SerializedStoryFeedItem): StoryFeedItem {
  return {
    ...story,
    firstPublishedAt: story.firstPublishedAt
      ? new Date(story.firstPublishedAt)
      : null,
    lastPublishedAt: story.lastPublishedAt
      ? new Date(story.lastPublishedAt)
      : null,
  };
}

export function InfiniteStoryFeed({
  initialItems,
  total,
  searchQuery,
}: {
  initialItems: StoryFeedItem[];
  total: number;
  searchQuery?: string | undefined;
}) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    loadingRef.current = true;
    setLoading(true);
    setError(false);

    try {
      const params = new URLSearchParams({
        limit: String(LOAD_SIZE),
        offset: String(items.length),
      });
      if (searchQuery) params.set("q", searchQuery);
      const response = await fetch(`/api/stories?${params.toString()}`);
      if (!response.ok) throw new Error("Story feed request failed");
      const payload = (await response.json()) as StoryFeedResponse;
      const nextItems = payload.items.map(reviveStory);

      setItems((current) => {
        const knownIds = new Set(current.map((story) => story.id));
        return [
          ...current,
          ...nextItems.filter((story) => !knownIds.has(story.id)),
        ];
      });
    } catch {
      setError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, items.length, searchQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMore, loadMore]);

  return (
    <>
      <div className="storyList">
        {items.map((story, index) => (
          <StoryRow story={story} index={index} key={story.id} />
        ))}
      </div>
      <div ref={sentinelRef} className="feedContinuation" aria-live="polite">
        {loading ? <span>正在载入更多情报…</span> : null}
        {error ? (
          <button type="button" onClick={() => void loadMore()}>
            <ArrowClockwise aria-hidden="true" size={16} />
            重新加载
          </button>
        ) : null}
        {!hasMore && items.length > LOAD_SIZE ? (
          <span>已读完当前筛选下的全部 {total} 条</span>
        ) : null}
      </div>
    </>
  );
}
