import {
  items,
  reports,
  sources,
  stories,
  storyAnalyses,
  type Database,
  type ReportSnapshotContent,
  type ReportSnapshotSection,
  type ReportSnapshotStory,
} from "@ai-news-navigator/database";
import type { IngestionLogger } from "@ai-news-navigator/pipeline";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export type ReportType = "daily" | "weekly" | "monthly";

export const REPORT_PROMPT_VERSION = "zh-editorial-report-v1";
const REPORT_MODEL =
  process.env.DEEPSEEK_REPORT_MODEL ??
  process.env.DEEPSEEK_MODEL ??
  "deepseek-v4-flash";
const REPORT_BASE_URL = (
  process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com"
).replace(/\/+$/, "");

const labels: Record<ReportSnapshotStory["contentType"], string> = {
  model: "模型进展",
  product: "产品与商业",
  news: "行业动态",
  paper: "论文研究",
};

const reportTitles: Record<ReportType, string> = {
  daily: "AI 日报",
  weekly: "AI 周报",
  monthly: "AI 月报",
};

interface ReportPeriod {
  type: ReportType;
  key: string;
  start: Date;
  end: Date;
}

interface EditorialOutput {
  introduction: string;
  sectionSummaries: Partial<Record<ReportSnapshotStory["contentType"], string>>;
}

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

function shanghaiDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateFromShanghaiKey(key: string): Date {
  return new Date(`${key}T00:00:00+08:00`);
}

function shiftCalendarDate(key: string, days: number): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function startOfIsoWeek(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  return shiftCalendarDate(dateKey, 1 - weekday);
}

