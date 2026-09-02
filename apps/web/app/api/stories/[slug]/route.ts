import { NextResponse } from "next/server";

import {
  checkPublicApiRateLimit,
  matchPublicApiCache,
  PUBLIC_RESPONSE_CACHE_CONTROL,
  storePublicApiCache,
} from "../../../../lib/public-api-protection";
import { getStoryDetail } from "../../../../lib/queries";
import { decodeRouteSegment } from "../../../../lib/route-params";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
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

  const { slug: rawSlug } = await params;
  const slug = decodeRouteSegment(rawSlug);
  try {
    const story = await getStoryDetail(slug);
    if (!story)
      return NextResponse.json({ error: "STORY_NOT_FOUND" }, { status: 404 });
    const response = NextResponse.json(story, {
      headers: { "Cache-Control": PUBLIC_RESPONSE_CACHE_CONTROL },
    });
    await storePublicApiCache(request, response);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: "STORY_UNAVAILABLE",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
