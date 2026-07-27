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
} from "@ai-news-navigator/database";
import {
  CURATED_TOPICS,
  findCuratedTopic,
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
          .select({
            itemId: itemAssessments.itemId,
            matchedSignals: itemAssessments.matchedSignals,
            reasons: itemAssessments.reasons,
            createdAt: itemAssessments.createdAt,
          })
          .from(itemAssessments)
          .where(inArray(itemAssessments.itemId, itemIds))
          .orderBy(desc(itemAssessments.createdAt)),
    db
      .select({
        storyId: storyAnalyses.storyId,
        translatedTitle: storyAnalyses.translatedTitle,
        factualSummary: storyAnalyses.factualSummary,
        whyItMatters: storyAnalyses.whyItMatters,
        createdAt: storyAnalyses.createdAt,
      })
      .from(storyAnalyses)
      .where(inArray(storyAnalyses.storyId, storyIds))
      .orderBy(desc(storyAnalyses.createdAt)),
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
    return {
      ...row,
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

export const getStoryFeed = cache(
  async (
    contentType?: ContentType,
    limit = 30,
    rawSearchQuery?: string,
    topicSlug?: string,
    offset = 0,
  ) => {
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
    const searchQuery = normalizeSearchQuery(rawSearchQuery);
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
    const sortOrder =
      contentType === "product"
        ? [desc(stories.lastPublishedAt), relevanceSort]
        : [relevanceSort, desc(stories.lastPublishedAt)];

    const [baseRows, totals] = await Promise.all([
      db
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
        })
        .from(stories)
        .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
        .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
        .where(where)
        .orderBy(...sortOrder)
        .limit(limit)
        .offset(Math.max(0, offset)),
      db
        .select({ count: count() })
        .from(stories)
        .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
        .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
        .where(where),
    ]);

    return {
      items: await hydrateFeedRows(baseRows),
      total: Number(totals[0]?.count ?? 0),
    };
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

const dailyContentTypes: ContentType[] = ["news", "paper", "product", "model"];

function isCalendarDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function estimateChineseReadingMinutes(itemsToRead: StoryFeedItem[]): number {
  if (itemsToRead.length === 0) return 0;
  const characters = itemsToRead.reduce((total, item) => {
    const copy = [
      item.translatedTitle ?? item.title,
      item.factualSummary ?? "",
      item.whyItMatters ?? "",
    ].join("");
    return total + copy.replace(/\s/g, "").length;
  }, 0);
  return Math.max(1, Math.ceil(characters / 450));
}

export const getDailyIssue = cache(
  async (requestedDate?: string): Promise<DailyIssue> => {
    const { db } = getDatabaseConnection();
    const primaryItems = alias(items, "daily_primary_items");
    const dateExpression = sql<string>`to_char(timezone('Asia/Shanghai', ${stories.createdAt}), 'YYYY-MM-DD')`;
    const publicDailyStories = and(
      inArray(stories.status, publicStoryStatuses),
      inArray(primaryItems.contentType, dailyContentTypes),
    );

    const dateRows = await db
      .selectDistinct({ date: dateExpression })
      .from(stories)
      .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
      .where(publicDailyStories)
      .orderBy(desc(dateExpression));
    const availableDates = dateRows.map((row) => row.date);
    const issueDate = isCalendarDate(requestedDate)
      ? requestedDate
      : (availableDates[0] ??
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date()));

    const baseRows = await db
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
      })
      .from(stories)
      .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
      .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
      .where(and(publicDailyStories, eq(dateExpression, issueDate)))
      .orderBy(
        desc(
          sql`coalesce(${stories.overallScore}, ${stories.relevanceScore}, 0)`,
        ),
        desc(stories.lastPublishedAt),
      )
      .limit(80);

    const hydrated = await hydrateFeedRows(baseRows);
    const counts: DailyIssue["counts"] = {
      news: 0,
      paper: 0,
      product: 0,
      model: 0,
    };
    const perType = new Map<ContentType, number>();
    const dailyItems = hydrated.filter((item) => {
      if (!item.hasAnalysis || !item.factualSummary || !item.contentType)
        return false;
      const selected = perType.get(item.contentType) ?? 0;
      if (selected >= 5) return false;
      perType.set(item.contentType, selected + 1);
      counts[item.contentType as keyof DailyIssue["counts"]] += 1;
      return true;
    });

    const currentIndex = availableDates.indexOf(issueDate);
    const previousDate =
      currentIndex >= 0 ? (availableDates[currentIndex + 1] ?? null) : null;
    const nextDate =
      currentIndex > 0 ? (availableDates[currentIndex - 1] ?? null) : null;

    return {
      issueDate,
      items: dailyItems,
      counts,
      total: dailyItems.length,
      readingMinutes: estimateChineseReadingMinutes(dailyItems),
      previousDate,
      nextDate,
    };
  },
);

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