function periodFromKey(type: ReportType, key: string): ReportPeriod {
  if (type === "daily") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error("Invalid daily key");
    return {
      type,
      key,
      start: dateFromShanghaiKey(key),
      end: dateFromShanghaiKey(shiftCalendarDate(key, 1)),
    };
  }

  if (type === "monthly") {
    if (!/^\d{4}-\d{2}$/.test(key)) throw new Error("Invalid monthly key");
    const year = Number(key.slice(0, 4));
    const month = Number(key.slice(5, 7));
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    return {
      type,
      key,
      start: dateFromShanghaiKey(`${key}-01`),
      end: dateFromShanghaiKey(
        `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
      ),
    };
  }

  const match = /^(\d{4})-W(\d{2})$/.exec(key);
  if (!match) throw new Error("Invalid weekly key");
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() - jan4Weekday + 1 + (week - 1) * 7);
  const startKey = jan4.toISOString().slice(0, 10);
  return {
    type,
    key,
    start: dateFromShanghaiKey(startKey),
    end: dateFromShanghaiKey(shiftCalendarDate(startKey, 7)),
  };
}

function currentPeriod(type: ReportType, now = new Date()): ReportPeriod {
  const today = shanghaiDateKey(now);
  if (type === "daily") return periodFromKey(type, today);
  if (type === "monthly") return periodFromKey(type, today.slice(0, 7));
  return periodFromKey(type, isoWeekKey(today));
}

function previousClosedPeriod(
  type: Exclude<ReportType, "daily">,
  now = new Date(),
): ReportPeriod {
  const today = shanghaiDateKey(now);
  if (type === "weekly") {
    return periodFromKey(
      type,
      isoWeekKey(shiftCalendarDate(startOfIsoWeek(today), -7)),
    );
  }
  const currentMonthStart = `${today.slice(0, 7)}-01`;
  return periodFromKey(
    type,
    shiftCalendarDate(currentMonthStart, -1).slice(0, 7),
  );
}

function cleanText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function estimateMinutes(sections: ReportSnapshotSection[]): number {
  const characters = sections.reduce(
    (total, section) =>
      total +
      section.stories.reduce(
        (storyTotal, story) =>
          storyTotal +
          story.title.length +
          story.summary.length +
          (story.whyItMatters?.length ?? 0),
        0,
      ),
    0,
  );
  return Math.max(1, Math.ceil(characters / 450));
}

async function loadReportSections(
  db: Database,
  period: ReportPeriod,
): Promise<ReportSnapshotSection[]> {
  const primaryItems = alias(items, "report_primary_items");
  const rows = await db
    .select({
      id: stories.id,
      slug: stories.slug,
      title: stories.title,
      score: sql<number>`coalesce(${stories.overallScore}, ${stories.relevanceScore}, 0)`,
      publishedAt: stories.lastPublishedAt,
      contentType: primaryItems.contentType,
      sourceName: sources.name,
    })
    .from(stories)
    .leftJoin(primaryItems, eq(stories.primaryItemId, primaryItems.id))
    .leftJoin(sources, eq(primaryItems.sourceId, sources.id))
    .where(
      and(
        inArray(stories.status, [
          "emerging",
          "confirmed",
          "cooling",
          "corrected",
        ]),
        inArray(primaryItems.contentType, [
          "news",
          "paper",
          "product",
          "model",
        ]),
        gte(stories.createdAt, period.start),
        lt(stories.createdAt, period.end),
      ),
    )
    .orderBy(
      desc(
        sql`coalesce(${stories.overallScore}, ${stories.relevanceScore}, 0)`,
      ),
    )
    .limit(200);

  if (rows.length === 0) return [];
  const analysisRows = await db
    .select({
      storyId: storyAnalyses.storyId,
      title: storyAnalyses.translatedTitle,
      summary: storyAnalyses.factualSummary,
      whyItMatters: storyAnalyses.whyItMatters,
      createdAt: storyAnalyses.createdAt,
    })
    .from(storyAnalyses)
    .where(
      inArray(
        storyAnalyses.storyId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(desc(storyAnalyses.createdAt));

  const latestAnalysis = new Map<string, (typeof analysisRows)[number]>();
  for (const analysis of analysisRows) {
    if (!latestAnalysis.has(analysis.storyId))
      latestAnalysis.set(analysis.storyId, analysis);
  }

  const limit = period.type === "daily" ? 5 : period.type === "weekly" ? 6 : 8;
  return (["model", "product", "news", "paper"] as const)
    .map((type): ReportSnapshotSection => {
      const selected = rows
        .filter((row) => row.contentType === type && latestAnalysis.has(row.id))
        .slice(0, limit)
        .map((row): ReportSnapshotStory => {
          const analysis = latestAnalysis.get(row.id)!;
          return {
            id: row.id,
            slug: row.slug,
            title: cleanText(analysis.title ?? row.title, 180),
            summary: cleanText(analysis.summary, 600),
            whyItMatters: analysis.whyItMatters
              ? cleanText(analysis.whyItMatters, 500)
              : null,
            sourceName: row.sourceName ?? "未知信源",
            contentType: type,
            score: Math.round(Number(row.score) * 100),
            publishedAt: row.publishedAt?.toISOString() ?? null,
          };
        });
      return {
        type,
        label: labels[type],
        editorialSummary: null,
        stories: selected,
      };
    })
    .filter((section) => section.stories.length > 0);
}

async function generateEditorial(
  type: Exclude<ReportType, "daily">,
  periodKey: string,
  sections: ReportSnapshotSection[],
): Promise<EditorialOutput | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey || sections.length === 0) return null;
  const evidence = sections.map((section) => ({
    type: section.type,
    label: section.label,
    stories: section.stories.map((story) => ({
      title: story.title,
      summary: story.summary,
      whyItMatters: story.whyItMatters,
    })),
  }));
  const response = await fetch(`${REPORT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: REPORT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是严谨的 AI 情报主编。只依据输入材料，用简体中文总结周期内的结构性变化；不重复标题，不补充外部事实，不使用营销话术。只返回 JSON。",
        },
        {
          role: "user",
          content: `为 ${periodKey} 的${type === "weekly" ? "周报" : "月报"}生成编辑导语与栏目总结。返回 {"introduction":"120-220字总览","sectionSummaries":{"model":"60-120字","product":"...","news":"...","paper":"..."}}，不存在的栏目不要输出。材料：${JSON.stringify(evidence)}`,
        },
      ],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      max_tokens: 1_200,
      stream: false,
    }),
  });
  const body = (await response.json()) as DeepSeekResponse;
  if (!response.ok)
    throw new Error(
      body.error?.message ?? `Report API failed: ${response.status}`,
    );
  const raw = body.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error("Report API returned an empty response");
  const parsed = JSON.parse(
    raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""),
  ) as EditorialOutput;
  return {
    introduction: cleanText(parsed.introduction ?? "", 800),
    sectionSummaries: Object.fromEntries(
      Object.entries(parsed.sectionSummaries ?? {}).map(([key, value]) => [
        key,
        cleanText(String(value), 500),
      ]),
    ),
  };
}

export interface ReportGenerationResult {
  type: ReportType;
  periodKey: string;
  storyCount: number;
  generated: boolean;
  usedModel: boolean;
}

