import { ArrowRight, MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import { EmptyFeed } from "../components/empty-feed";
import { FeedPagination } from "../components/feed-pagination";
import { InfiniteStoryFeed } from "../components/infinite-story-feed";
import { StoryRow } from "../components/story-row";
import { contentTypeLabels, formatCalendarDate } from "../lib/presentation";
import { getDailyIssue, getStoryFeed, type ContentType } from "../lib/queries";
import { normalizeSearchQuery } from "../lib/search";

export const dynamic = "force-dynamic";

const FEED_PAGE_SIZE = 15;

const filters: Array<{ label: string; value?: ContentType }> = [
  { label: "全部" },
  { label: "新闻", value: "news" },
  { label: "论文", value: "paper" },
  { label: "产品", value: "product" },
  { label: "模型", value: "model" },
];

function parseContentType(value: string | undefined): ContentType | undefined {
  const allowed: ContentType[] = [
    "news",
    "paper",
    "product",
    "model",
    "release",
    "post",
    "other",
  ];
  return value && allowed.includes(value as ContentType)
    ? (value as ContentType)
    : undefined;
}

function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

function feedHref(contentType?: ContentType, searchQuery?: string, page = 1) {
  const params = new URLSearchParams();
  if (contentType) params.set("type", contentType);
  if (searchQuery) params.set("q", searchQuery);
  if (contentType && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; page?: string }>;
}) {
  if (!process.env.DATABASE_URL) return <DatabaseSetupState />;

  const { type, q, page } = await searchParams;
  const activeType = parseContentType(type);
  const searchQuery = normalizeSearchQuery(q);
  const requestedPage = activeType ? parsePage(page) : 1;
  const offset = activeType ? (requestedPage - 1) * FEED_PAGE_SIZE : 0;
  const [{ items, total }, dailyIssue] = await Promise.all([
    getStoryFeed(activeType, FEED_PAGE_SIZE, searchQuery, undefined, offset),
    getDailyIssue(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / FEED_PAGE_SIZE));
  if (activeType && requestedPage > totalPages) {
    redirect(feedHref(activeType, searchQuery, totalPages));
  }
  const focusStory = dailyIssue.items[0];
  const focusSummary =
    focusStory?.factualSummary ??
    (focusStory
      ? "中文解读尚未生成。规则信号只用于筛选，不代替事实摘要或产品判断。"
      : "今日焦点正在等待第一条可验证的 Story。");
  const focusTitle = focusStory?.translatedTitle ?? focusStory?.title;

  return (
    <main>
      <section className="dailyBrief" aria-labelledby="brief-title">
        <div className="briefLead">
          <div className="introDate">
            {formatCalendarDate(dailyIssue.issueDate)}
          </div>
          <div className="briefOverview" aria-labelledby="brief-title">
            <div className="briefOverviewHeader">
              <h1 id="brief-title">本期概览</h1>
              <strong>{dailyIssue.total}</strong>
            </div>
            <p className="briefOverviewMeta">
              约 {dailyIssue.readingMinutes} 分钟读完
            </p>
            <dl>
              <div>
                <dt>新闻</dt>
                <dd>{dailyIssue.counts.news}</dd>
              </div>
              <div>
                <dt>论文</dt>
                <dd>{dailyIssue.counts.paper}</dd>
              </div>
              <div>
                <dt>产品</dt>
                <dd>{dailyIssue.counts.product}</dd>
              </div>
              <div>
                <dt>模型</dt>
                <dd>{dailyIssue.counts.model}</dd>
              </div>
            </dl>
            <Link href={`/daily?date=${dailyIssue.issueDate}`}>
              阅读本期日报
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
        </div>

        {focusStory ? (
          <article className="focusPanel">
            <div className="focusContent">
              <h2>今日焦点</h2>
              <h3 className="focusTitle">
                <Link
                  className="focusTitleLink"
                  href={`/stories/${focusStory.slug}`}
                  lang={focusStory.translatedTitle ? undefined : "en"}
                >
                  {focusTitle}
                </Link>
              </h3>
              {focusStory.hasAnalysis ? (
                <dl className="focusNotes">
                  <div>
                    <dt>发生了什么</dt>
                    <dd>{focusStory.factualSummary}</dd>
                  </div>
                  {focusStory.whyItMatters ? (
                    <div>
                      <dt>为什么值得看</dt>
                      <dd>{focusStory.whyItMatters}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : (
                <p className="focusSummary">{focusSummary}</p>
              )}
            </div>
            <div className="focusScore">
              <span>产品相关度</span>
              <strong>
                {Math.round(
                  (focusStory.overallScore ?? focusStory.relevanceScore ?? 0) *
                    100,
                )}
              </strong>
              <small>
                类别：
                {focusStory.contentType
                  ? contentTypeLabels[focusStory.contentType]
                  : "情报"}
              </small>
              <small>来源：{focusStory.sourceName ?? "未知信源"}</small>
              <Link
                className="focusLinkHint"
                href={`/stories/${focusStory.slug}`}
              >
                阅读全文 <ArrowRight aria-hidden="true" size={15} />
              </Link>
            </div>
          </article>
        ) : (
          <div className="focusPanel focusPanelEmpty">
            <div className="focusContent">
              <h2>今日焦点</h2>
              <p className="focusEmptyTitle">等待第一条可验证的 Story</p>
              <p className="focusSummary">{focusSummary}</p>
            </div>
          </div>
        )}
      </section>

      <div className="contentShell homeFeedShell">
        <section className="feedColumn" aria-labelledby="feed-title">
          <div className="feedToolbar">
            <nav className="filterNav" aria-label="内容筛选">
              {filters.map((filter) => {
                const active =
                  filter.value === activeType || (!filter.value && !activeType);
                return (
                  <Link
                    key={filter.label}
                    className={active ? "active" : undefined}
                    href={feedHref(filter.value, searchQuery)}
                    aria-current={active ? "page" : undefined}
                  >
                    {filter.label}
                  </Link>
                );
              })}
            </nav>
            <form className="feedSearch" action="/" role="search">
              <h2 id="feed-title">情报流</h2>
              {activeType ? (
                <input type="hidden" name="type" value={activeType} />
              ) : null}
              <div className="feedSearchField">
                <MagnifyingGlass aria-hidden="true" size={16} />
                <input
                  id="story-search"
                  name="q"
                  type="search"
                  aria-label="搜索情报"
                  defaultValue={searchQuery}
                  maxLength={80}
                  autoComplete="off"
                  placeholder="标题、主题或摘要"
                />
                {searchQuery ? (
                  <Link
                    className="feedSearchClear"
                    href={feedHref(activeType)}
                    aria-label="清除搜索"
                    title="清除搜索"
                  >
                    <X aria-hidden="true" size={15} />
                  </Link>
                ) : null}
              </div>
              {searchQuery ? (
                <span className="feedSearchCount">{total} 条结果</span>
              ) : null}
            </form>
          </div>

          {items.length > 0 ? (
            <div className="storyColumns" aria-hidden="true">
              <span>#</span>
              <span>Story</span>
              <span>
                {activeType === "product" ? "产品简介" : "为什么值得看"}
              </span>
              <span>相关度</span>
            </div>
          ) : null}

          {items.length === 0 ? (
            <EmptyFeed
              filtered={Boolean(activeType)}
              searchQuery={searchQuery}
              clearHref={feedHref(activeType)}
            />
          ) : (
            <>
              {activeType ? (
                <div className="storyList">
                  {items.map((story, index) => (
                    <StoryRow
                      story={story}
                      index={offset + index}
                      key={story.id}
                    />
                  ))}
                </div>
              ) : (
                <InfiniteStoryFeed
                  key={searchQuery ?? "all-stories"}
                  initialItems={items}
                  total={total}
                  searchQuery={searchQuery}
                />
              )}
            </>
          )}

          {activeType ? (
            <FeedPagination
              contentType={activeType}
              currentPage={requestedPage}
              totalPages={totalPages}
              searchQuery={searchQuery}
            />
          ) : null}
        </section>
      </div>
    </main>
  );
}

function DatabaseSetupState() {
  return (
    <main className="setupPage">
      <div className="setupGrid">
        <div>
          <p className="setupLabel">需要完成一次本地配置</p>
          <h1>连接数据库，情报流就会出现。</h1>
          <p className="setupDescription">
            页面不会填充样例新闻。配置 PostgreSQL 后，真实的抓取、评分和 Story
            聚类结果会直接呈现在这里。
          </p>
        </div>
        <ol className="setupSteps">
          <li>
            <span>环境变量</span>
            <code>DATABASE_URL=postgresql://...</code>
          </li>
          <li>
            <span>初始化数据库</span>
            <code>pnpm db:migrate</code>
          </li>
          <li>
            <span>生成情报流</span>
            <code>pnpm ingest:due &amp;&amp; pnpm process:stories</code>
          </li>
        </ol>
      </div>
    </main>
  );
}
