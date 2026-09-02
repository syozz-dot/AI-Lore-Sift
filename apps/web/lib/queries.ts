import {
  itemAssessments,
  items,
  reports,
  sources,
  stories,
  storyAnalyses,
  storyItems,
  storyTopics,
  topics,
  type ReportSnapshotContent,
  type ReportSnapshotStory,
} from "@ai-news-navigator/database";
import {
  CURATED_TOPICS,
  findCuratedTopic,
  scoreStoryWithinCategory,
  type CuratedTopic,
  type CuratedTopicSlug,
} from "@ai-news-navigator/intelligence";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import { getDatabaseConnection } from "./database";
import { balanceRankedFeed } from "./feed-ranking";
import { cachePublicData } from "./public-data-cache";
import { normalizeSearchQuery, storySearchTerms } from "./search";

export type ContentType = typeof items.$inferSelect.contentType;
export type StoryStatus = typeof stories.$inferSelect.status;

export interface StoryFeedItem {
  id: string;
  slug: string;
  status: StoryStatus;
  title: string;
  translatedTitle: string | null;
  factualSummary: string | null;
  firstPublishedAt: Date | null;
  lastPublishedAt: Date | null;
  independentSourceCount: number;
  relevanceScore: number | null;
  categoryScore: number | null;
  overallScore: number | null;
  confidence: number | null;
  primaryItemId: string | null;
  excerpt: string | null;
  originalUrl: string | null;
  contentType: ContentType | null;
  sourceName: string | null;
  sourceSlug: string | null;
  matchedSignals: string[];
  assessmentReasons: string[];
  whyItMatters: string | null;
  hasAnalysis: boolean;
  topics: string[];
}

export type TopicIndexItem = CuratedTopic & {
  total: number;
  recentCount: number;
  latestStory: StoryFeedItem | null;
};

export interface SourceHealthItem {
  id: string;
  slug: string;
  name: string;
  type: typeof sources.$inferSelect.type;
  reliability: typeof sources.$inferSelect.reliability;
  status: typeof sources.$inferSelect.status;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  consecutiveFailures: number;
}

export interface DailyIssue {
  issueDate: string;
  items: StoryFeedItem[];
  counts: Record<"news" | "paper" | "product" | "model", number>;
  total: number;
  readingMinutes: number;
  previousDate: string | null;
  nextDate: string | null;
}

export type ReportType = typeof reports.$inferSelect.type;

export interface ReportArchiveItem {
  type: ReportType;
  periodKey: string;
  title: string;
  storyCount: number;
  generatedAt: Date;
}

export interface ReportIssue extends ReportArchiveItem {
  periodStart: Date;
  periodEnd: Date;
  readingMinutes: number;
  content: ReportSnapshotContent;
  previousKey: string | null;
  nextKey: string | null;
}

export interface StoryEvidenceItem {
  id: string;
  role: typeof storyItems.$inferSelect.role;
  title: string;
  excerpt: string | null;
  originalUrl: string;
  contentType: ContentType;
  author: string | null;
  sourcePublishedAt: Date | null;
  discoveredAt: Date;
  sourceName: string;
  sourceReliability: typeof sources.$inferSelect.reliability;
  matchedSignals: string[];
  relevanceScore: number | null;
}

export interface StoryDetail extends StoryFeedItem {
  sourceContent: string | null;
  sourceContentFormat: typeof items.$inferSelect.contentFormat;
  sourceMediaAssets: typeof items.$inferSelect.mediaAssets;
  sourceAllowsFullText: boolean;
  primaryAuthor: string | null;
  evidence: StoryEvidenceItem[];
  analysis: {
    translatedTitle: string | null;
    factualSummary: string;
    whyItMatters: string | null;
    underlyingLogic: string | null;
    productImpact: string | null;
    productOpportunities: string[];
    openQuestions: string[];
    confidence: number;
    provider: string;
    model: string;
    createdAt: Date;
  } | null;
}

