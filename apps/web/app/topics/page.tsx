import { ArrowRight, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { CURATED_TOPICS } from "@ai-news-navigator/intelligence";
import type { Metadata } from "next";
import Link from "next/link";

import { getTopicIndex, type TopicIndexItem } from "../../lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "主题地图",
  description: "按稳定主题浏览 AI 新闻、论文、产品与模型进展。",
};

export default async function TopicsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const normalizedQuery = query.toLocaleLowerCase("zh-CN");
  const topicItems = process.env.DATABASE_URL
    ? await getTopicIndex()
    : CURATED_TOPICS.map((topic) => ({
        ...topic,
        total: 0,
        recentCount: 0,
        latestStory: null,
      }));
  const sortedTopics = [...topicItems].sort(
    (a, b) => b.recentCount - a.recentCount || b.total - a.total,
  );
  const visibleTopics = normalizedQuery
    ? sortedTopics.filter((topic) => {
        const latestTitle = topic.latestStory
          ? (topic.latestStory.translatedTitle ?? topic.latestStory.title)
          : "";
        return [topic.name, topic.slug, topic.description, latestTitle].some(
          (value) => value.toLocaleLowerCase("zh-CN").includes(normalizedQuery),
        );
      })
    : sortedTopics;
  const focusTopics = visibleTopics.filter((topic) => topic.group === "focus");
  const foundationTopics = visibleTopics.filter(
    (topic) => topic.group === "foundation",
  );
  const totalRelations = topicItems.reduce(
    (sum, topic) => sum + topic.total,
    0,
  );
  const recentRelations = topicItems.reduce(
    (sum, topic) => sum + topic.recentCount,
    0,
  );

  return (
    <main className="topicsPage">
      <header className="topicsIndexHero">
        <div>
          <p className="topicsEyebrow">
            TOPIC MAP · {topicItems.length} DIRECTIONS
          </p>
          <h1>按主题看 AI</h1>
          <p className="topicsIndexDescription">
            不追逐每天变化的标签。用稳定主题，把新闻、论文、产品与模型放回同一条演进脉络。
          </p>
        </div>
        <dl
          className="topicsIndexStats"
          title="同一 Story 可以进入多个相关主题"
        >
          <div>
            <dt>主题关联</dt>
            <dd>{totalRelations}</dd>
          </div>
          <div>
            <dt>近 7 天</dt>
            <dd>{recentRelations}</dd>
          </div>
        </dl>
      </header>

      <div className="topicsIndexTools">
        <span>{query ? `“${query}”的匹配结果` : "按近 7 天活跃度排序"}</span>
        <form action="/topics" className="topicsSearch" method="get">
          <MagnifyingGlass aria-hidden="true" size={18} />
          <input
            aria-label="搜索主题或进展"
            defaultValue={query}
            name="q"
            placeholder="搜索主题或进展…"
            type="search"
          />
        </form>
      </div>

      {focusTopics.length > 0 ? (
        <section className="topicDirectionGroup" aria-labelledby="focus">
          <header className="topicDirectionHeader">
            <h2 id="focus">重点方向</h2>
            <p>持续影响产品判断与近期实践的主线</p>
          </header>
          <div className="topicDirectionList">
            {focusTopics.map((topic) => (
              <TopicDirectionRow key={topic.slug} topic={topic} />
            ))}
          </div>
        </section>
      ) : null}

      {foundationTopics.length > 0 ? (
        <section className="topicDirectionGroup" aria-labelledby="foundation">
          <header className="topicDirectionHeader compact">
            <h2 id="foundation">其他主题</h2>
            <p>进展较慢，按需查看</p>
          </header>
          <div className="topicCompactList">
            {foundationTopics.map((topic) => {
              const latestTitle = topic.latestStory
                ? (topic.latestStory.translatedTitle ?? topic.latestStory.title)
                : topic.description;
              return (
                <Link
                  className="topicCompactRow"
                  href={`/topics/${topic.slug}`}
                  key={topic.slug}
                >
                  <div>
                    <h3>{topic.name}</h3>
                    <p>{latestTitle}</p>
                  </div>
                  <span>
                    {topic.recentCount} / {topic.total}
                  </span>
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {visibleTopics.length === 0 ? (
        <section className="topicSearchEmpty">
          <p>没有匹配“{query}”的主题或近期进展。</p>
          <Link href="/topics">查看全部主题</Link>
        </section>
      ) : null}
    </main>
  );
}

function TopicDirectionRow({ topic }: { topic: TopicIndexItem }) {
  const latestTitle = topic.latestStory
    ? (topic.latestStory.translatedTitle ?? topic.latestStory.title)
    : "等待第一条相关 Story";

  return (
    <Link className="topicDirectionRow" href={`/topics/${topic.slug}`}>
      <div className="topicDirectionMain">
        <div>
          <h3>{topic.name}</h3>
          <span>{topic.slug.replaceAll("-", " ").toUpperCase()}</span>
        </div>
        <p>{topic.description}</p>
        <small>
          <b>最新</b> {latestTitle}
        </small>
      </div>
      <dl>
        <div>
          <dt>近 7 天</dt>
          <dd>{topic.recentCount}</dd>
        </div>
        <div>
          <dt>共</dt>
          <dd>{topic.total} 条</dd>
        </div>
      </dl>
      <ArrowRight aria-hidden="true" size={18} />
    </Link>
  );
}
