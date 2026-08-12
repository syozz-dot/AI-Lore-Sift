import type {
  ContentType,
  SourceReliability,
} from "@ai-news-navigator/sources";

export const CATEGORY_SCORE_VERSION = "category-v1";

export interface CategoryScoreInput {
  contentType: ContentType;
  relevanceScore: number | null;
  publishedAt: Date | string | null;
  independentSourceCount: number;
  sourceReliability?: SourceReliability | null | undefined;
  isFirstParty?: boolean | null | undefined;
  now?: Date;
}

interface CategoryStandard {
  relevanceWeight: number;
  freshnessWeight: number;
  evidenceWeight: number;
  freshnessHalfLifeDays: number;
}

export const CATEGORY_SCORE_STANDARDS: Record<ContentType, CategoryStandard> = {
  news: {
    relevanceWeight: 0.3,
    freshnessWeight: 0.4,
    evidenceWeight: 0.3,
    freshnessHalfLifeDays: 3,
  },
  product: {
    relevanceWeight: 0.4,
    freshnessWeight: 0.35,
    evidenceWeight: 0.25,
    freshnessHalfLifeDays: 10,
  },
  model: {
    relevanceWeight: 0.55,
    freshnessWeight: 0.2,
    evidenceWeight: 0.25,
    freshnessHalfLifeDays: 21,
  },
  paper: {
    relevanceWeight: 0.5,
    freshnessWeight: 0.15,
    evidenceWeight: 0.35,
    freshnessHalfLifeDays: 45,
  },
  release: {
    relevanceWeight: 0.45,
    freshnessWeight: 0.35,
    evidenceWeight: 0.2,
    freshnessHalfLifeDays: 7,
  },
  post: {
    relevanceWeight: 0.35,
    freshnessWeight: 0.35,
    evidenceWeight: 0.3,
    freshnessHalfLifeDays: 7,
  },
  other: {
    relevanceWeight: 0.35,
    freshnessWeight: 0.35,
    evidenceWeight: 0.3,
    freshnessHalfLifeDays: 7,
  },
};

const RELIABILITY_SCORE: Record<SourceReliability, number> = {
  primary: 0.95,
  high: 0.8,
  medium: 0.6,
  low: 0.35,
};

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function round(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function freshnessScore(
  value: Date | string | null,
  halfLifeDays: number,
  now: Date,
) {
  if (!value) return 0;
  const publishedAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(publishedAt.getTime())) return 0;
  const ageDays = Math.max(
    0,
    (now.getTime() - publishedAt.getTime()) / (24 * 60 * 60 * 1_000),
  );
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function evidenceScore(input: CategoryScoreInput) {
  const reliability = input.sourceReliability
    ? RELIABILITY_SCORE[input.sourceReliability]
    : 0.5;
  const firstPartyBoost = input.isFirstParty ? 0.05 : 0;
  const independentSourceBoost = Math.min(
    0.2,
    Math.max(0, input.independentSourceCount - 1) * 0.08,
  );
  return clamp(reliability + firstPartyBoost + independentSourceBoost);
}

export function scoreStoryWithinCategory(input: CategoryScoreInput) {
  const standard = CATEGORY_SCORE_STANDARDS[input.contentType];
  const relevance = clamp(input.relevanceScore ?? 0);
  const freshness = freshnessScore(
    input.publishedAt,
    standard.freshnessHalfLifeDays,
    input.now ?? new Date(),
  );
  const evidence = evidenceScore(input);
  return round(
    relevance * standard.relevanceWeight +
      freshness * standard.freshnessWeight +
      evidence * standard.evidenceWeight,
  );
}