const publicStoryStatuses: StoryStatus[] = [
  "emerging",
  "confirmed",
  "cooling",
  "corrected",
];

type FeedCandidate = {
  id: string;
  contentType: ContentType | null;
  lastPublishedAt: Date | null;
  independentSourceCount: number;
  relevanceScore: number | null;
  overallScore: number | null;
  sourceReliability: typeof sources.$inferSelect.reliability | null;
  sourceIsFirstParty: boolean | null;
};

function rankFeedCandidates(candidates: FeedCandidate[]): FeedCandidate[] {
  const now = new Date();
  const scored = candidates.map((candidate) => {
    const categoryScore = candidate.contentType
      ? scoreStoryWithinCategory({
          contentType: candidate.contentType,
          relevanceScore: candidate.overallScore ?? candidate.relevanceScore,
          publishedAt: candidate.lastPublishedAt,
          independentSourceCount: candidate.independentSourceCount,
          sourceReliability: candidate.sourceReliability,
          isFirstParty: candidate.sourceIsFirstParty,
          now,
        })
      : 0;
    return { ...candidate, categoryScore };
  });
  return balanceRankedFeed(scored);
}

async function hydrateFeedRows(
  baseRows: Array<{
    id: string;
    slug: string;
    status: StoryStatus;
    title: string;
    factualSummary: string | null;
    firstPublishedAt: Date | null;
    lastPublishedAt: Date | null;
    independentSourceCount: number;
    relevanceScore: number | null;
    overallScore: number | null;
    confidence: number | null;
    primaryItemId: string | null;
    excerpt: string | null;
    originalUrl: string | null;
    contentType: ContentType | null;
    sourceName: string | null;
    sourceSlug: string | null;
    sourceReliability?: typeof sources.$inferSelect.reliability | null;
    sourceIsFirstParty?: boolean | null;
  }>,
): Promise<StoryFeedItem[]> {
  if (baseRows.length === 0) return [];
  const { db } = getDatabaseConnection();
  const storyIds = baseRows.map((row) => row.id);
  const itemIds = baseRows.flatMap((row) =>
    row.primaryItemId ? [row.primaryItemId] : [],
  );

  const [assessmentRows, analysisRows, topicRows] = await Promise.all([
    itemIds.length === 0
      ? []
      : db
          .selectDistinctOn([itemAssessments.itemId], {
            itemId: itemAssessments.itemId,
            matchedSignals: itemAssessments.matchedSignals,
            reasons: itemAssessments.reasons,
            createdAt: itemAssessments.createdAt,
          })
          .from(itemAssessments)
          .where(inArray(itemAssessments.itemId, itemIds))
          .orderBy(itemAssessments.itemId, desc(itemAssessments.createdAt)),
    db
      .selectDistinctOn([storyAnalyses.storyId], {
        storyId: storyAnalyses.storyId,
        translatedTitle: storyAnalyses.translatedTitle,
        factualSummary: storyAnalyses.factualSummary,
        whyItMatters: storyAnalyses.whyItMatters,
        createdAt: storyAnalyses.createdAt,
      })
      .from(storyAnalyses)
      .where(inArray(storyAnalyses.storyId, storyIds))
      .orderBy(storyAnalyses.storyId, desc(storyAnalyses.createdAt)),
    db
      .select({ storyId: storyTopics.storyId, name: topics.name })
      .from(storyTopics)
      .innerJoin(topics, eq(storyTopics.topicId, topics.id))
      .where(inArray(storyTopics.storyId, storyIds)),
  ]);

  const assessmentByItem = new Map<
    string,
    { matchedSignals: string[]; reasons: string[] }
  >();
  for (const row of assessmentRows) {
    if (!assessmentByItem.has(row.itemId))
      assessmentByItem.set(row.itemId, row);
  }
  const analysisByStory = new Map<
    string,
    {
      translatedTitle: string | null;
      factualSummary: string;
      whyItMatters: string | null;
    }
  >();
  for (const row of analysisRows) {
    if (!analysisByStory.has(row.storyId))
      analysisByStory.set(row.storyId, row);
  }
  const topicsByStory = new Map<string, string[]>();
  for (const row of topicRows) {
    const names = topicsByStory.get(row.storyId) ?? [];
    names.push(row.name);
    topicsByStory.set(row.storyId, names);
  }

  return baseRows.map((row) => {
    const assessment = row.primaryItemId
      ? assessmentByItem.get(row.primaryItemId)
      : undefined;
    const analysis = analysisByStory.get(row.id);
    const { sourceReliability, sourceIsFirstParty, ...publicRow } = row;
    return {
      ...publicRow,
      categoryScore: row.contentType
        ? scoreStoryWithinCategory({
            contentType: row.contentType,
            relevanceScore: row.overallScore ?? row.relevanceScore,
            publishedAt: row.lastPublishedAt,
            independentSourceCount: row.independentSourceCount,
            sourceReliability,
            isFirstParty: sourceIsFirstParty,
          })
        : null,
      translatedTitle: analysis?.translatedTitle ?? null,
      factualSummary: analysis?.factualSummary ?? row.factualSummary,
      matchedSignals: assessment?.matchedSignals ?? [],
      assessmentReasons: assessment?.reasons ?? [],
      whyItMatters: analysis?.whyItMatters ?? null,
      hasAnalysis: analysis !== undefined,
      topics: topicsByStory.get(row.id) ?? [],
    };
  });
}