export async function generateReportSnapshot(input: {
  db: Database;
  logger: IngestionLogger;
  type: ReportType;
  periodKey?: string;
  useModel?: boolean;
}): Promise<ReportGenerationResult> {
  const period = input.periodKey
    ? periodFromKey(input.type, input.periodKey)
    : currentPeriod(input.type);
  const sections = await loadReportSections(input.db, period);
  const storyCount = sections.reduce(
    (total, section) => total + section.stories.length,
    0,
  );
  if (storyCount === 0) {
    return {
      type: input.type,
      periodKey: period.key,
      storyCount,
      generated: false,
      usedModel: false,
    };
  }

  const [existing] = await input.db
    .select({
      content: reports.content,
      provider: reports.provider,
      model: reports.model,
      promptVersion: reports.promptVersion,
    })
    .from(reports)
    .where(
      and(eq(reports.type, period.type), eq(reports.periodKey, period.key)),
    )
    .limit(1);

  let generatedEditorial: EditorialOutput | null = null;
  if (
    input.type !== "daily" &&
    input.useModel !== false &&
    !existing?.provider
  ) {
    try {
      generatedEditorial = await generateEditorial(
        input.type,
        period.key,
        sections,
      );
    } catch (error) {
      input.logger.warn(
        "Report editorial generation failed; saving deterministic snapshot",
        {
          type: input.type,
          periodKey: period.key,
          error: error instanceof Error ? error.message : String(error),
        },
      );
    }
  }
  const introduction =
    generatedEditorial?.introduction || existing?.content.introduction || null;
  if (generatedEditorial || existing) {
    for (const section of sections) {
      section.editorialSummary =
        generatedEditorial?.sectionSummaries[section.type] ??
        existing?.content.sections.find(
          (existingSection) => existingSection.type === section.type,
        )?.editorialSummary ??
        null;
    }
  }

  const content: ReportSnapshotContent = {
    introduction,
    highlights: sections
      .flatMap((section) => section.stories)
      .slice(0, 5)
      .map((story) => story.id),
    sections,
  };
  await input.db
    .insert(reports)
    .values({
      type: period.type,
      periodKey: period.key,
      periodStart: period.start,
      periodEnd: period.end,
      title: reportTitles[period.type],
      content,
      storyCount,
      readingMinutes: estimateMinutes(sections),
      provider: generatedEditorial ? "deepseek" : (existing?.provider ?? null),
      model: generatedEditorial ? REPORT_MODEL : (existing?.model ?? null),
      promptVersion: generatedEditorial
        ? REPORT_PROMPT_VERSION
        : (existing?.promptVersion ?? null),
      generatedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [reports.type, reports.periodKey],
      set: {
        content,
        storyCount,
        readingMinutes: estimateMinutes(sections),
        provider: generatedEditorial
          ? "deepseek"
          : (existing?.provider ?? null),
        model: generatedEditorial ? REPORT_MODEL : (existing?.model ?? null),
        promptVersion: generatedEditorial
          ? REPORT_PROMPT_VERSION
          : (existing?.promptVersion ?? null),
        generatedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  input.logger.info("Report snapshot saved", {
    type: period.type,
    periodKey: period.key,
    storyCount,
    usedModel: generatedEditorial !== null,
  });
  return {
    type: period.type,
    periodKey: period.key,
    storyCount,
    generated: true,
    usedModel: generatedEditorial !== null,
  };
}

export async function runScheduledReportGeneration(input: {
  db: Database;
  logger: IngestionLogger;
  now?: Date;
}): Promise<ReportGenerationResult[]> {
  const now = input.now ?? new Date();
  const today = shanghaiDateKey(now);
  const results = [
    await generateReportSnapshot({
      db: input.db,
      logger: input.logger,
      type: "daily",
      periodKey: today,
      useModel: false,
    }),
  ];
  const dailyDateExpression = sql<string>`to_char(timezone('Asia/Shanghai', ${stories.createdAt}), 'YYYY-MM-DD')`;
  const [historicalDates, existingDailyReports] = await Promise.all([
    input.db
      .selectDistinct({ periodKey: dailyDateExpression })
      .from(stories)
      .where(gte(stories.createdAt, new Date(now.getTime() - 30 * 86_400_000)))
      .orderBy(desc(dailyDateExpression))
      .limit(14),
    input.db
      .select({ periodKey: reports.periodKey })
      .from(reports)
      .where(eq(reports.type, "daily")),
  ]);
  const existingDailyKeys = new Set(
    existingDailyReports.map((report) => report.periodKey),
  );
  for (const { periodKey } of historicalDates) {
    if (periodKey === today || existingDailyKeys.has(periodKey)) continue;
    results.push(
      await generateReportSnapshot({
        db: input.db,
        logger: input.logger,
        type: "daily",
        periodKey,
        useModel: false,
      }),
    );
  }
  for (const type of ["weekly", "monthly"] as const) {
    const period = currentPeriod(type, now);
    results.push(
      await generateReportSnapshot({
        db: input.db,
        logger: input.logger,
        type,
        periodKey: period.key,
      }),
    );
  }
  const utcCalendar = new Date(`${today}T00:00:00Z`);
  if (utcCalendar.getUTCDay() === 1) {
    const period = previousClosedPeriod("weekly", now);
    results.push(
      await generateReportSnapshot({
        db: input.db,
        logger: input.logger,
        type: "weekly",
        periodKey: period.key,
      }),
    );
  }
  if (utcCalendar.getUTCDate() === 1) {
    const period = previousClosedPeriod("monthly", now);
    results.push(
      await generateReportSnapshot({
        db: input.db,
        logger: input.logger,
        type: "monthly",
        periodKey: period.key,
      }),
    );
  }
  return results;
}

export const reportPeriodUtils = {
  currentPeriod,
  periodFromKey,
  previousClosedPeriod,
  shanghaiDateKey,
};
