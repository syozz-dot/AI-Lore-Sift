import "dotenv/config";

import { createDatabase } from "@ai-news-navigator/database";
import type { IngestionLogger } from "@ai-news-navigator/pipeline";

import {
  createConfiguredStoryAnalyzer,
  type StoryAnalysisContentType,
} from "./story-analysis.js";
import { runStoryAnalysis } from "./scheduled-work.js";

const supportedContentTypes = new Set<StoryAnalysisContentType>([
  "news",
  "paper",
  "product",
  "model",
  "release",
  "post",
  "other",
]);

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const logger: IngestionLogger = {
  info: (message, context) => console.info(message, context ?? {}),
  warn: (message, context) => console.warn(message, context ?? {}),
  error: (message, context) => console.error(message, context ?? {}),
};

const requestedContentType = argumentValue("--type");
const contentType = supportedContentTypes.has(
  requestedContentType as StoryAnalysisContentType,
)
  ? (requestedContentType as StoryAnalysisContentType)
  : undefined;
const requestedLimit = Number(argumentValue("--limit") ?? "60");
const batchSize =
  Number.isInteger(requestedLimit) &&
  requestedLimit >= 1 &&
  requestedLimit <= 120
    ? requestedLimit
    : 60;

const analyzer = createConfiguredStoryAnalyzer();
if (!analyzer) {
  throw new Error(
    "Story analysis credentials are required. Set DEEPSEEK_API_KEY, OPENAI_API_KEY, AI_GATEWAY_API_KEY, or refresh VERCEL_OIDC_TOKEN.",
  );
}

const { client, db } = createDatabase();

try {
  const result = await runStoryAnalysis({
    db,
    logger,
    analyzer,
    batchSize,
    ...(contentType ? { contentType } : {}),
  });
  if (result.failedCount > 0) process.exitCode = 1;
} finally {
  await client.end();
}
