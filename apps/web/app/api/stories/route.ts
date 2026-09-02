import { NextResponse } from "next/server";

import {
  checkPublicApiRateLimit,
  matchPublicApiCache,
  PUBLIC_RESPONSE_CACHE_CONTROL,
  storePublicApiCache,
} from "../../../lib/public-api-protection";
import { getStoryFeed, type ContentType } from "../../../lib/queries";
import { normalizeSearchQuery } from "../../../lib/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rateLimit = checkPublicApiRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS", message: "请求过于频繁，请稍后再试。" },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfter) },
      },
    );
  }
  const cached = await matchPublicApiCache(request);
  if (cached) return cached;

  const { searchParams } = new URL(request.url);
  const rawType = searchParams.get("type");
  const allowedTypes: ContentType[] = [
    "news",
    "paper",
    "product",
    "model",
    "release",
    "post",
    "other",
  ];
  const contentType =
    rawType && allowedTypes.includes(rawType as ContentType)
      ? (rawType as ContentType)
      : undefined;
  const requestedLimit = Number(searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, Math.floor(requestedLimit)))
    : 30;
  const searchQuery = normalizeSearchQuery(searchParams.get("q"));
  const topicSlug = searchParams.get("topic") ?? undefined;
  const requestedOffset = Number(searchParams.get("offset") ?? 0);
  const offset = Number.isFinite(requestedOffset)
    ? Math.max(0, Math.floor(requestedOffset))
    : 0;

  try {
    const result = await getStoryFeed(
      contentType,
      limit,
      searchQuery,
      topicSlug,
      offset,
    );
    const response = NextResponse.json(result, {
      headers: { "Cache-Control": PUBLIC_RESPONSE_CACHE_CONTROL },
    });
    await storePublicApiCache(request, response);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "STORY_FEED_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