async function loadStoryFeed(
  contentType?: ContentType,
  limit = 30,
  rawSearchQuery?: string,
  topicSlug?: string,
  offset = 0,
) {
  const searchQuery = normalizeSearchQuery(rawSearchQuery);
  const { db } = getDatabaseConnection();
  const primaryItems = alias(items, "primary_items");
  const topicMatches = topicSlug
    ? db
        .select({ storyId: storyTopics.storyId })
        .from(storyTopics)
        .innerJoin(topics, eq(storyTopics.topicId, topics.id))
        .where(eq(topics.slug, topicSlug))
    : undefined;
  const contentWhere = contentType
    ? and(
        inArray(stories.status, publicStoryStatuses),
        eq(primaryItems.contentType, contentType),
      )
    : and(
        inArray(stories.status, publicStoryStatuses),
        ne(primaryItems.contentType, "release"),
      );
  const baseWhere = topicMatches
    ? and(contentWhere, inArray(stories.id, topicMatches))
    : contentWhere;
  const searchConditions = searchQuery
    ? storySearchTerms(searchQuery).map((term) => {
        const pattern = `%${term}%`;
        const analysisMatches = db
          .select({ storyId: storyAnalyses.storyId })
          .from(storyAnalyses)
          .where(
            or(
              ilike(storyAnalyses.translatedTitle, pattern),
              ilike(storyAnalyses.factualSummary, pattern),
              ilike(storyAnalyses.whyItMatters, pattern),
            ),
          );
        const topicMatches = db
          .select({ storyId: storyTopics.storyId })
          .from(storyTopics)
          .innerJoin(topics, eq(storyTopics.topicId, topics.id))
          .where(ilike(topics.name, pattern));

        return or(
          ilike(stories.title, pattern),
          ilike(stories.factualSummary, pattern),
          ilike(primaryItems.title, pattern),
          ilike(primaryItems.originalTitle, pattern),
          ilike(primaryItems.excerpt, pattern),
          ilike(sources.name, pattern),
          inArray(stories.id, analysisMatches),
          inArray(stories.id, topicMatches),
        );
      })
    : [];
  const where = and(baseWhere, ...searchConditions);
  const relevanceSort = desc(
    sql`coalesce(${stories.overallScore}, ${stories.relevanceScore}, 0)`,
  );
  const balanceCategories = contentType === undefined;
  const freshnessFirst =
    balanceCategories ||
    contentType === "news" ||
    contentType === "product" ||
    contentType === "post" ||
    contentType === "release" ||
    contentType === "other";
  const sortOrder = freshnessFirst
    ? [desc(stories.lastPublishedAt), relevanceSort]
    : [relevanceSort, desc(stories.lastPublishedAt)];
  const candidateLimit = balanceCategories
    ? Math.max(40, offset + limit)
    : Math.max(120, (offset + limit) * 6);
  const feedSelection = {
    id: stories.id,
    slug: stories.slug,
    status: stories.status,
    title: stories.title,
    factualSummary: stories.factualSummary,
    firstPublishedAt: stories.firstPublishedAt,
    lastPublishedAt: stories.lastPublishedAt,
    independentSourceCount: stories.independentSourceCount,
    relevanceScore: stories.relevanceScore,
    overallScore: stories.overallScore,
    confidence: stories.confidence,
    primaryItemId: stories.primaryItemId,
    excerpt: primaryItems.excerpt,
    originalUrl: primaryItems.originalUrl,
    contentType: primaryItems.contentType,
    sourceName: sources.name,
    sourceSlug: sources.slug,
    sourceReliability: sources.reliability,
    sourceIsFirstParty: sources.isFirstParty,
  };
  const candidateSelection = {
    id: stories.id,
    contentType: primaryItems.contentType,
    lastPublishedAt: stories.lastPublishedAt,
    independentSourceCount: stories.independentSourceCount,
    relevanceScore: stories.relevanceScore,
    overallScore: stories.overallScore,
    sourceReliability: sources.reliability,
    sourceIsFirstParty: sources.isFirstParty,
  };
  const selectCandidates = (
    candidateWhere: ReturnType<typeof and>,
    order: typeof sortOrder,
  ) =>
    db
      .select(candidateSelection)
      .from(stories)
      .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
      .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
      .where(candidateWhere)
      .orderBy(...order)
      .limit(candidateLimit)
      .offset(0);
  const candidateQueries = balanceCategories
    ? [
        selectCandidates(
          and(
            where,
            inArray(primaryItems.contentType, ["news", "post", "other"]),
          ),
          [desc(stories.lastPublishedAt), relevanceSort],
        ),
        selectCandidates(and(where, eq(primaryItems.contentType, "product")), [
          desc(stories.lastPublishedAt),
          relevanceSort,
        ]),
        selectCandidates(and(where, eq(primaryItems.contentType, "model")), [
          relevanceSort,
          desc(stories.lastPublishedAt),
        ]),
        selectCandidates(and(where, eq(primaryItems.contentType, "paper")), [
          relevanceSort,
          desc(stories.lastPublishedAt),
        ]),
      ]
    : [selectCandidates(where, sortOrder)];

  const [candidateGroups, totals] = await Promise.all([
    Promise.all(candidateQueries),
    db
      .select({
        count: count(),
      })
      .from(stories)
      .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
      .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
      .where(where)
      .limit(1),
  ]);

  const selectedIds = rankFeedCandidates(candidateGroups.flat())
    .slice(offset, offset + limit)
    .map((candidate) => candidate.id);
  const selectedRows = selectedIds.length
    ? await db
        .select(feedSelection)
        .from(stories)
        .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
        .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
        .where(inArray(stories.id, selectedIds))
        .limit(selectedIds.length)
    : [];
  const selectedById = new Map(selectedRows.map((row) => [row.id, row]));
  const baseRows = selectedIds.flatMap((id) => {
    const row = selectedById.get(id);
    return row ? [row] : [];
  });
  const hydrated = await hydrateFeedRows(baseRows);
  return {
    items: hydrated,
    total: Number(totals[0]?.count ?? 0),
  };
}

