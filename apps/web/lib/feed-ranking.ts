import type { StoryFeedItem } from "./queries";

type FeedBucket = "news" | "product" | "model" | "paper";

export type RankableFeedItem = Pick<
  StoryFeedItem,
  "id" | "contentType" | "lastPublishedAt" | "categoryScore"
>;

const FEED_BUCKET_ORDER: FeedBucket[] = ["news", "product", "model", "paper"];

function feedBucket(story: RankableFeedItem): FeedBucket {
  if (story.contentType === "product") return "product";
  if (story.contentType === "model") return "model";
  if (story.contentType === "paper") return "paper";
  return "news";
}

function publishedAt(story: RankableFeedItem) {
  return story.lastPublishedAt?.getTime() ?? 0;
}

export function balanceRankedFeed<T extends RankableFeedItem>(items: T[]): T[] {
  const buckets = new Map<FeedBucket, T[]>(
    FEED_BUCKET_ORDER.map((bucket) => [bucket, []]),
  );

  for (const item of items) buckets.get(feedBucket(item))?.push(item);
  for (const bucketItems of buckets.values()) {
    bucketItems.sort(
      (left, right) =>
        (right.categoryScore ?? 0) - (left.categoryScore ?? 0) ||
        publishedAt(right) - publishedAt(left) ||
        left.id.localeCompare(right.id),
    );
  }

  const balanced: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const bucket of FEED_BUCKET_ORDER) {
      const next = buckets.get(bucket)?.shift();
      if (!next) continue;
      balanced.push(next);
      added = true;
    }
  }
  return balanced;
}

export function balanceStoryFeed(items: StoryFeedItem[]): StoryFeedItem[] {
  return balanceRankedFeed(items);
}
