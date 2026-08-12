import {
  ArrowDown,
  ArrowLeft,
  MagnifyingGlass,
  Newspaper,
  X,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StoryRow } from "../../../components/story-row";
import {
  getCuratedTopic,
  getStoryFeed,
  getTopicIndex,
  type ContentType,
} from "../../../lib/queries";
import { normalizeSearchQuery } from "../../../lib/search";

export const dynamic = "force-dynamic";

const filters: Array<{ label: string; value?: ContentType }> = [
  { label: "全部" },
  { label: "新闻", value: "news" },
  { label: "论文", value: "paper" },
  { label: "产品", value: "product" },
  { label: "模型", value: "model" },
];

function parseContentType(value: string | undefined): ContentType | undefined {
  const allowed: ContentType[] = ["news", "paper", "product", "model"];
  return value && allowed.includes(value as ContentType)
    ? (value as ContentType)
    : undefined;
}

function topicHref(
  slug: string,
  contentType?: ContentType,
  searchQuery?: string,
) {
  const params = new URLSearchParams();
  if (contentType) params.set("type", contentType);
  if (searchQuery) params.set("q", searchQuery);
  const query = params.toString();
  const path = `/topics/${slug}`;
  return query ? `${path}?${query}` : path;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = getCuratedTopic(slug);
  if (!topic) return {};
  return { title: topic.name, description: topic.description };
}

export default async function TopicDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const [{ slug }, { type, q }] = await Promise.all([params, searchParams]);
  const topic = getCuratedTopic(slug);
  if (!topic) notFound();

  const activeType = parseContentType(type);
  const searchQuery = normalizeSearchQuery(q);
  const [{ items, total }, topicIndex] = await Promise.all([
    getStoryFeed(activeType, 30, searchQuery, topic.slug),
    getTopicIndex(),
  ]);
  const topicStats = topicIndex.find((item) => item.slug === topic.slug);

  return (
    <main className="topicDetailPage">
      <header className="topicDetailHero">
        <Link className="topicBackLink" href="/topics">
          <ArrowLeft aria-hidden="true" size={15} />
          返回主题地图
        </Link>
        <div className="topicDetailTitle">
          <div>
            <p>TOPIC · CURATED VIEW</p>
            <h1>{topic.name}</h1>
          </div>
          <p>{topic.description}</p>
        </div>
        <dl className="topicDetailStats">
          <div>
            <dt>全部 Story</dt>
            <dd>{topicStats?.total ?? total}</dd>
          </div>
          <div>
            <dt>近 7 天</dt>
            <dd>{topicStats?.recentCount ?? 0}</dd>
          </div>
          <div>
            <dt>当前结果</dt>
            <dd>{total}</dd>
          </div>
        </dl>
      </header>

      <section className="topicFeed" aria-labelledby="topic-feed-title">
        <div className="feedToolbar">
          <nav className="filterNav" aria-label="内容筛选">
            {filters.map((filter) => {
              const active =
                filter.value === activeType || (!filter.value && !activeType);
              return (
                <Link
                  key={filter.label}
                  className={active ? "active" : undefined}
                  href={topicHref(topic.slug, filter.value, searchQuery)}
                  aria-current={active ? "page" : undefined}
                >
                  {filter.label}
                </Link>
              );
            })}
          </nav>
          <form
            className="feedSearch"
            action={`/topics/${topic.slug}`}
            role="search"
          >
            <h2 id="topic-feed-title">主题情报</h2>
            {activeType ? (
              <input type="hidden" name="type" value={activeType} />
            ) : null}
            <div className="feedSearchField">
              <MagnifyingGlass aria-hidden="true" size={16} />
              <input
                name="q"
                type="search"
                aria-label={`搜索${topic.name}情报`}
                defaultValue={searchQuery}
                maxLength={80}
                autoComplete="off"
                placeholder="在本主题中搜索"
              />
              {searchQuery ? (
                <Link
                  className="feedSearchClear"
                  href={topicHref(topic.slug, activeType)}
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
            <span>为什么值得看</span>
            <span>类别评分</span>
          </div>
        ) : null}

        {items.length === 0 ? (
          <section className="emptyState">
            {searchQuery ? (
              <MagnifyingGlass aria-hidden="true" size={32} weight="light" />
            ) : (
              <Newspaper aria-hidden="true" size={32} weight="light" />
            )}
            <h2>
              {searchQuery
                ? `没有找到“${searchQuery}”`
                : "这个主题正在等待第一条 Story"}
            </h2>
            <p>
              {searchQuery
                ? "试试更短的关键词，或切换内容分类后再次搜索。"
                : "新内容完成 Story 处理后，会按可解释规则自动进入相关主题。"}
            </p>
            {searchQuery || activeType ? (
              <Link className="emptyStateAction" href={topicHref(topic.slug)}>
                查看本主题全部内容
              </Link>
            ) : null}
          </section>
        ) : (
          <div className="storyList">
            {items.map((story, index) => (
              <StoryRow story={story} index={index} key={story.id} />
            ))}
          </div>
        )}

        {total > items.length ? (
          <div className="feedLimit">
            <ArrowDown aria-hidden="true" size={17} />
            当前展示各类别评分靠前的 {items.length} 条，共 {total} 条
          </div>
        ) : null}
      </section>
    </main>
  );
}