export const getStoryFeed = cache(
  async (
    contentType?: ContentType,
    limit = 30,
    rawSearchQuery?: string,
    topicSlug?: string,
    offset = 0,
  ) => {
    const searchQuery = normalizeSearchQuery(rawSearchQuery);
    const cacheKey = JSON.stringify([
      "story-feed",
      contentType ?? "all",
      limit,
      searchQuery ?? "",
      topicSlug ?? "",
      offset,
    ]);
    return cachePublicData(cacheKey, () =>
      loadStoryFeed(contentType, limit, searchQuery, topicSlug, offset),
    );
  },
);

export function getCuratedTopic(slug: string): CuratedTopic | undefined {
  return findCuratedTopic(slug);
}

export const getTopicIndex = cache(async (): Promise<TopicIndexItem[]> => {
  const { db } = getDatabaseConnection();
  const primaryItems = alias(items, "topic_primary_items");
  const curatedSlugs = CURATED_TOPICS.map((topic) => topic.slug);
  const recentSince = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const publicTopicStories = and(
    inArray(stories.status, publicStoryStatuses),
    ne(primaryItems.contentType, "release"),
    inArray(topics.slug, curatedSlugs),
  );

  const [countRows, storyRows] = await Promise.all([
    db
      .select({
        slug: topics.slug,
        total: count(),
        recentCount: sql<number>`count(*) filter (where ${stories.lastPublishedAt} >= ${recentSince}::timestamptz)`,
      })
      .from(storyTopics)
      .innerJoin(topics, eq(storyTopics.topicId, topics.id))
      .innerJoin(stories, eq(storyTopics.storyId, stories.id))
      .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
      .where(publicTopicStories)
      .groupBy(topics.slug),
    db
      .select({
        topicSlug: topics.slug,
        id: stories.id,
        slug: stories.slug,
        status: stories.status,
        title: stories.title,
        factualSummary: stories.factualSummary,
        firstPublishedAt: stories.firstPublishedAt,
        lastPublishedAt: stories.lastPublishedAt,
        independentSourceCount: stories.independentSourceCount,
        relevanceScore: stories.relevanceScore,
        overallScore: stories.overallScore,
        confidence: stories.confidence,
        primaryItemId: stories.primaryItemId,
        excerpt: primaryItems.excerpt,
        originalUrl: primaryItems.originalUrl,
        contentType: primaryItems.contentType,
        sourceName: sources.name,
        sourceSlug: sources.slug,
        sourceReliability: sources.reliability,
        sourceIsFirstParty: sources.isFirstParty,
      })
      .from(storyTopics)
      .innerJoin(topics, eq(storyTopics.topicId, topics.id))
      .innerJoin(stories, eq(storyTopics.storyId, stories.id))
      .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
      .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
      .where(publicTopicStories)
      .orderBy(topics.slug, desc(stories.lastPublishedAt)),
  ]);

  const latestRows = new Map<CuratedTopicSlug, (typeof storyRows)[number]>();
  for (const row of storyRows) {
    const topic = findCuratedTopic(row.topicSlug);
    if (topic && !latestRows.has(topic.slug)) latestRows.set(topic.slug, row);
  }
  const latestEntries = [...latestRows.entries()];
  const hydratedLatest = await hydrateFeedRows(
    latestEntries.map(([, { topicSlug: _topicSlug, ...row }]) => row),
  );
  const latestBySlug = new Map<CuratedTopicSlug, StoryFeedItem>();
  latestEntries.forEach(([slug], index) => {
    const story = hydratedLatest[index];
    if (story) latestBySlug.set(slug, story);
  });
  const countsBySlug = new Map(
    countRows.map((row) => [
      row.slug,
      { total: Number(row.total), recentCount: Number(row.recentCount) },
    ]),
  );

  return CURATED_TOPICS.map((topic) => ({
    ...topic,
    total: countsBySlug.get(topic.slug)?.total ?? 0,
    recentCount: countsBySlug.get(topic.slug)?.recentCount ?? 0,
    latestStory: latestBySlug.get(topic.slug) ?? null,
  }));
});

function isCalendarDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function reportStoryToFeedItem(story: ReportSnapshotStory): StoryFeedItem {
  const publishedAt = story.publishedAt ? new Date(story.publishedAt) : null;
  const normalizedScore = story.score > 1 ? story.score / 100 : story.score;
  return {
    id: story.id,
    slug: story.slug,
    status: "confirmed",
    title: story.title,
    translatedTitle: story.title,
    factualSummary: story.summary,
    firstPublishedAt: publishedAt,
    lastPublishedAt: publishedAt,
    independentSourceCount: 1,
    relevanceScore: normalizedScore,
    categoryScore: null,
    overallScore: normalizedScore,
    confidence: null,
    primaryItemId: null,
    excerpt: null,
    originalUrl: null,
    contentType: story.contentType,
    sourceName: story.sourceName,
    sourceSlug: null,
    matchedSignals: [],
    assessmentReasons: [],
    whyItMatters: story.whyItMatters,
    hasAnalysis: true,
    topics: [],
  };
}

function interleaveDailyStories(content: ReportSnapshotContent) {
  const queues = new Map(
    content.sections.map((section) => [section.type, [...section.stories]]),
  );
  const ordered: ReportSnapshotStory[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const type of ["news", "product", "model", "paper"] as const) {
      const next = queues.get(type)?.shift();
      if (!next) continue;
      ordered.push(next);
      added = true;
    }
  }
  return ordered;
}

