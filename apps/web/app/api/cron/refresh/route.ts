import { timingSafeEqual } from "node:crypto";

import {
  createConfiguredStoryAnalyzer,
  runDueSourceIngestion,
  runScheduledReportGeneration,
  runStoryAnalysis,
  runStoryProcessing,
  runTopicClassification,
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
    const shouldAnalyze = searchParams.get("analyze") === "1";
    const { db } = getDatabaseConnection();
    const ingestion = await runDueSourceIngestion({ db, logger });
    const processing = await runStoryProcessing({ db, logger });
    const analysis = shouldAnalyze
      ? await runStoryAnalysis({
          db,
          logger,
          analyzer: createConfiguredStoryAnalyzer({
            authorizationToken: request.headers.get("x-vercel-oidc-token"),
          }),
        })
      : { skipped: true };
    const topics = shouldAnalyze
      ? await runTopicClassification({ db, logger })
      : { skipped: true };
    const reports = shouldAnalyze
      ? await runScheduledReportGeneration({ db, logger })
      : { skipped: true };
    return NextResponse.json({
      ingestion,
      processing,
      topics,
      analysis,
      reports,
    });
  } catch (error) {
    logger.error("Scheduled refresh failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "REFRESH_FAILED" }, { status: 500 });
  }
}
