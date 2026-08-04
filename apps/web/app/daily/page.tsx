import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { ReportSnapshotStory } from "@ai-news-navigator/database";
import type { Metadata } from "next";
import Link from "next/link";

import { contentTypeLabels } from "../../lib/presentation";
import {
  getReportArchive,
  getReportIssue,
  type ReportIssue,
  type ReportType,
} from "../../lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI 情报简报",
  description: "按日、周、月阅读最值得关注的 AI 新闻、论文、产品和模型。",
};

const reportTypes: Array<{
  type: ReportType;
  label: string;
  archiveLabel: string;
}> = [
  { type: "daily", label: "日报", archiveLabel: "往期日报" },
  { type: "weekly", label: "周报", archiveLabel: "往期周报" },
  { type: "monthly", label: "月报", archiveLabel: "往期月报" },
];

const englishLabels = {
  model: "MODEL RADAR",
  product: "PRODUCT",
  news: "INDUSTRY",
  paper: "RESEARCH",
} as const;

function isReportType(value?: string): value is ReportType {
  return value === "daily" || value === "weekly" || value === "monthly";
}

function formatPeriodLabel(type: ReportType, key: string): string {
  if (type === "daily") {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }).format(new Date(`${key}T00:00:00Z`));
  }
  if (type === "monthly") {
    const [year, month] = key.split("-");
    return `${year} 年 ${Number(month)} 月`;
  }
  return key.replace("-W", " 年第 ") + " 周";
}

function compactPeriodLabel(type: ReportType, key: string): string {
  if (type === "daily")
    return `${Number(key.slice(5, 7))}月${Number(key.slice(8, 10))}日`;
  if (type === "monthly") return `${Number(key.slice(5, 7))}月`;
  return `第 ${Number(key.slice(-2))} 周`;
}

function compactPeriodMeta(type: ReportType, key: string): string {
  if (type === "daily") {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "UTC",
      weekday: "long",
    }).format(new Date(`${key}T00:00:00Z`));
  }
  if (type === "monthly") return `${key.slice(0, 4)} 年`;
  return key.slice(0, 4);
}

function reportHref(type: ReportType, period?: string): string {
  const params = new URLSearchParams({ type });
  if (period) params.set("period", period);
  return `/daily?${params.toString()}`;
}