async function loadHydratedFeedStory(storyId: string) {
  const { db } = getDatabaseConnection();
  const primaryItems = alias(items, "daily_focus_primary_items");
  const [base] = await db
    .select({
      id: stories.id,
      slug: stories.slug,
      status: stories.status,
      title: stories.title,
      factualSummary: stories.factualSummary,
      firstPublishedAt: stories.firstPublishedAt,
      lastPublishedAt: stories.lastPublishedAt,
      independentSourceCount: stories.independentSourceCount,
      relevanceScore: stories.relevanceScore,
      overallScore: stories.overallScore,
      confidence: stories.confidence,
      primaryItemId: stories.primaryItemId,
      excerpt: primaryItems.excerpt,
      originalUrl: primaryItems.originalUrl,
      contentType: primaryItems.contentType,
      sourceName: sources.name,
      sourceSlug: sources.slug,
      sourceReliability: sources.reliability,
      sourceIsFirstParty: sources.isFirstParty,
    })
    .from(stories)
    .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
    .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
    .where(
      and(
        eq(stories.id, storyId),
        inArray(stories.status, publicStoryStatuses),
      ),
    )
    .limit(1);
  if (!base) return null;
  const [hydrated] = await hydrateFeedRows([base]);
  return hydrated ?? null;
}

export const getDailyIssue = cache(async (requestedDate?: string) => {
  const cacheKey = `daily-issue:${requestedDate ?? "latest"}`;
  return cachePublicData(cacheKey, async (): Promise<DailyIssue> => {
    const { db } = getDatabaseConnection();
    const archive = await db
      .select({ periodKey: reports.periodKey })
      .from(reports)
      .where(eq(reports.type, "daily"))
      .orderBy(desc(reports.periodStart));
    const availableDates = archive.map((row) => row.periodKey);
    const fallbackDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const issueDate =
      isCalendarDate(requestedDate) && availableDates.includes(requestedDate)
        ? requestedDate
        : (availableDates[0] ?? fallbackDate);
    const [report] = await db
      .select({
        content: reports.content,
        readingMinutes: reports.readingMinutes,
      })
      .from(reports)
      .where(and(eq(reports.type, "daily"), eq(reports.periodKey, issueDate)))
      .limit(1);
    const currentIndex = availableDates.indexOf(issueDate);
    if (!report) {
      return {
        issueDate,
        items: [],
        counts: { news: 0, paper: 0, product: 0, model: 0 },
        total: 0,
        readingMinutes: 0,
        previousDate: null,
        nextDate: null,
      };
    }

    const counts: DailyIssue["counts"] = {
      news: 0,
      paper: 0,
      product: 0,
      model: 0,
    };
    for (const section of report.content.sections) {
      counts[section.type] = section.stories.length;
    }
    const dailyItems = interleaveDailyStories(report.content).map(
      reportStoryToFeedItem,
    );
    const focusStory = dailyItems[0]
      ? await loadHydratedFeedStory(dailyItems[0].id)
      : null;
    if (focusStory) dailyItems[0] = focusStory;

    return {
      issueDate,
      items: dailyItems,
      counts,
      total: dailyItems.length,
      readingMinutes: report.readingMinutes,
      previousDate:
        currentIndex >= 0 ? (availableDates[currentIndex + 1] ?? null) : null,
      nextDate:
        currentIndex > 0 ? (availableDates[currentIndex - 1] ?? null) : null,
    };
  });
});

