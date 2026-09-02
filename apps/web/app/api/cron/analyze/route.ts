import { timingSafeEqual } from "node:crypto";

import {
  createConfiguredStoryAnalyzer,
  runScheduledReportGeneration,
  runStoryAnalysis,
  runTopicClassification,
  type StoryAnalysisContentType,
} from "@ai-news-navigator/jobs";
import type { IngestionLogger } from "@ai-news-navigator/pipeline";
import { NextResponse } from "next/server";

import { getDatabaseConnection } from "../../../../lib/database";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const logger: IngestionLogger = {
  info: (message, context) => console.info(message, context ?? {}),
  warn: (message, context) => console.warn(message, context ?? {}),
  error: (message, context) => console.error(message, context ?? {}),
};

const supportedContentTypes = new Set<StoryAnalysisContentType>([
  "news",
  "paper",
  "product",
  "model",
  "release",
  "post",
  "other",
]);

function authorized(request: Request, secret: string) {
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const searchParams = new URL(request.url).searchParams;
    const requestedLimit = Number(searchParams.get("limit") ?? "120");
    const requestedContentType = searchParams.get("type");
    const contentType = supportedContentTypes.has(
      requestedContentType as StoryAnalysisContentType,
    )
      ? (requestedContentType as StoryAnalysisContentType)
      : undefined;
    const batchSize =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 120
        ? requestedLimit
        : 120;
    const { db } = getDatabaseConnection();
    const analyzer = createConfiguredStoryAnalyzer({
      authorizationToken: request.headers.get("x-vercel-oidc-token"),
    });
    const analysis = await runStoryAnalysis({
      db,
      logger,
      analyzer,
      batchSize,
      concurrency: 5,
      ...(contentType ? { contentType } : {}),
    });
    const topics = await runTopicClassification({ db, logger });
    const reports = await runScheduledReportGeneration({ db, logger });
    return NextResponse.json({ analysis, topics, reports });
  } catch (error) {
    logger.error("Scheduled Story analysis failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "ANALYSIS_FAILED" }, { status: 500 });
  }
}