function allStories(issue: ReportIssue): ReportSnapshotStory[] {
  return issue.content.sections.flatMap((section) => section.stories);
}

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; period?: string }>;
}) {
  if (!process.env.DATABASE_URL) return <ReportUnavailable />;

  const params = await searchParams;
  const type = isReportType(params.type) ? params.type : "daily";
  const [archive, issue] = await Promise.all([
    getReportArchive(),
    getReportIssue(type, params.period),
  ]);
  const typeArchive = archive.filter((item) => item.type === type);
  const activeDefinition = reportTypes.find((item) => item.type === type)!;

  return (
    <main className="dailyPage">
      <div className="reportLayout">
        <aside className="reportArchive" aria-label="简报归档">
          <div className="reportArchiveHeader">
            <span>AI NEWS NAVIGATOR</span>
            <strong>情报简报</strong>
          </div>
          <nav className="reportTypeTabs" aria-label="简报类型">
            {reportTypes.map((item) => (
              <Link
                aria-current={item.type === type ? "page" : undefined}
                href={reportHref(item.type)}
                key={item.type}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="reportArchiveList">
            <p>{activeDefinition.archiveLabel}</p>
            {typeArchive.length > 0 ? (
              typeArchive.map((item) => (
                <Link
                  aria-current={
                    item.periodKey === issue?.periodKey ? "page" : undefined
                  }
                  href={reportHref(type, item.periodKey)}
                  key={`${item.type}-${item.periodKey}`}
                >
                  <span className="reportArchivePeriod">
                    <strong>{compactPeriodLabel(type, item.periodKey)}</strong>
                    <small>{compactPeriodMeta(type, item.periodKey)}</small>
                  </span>
                  <b>{item.storyCount}</b>
                </Link>
              ))
            ) : (
              <span className="reportArchiveEmpty">首期生成后会保存在这里</span>
            )}
          </div>
          <Link className="reportBackLink" href="/">
            <ArrowLeft aria-hidden="true" size={14} />
            返回情报流
          </Link>
        </aside>

        {issue ? <ReportArticle issue={issue} /> : <EmptyReport type={type} />}
      </div>
    </main>
  );
}

function ReportArticle({ issue }: { issue: ReportIssue }) {
  const stories = allStories(issue);
  const highlightIds = new Set(issue.content.highlights);
  const highlights = stories
    .filter((story) => highlightIds.has(story.id))
    .slice(0, 5);

  return (
    <article className="dailyIssueShell">
      <header className="dailyIssueHeader">
        <div className="dailyIssueEyebrow">
          <span>AI NEWS NAVIGATOR</span>
          <span>
            {issue.type.toUpperCase()} · {issue.periodKey.replaceAll("-", ".")}
          </span>
        </div>
        <div className="dailyIssueTitleRow">
          <div>
            <h1>{issue.title}</h1>
            <p>{formatPeriodLabel(issue.type, issue.periodKey)}</p>
          </div>
          <dl className="dailyIssueSummary">
            <div>
              <dt>本期重点</dt>
              <dd>{issue.storyCount}</dd>
            </div>
            <div>
              <dt>预计阅读</dt>
              <dd>{issue.readingMinutes} 分钟</dd>
            </div>
          </dl>
        </div>
        {issue.content.introduction ? (
          <p className="reportIntroduction">{issue.content.introduction}</p>
        ) : null}
      </header>

      <nav className="dailyContents" aria-label="本期分类概览">
        {issue.content.sections.map((section, index) => (
          <a key={section.type} href={`#report-${section.type}`}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            {section.label}
            <small>{section.stories.length}</small>
          </a>
        ))}
      </nav>

      <section className="dailyHighlights" aria-labelledby="highlights-title">
        <div className="dailySectionHeading">
          <span>00</span>
          <div>
            <p>PERIOD HIGHLIGHTS</p>
            <h2 id="highlights-title">本期看点</h2>
          </div>
        </div>
        <ol>
          {highlights.map((story, index) => (
            <li key={story.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Link href={`/stories/${story.slug}`}>{story.title}</Link>
              <small>{contentTypeLabels[story.contentType]}</small>
            </li>
          ))}
        </ol>
      </section>

      <div className="dailySections">
        {issue.content.sections.map((section, sectionIndex) => (
          <section
            className="dailySection"
            id={`report-${section.type}`}
            key={section.type}
          >
            <div className="dailySectionHeading">
              <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
              <div>
                <p>{englishLabels[section.type]}</p>
                <h2>{section.label}</h2>
              </div>
              <strong>{section.stories.length} 条</strong>
            </div>
            {section.editorialSummary ? (
              <p className="reportSectionSummary">{section.editorialSummary}</p>
            ) : null}
            <div className="dailyStoryList">
              {section.stories.map((story) => (
                <article className="dailyStory" key={story.id}>
                  <div className="dailyStoryMeta">
                    <span>{story.sourceName}</span>
                    <span>{story.score}</span>
                  </div>
                  <h3>
                    <Link href={`/stories/${story.slug}`}>{story.title}</Link>
                  </h3>
                  <p>{story.summary}</p>
                  {story.whyItMatters ? (
                    <div className="dailyWhy">
                      <strong>为什么值得看</strong>
                      <span>{story.whyItMatters}</span>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <nav className="dailyDateNav" aria-label="简报周期导航">
        {issue.previousKey ? (
          <Link href={reportHref(issue.type, issue.previousKey)}>
            <ArrowLeft aria-hidden="true" size={16} /> 前一期
          </Link>
        ) : (
          <span />
        )}
        <Link href="/">返回情报流</Link>
        {issue.nextKey ? (
          <Link href={reportHref(issue.type, issue.nextKey)}>
            后一期 <ArrowRight aria-hidden="true" size={16} />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}

function EmptyReport({ type }: { type: ReportType }) {
  const label = reportTypes.find((item) => item.type === type)!.label;
  return (
    <section className="dailyIssueShell dailyEmpty standalone">
      <p>首期{label}正在积累</p>
      <h1>周期内有足够的中文解读后，会自动生成并保存在归档中。</h1>
      <Link href="/">返回情报流</Link>
    </section>
  );
}

function ReportUnavailable() {
  return (
    <main className="dailyPage">
      <section className="dailyEmpty standalone">
        <p>需要完成一次本地配置</p>
        <h1>连接数据库后，简报会自动生成。</h1>
        <Link href="/">返回首页</Link>
      </section>
    </main>
  );
}