export const getReportArchive = cache(
  async (): Promise<ReportArchiveItem[]> => {
    const { db } = getDatabaseConnection();
    return db
      .select({
        type: reports.type,
        periodKey: reports.periodKey,
        title: reports.title,
        storyCount: reports.storyCount,
        generatedAt: reports.generatedAt,
      })
      .from(reports)
      .orderBy(desc(reports.periodStart))
      .limit(120);
  },
);

export const getReportIssue = cache(
  async (
    type: ReportType = "daily",
    requestedKey?: string,
  ): Promise<ReportIssue | null> => {
    const { db } = getDatabaseConnection();
    const archive = await db
      .select({ periodKey: reports.periodKey })
      .from(reports)
      .where(eq(reports.type, type))
      .orderBy(desc(reports.periodStart));
    const selectedKey = requestedKey ?? archive[0]?.periodKey;
    if (!selectedKey) return null;
    const [report] = await db
      .select({
        type: reports.type,
        periodKey: reports.periodKey,
        periodStart: reports.periodStart,
        periodEnd: reports.periodEnd,
        title: reports.title,
        content: reports.content,
        storyCount: reports.storyCount,
        readingMinutes: reports.readingMinutes,
        generatedAt: reports.generatedAt,
      })
      .from(reports)
      .where(and(eq(reports.type, type), eq(reports.periodKey, selectedKey)))
      .limit(1);
    if (!report) return null;
    const currentIndex = archive.findIndex(
      (item) => item.periodKey === selectedKey,
    );
    return {
      ...report,
      previousKey:
        currentIndex >= 0
          ? (archive[currentIndex + 1]?.periodKey ?? null)
          : null,
      nextKey:
        currentIndex > 0
          ? (archive[currentIndex - 1]?.periodKey ?? null)
          : null,
    };
  },
);

export const getSourceHealth = cache(async (): Promise<SourceHealthItem[]> => {
  const { db } = getDatabaseConnection();
  return db
    .select({
      id: sources.id,
      slug: sources.slug,
      name: sources.name,
      type: sources.type,
      reliability: sources.reliability,
      status: sources.status,
      lastSuccessAt: sources.lastSuccessAt,
      lastFailureAt: sources.lastFailureAt,
      consecutiveFailures: sources.consecutiveFailures,
    })
    .from(sources)
    .where(
      notInArray(sources.slug, [
        "github-ollama-ollama-releases",
        "github-vllm-project-vllm-releases",
      ]),
    )
    .orderBy(asc(sources.status), asc(sources.name));
});

export const getStoryDetail = cache(
  async (slug: string): Promise<StoryDetail | null> => {
    const { db } = getDatabaseConnection();
    const primaryItems = alias(items, "primary_items");
    const [base] = await db
      .select({
        id: stories.id,
        slug: stories.slug,
        status: stories.status,
        title: stories.title,
        factualSummary: stories.factualSummary,
        firstPublishedAt: stories.firstPublishedAt,
        lastPublishedAt: stories.lastPublishedAt,
        independentSourceCount: stories.independentSourceCount,
        relevanceScore: stories.relevanceScore,
        overallScore: stories.overallScore,
        confidence: stories.confidence,
        primaryItemId: stories.primaryItemId,
        excerpt: primaryItems.excerpt,
        sourceContent: primaryItems.content,
        sourceContentFormat: primaryItems.contentFormat,
        sourceMediaAssets: primaryItems.mediaAssets,
        primaryAuthor: primaryItems.author,
        originalUrl: primaryItems.originalUrl,
        contentType: primaryItems.contentType,
        sourceName: sources.name,
        sourceSlug: sources.slug,
        sourceReliability: sources.reliability,
        sourceIsFirstParty: sources.isFirstParty,
        sourceAllowsFullText: sources.allowFullText,
      })
      .from(stories)
      .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
      .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
      .where(
        and(
          eq(stories.slug, slug),
          inArray(stories.status, publicStoryStatuses),
        ),
      )
      .limit(1);

    if (!base) return null;
    const [hydrated] = await hydrateFeedRows([base]);
    if (!hydrated) return null;

    const evidenceRows = await db
      .select({
        id: items.id,
        role: storyItems.role,
        title: items.title,
        excerpt: items.excerpt,
        originalUrl: items.originalUrl,
        contentType: items.contentType,
        author: items.author,
        sourcePublishedAt: items.sourcePublishedAt,
        discoveredAt: items.discoveredAt,
        sourceName: sources.name,
        sourceReliability: sources.reliability,
      })
      .from(storyItems)
      .innerJoin(items, eq(storyItems.itemId, items.id))
      .innerJoin(sources, eq(items.sourceId, sources.id))
      .where(eq(storyItems.storyId, base.id))
      .orderBy(asc(storyItems.addedAt));

    const evidenceIds = evidenceRows.map((row) => row.id);
    const assessmentRows =
      evidenceIds.length === 0
        ? []
        : await db
            .select({
              itemId: itemAssessments.itemId,
              relevanceScore: itemAssessments.relevanceScore,
              matchedSignals: itemAssessments.matchedSignals,
              createdAt: itemAssessments.createdAt,
            })
            .from(itemAssessments)
            .where(inArray(itemAssessments.itemId, evidenceIds))
            .orderBy(desc(itemAssessments.createdAt));
    const assessmentByItem = new Map<
      string,
      { relevanceScore: number; matchedSignals: string[] }
    >();
    for (const row of assessmentRows) {
      if (!assessmentByItem.has(row.itemId))
        assessmentByItem.set(row.itemId, row);
    }

    const [analysis] = await db
      .select({
        translatedTitle: storyAnalyses.translatedTitle,
        factualSummary: storyAnalyses.factualSummary,
        whyItMatters: storyAnalyses.whyItMatters,
        underlyingLogic: storyAnalyses.underlyingLogic,
        productImpact: storyAnalyses.productImpact,
        productOpportunities: storyAnalyses.productOpportunities,
        openQuestions: storyAnalyses.openQuestions,
        confidence: storyAnalyses.confidence,
        provider: storyAnalyses.provider,
        model: storyAnalyses.model,
        createdAt: storyAnalyses.createdAt,
      })
      .from(storyAnalyses)
      .where(eq(storyAnalyses.storyId, base.id))
      .orderBy(desc(storyAnalyses.createdAt))
      .limit(1);

    return {
      ...hydrated,
      sourceContent: base.sourceContent,
      sourceContentFormat: base.sourceContentFormat ?? "text",
      sourceMediaAssets: base.sourceMediaAssets ?? [],
      sourceAllowsFullText: base.sourceAllowsFullText ?? false,
      primaryAuthor: base.primaryAuthor,
      evidence: evidenceRows.map((row) => {
        const assessment = assessmentByItem.get(row.id);
        return {
          ...row,
          matchedSignals: assessment?.matchedSignals ?? [],
          relevanceScore: assessment?.relevanceScore ?? null,
        };
      }),
      analysis: analysis ?? null,
    };
  },
);
