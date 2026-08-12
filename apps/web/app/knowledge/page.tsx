import {
  ArrowLeft,
  ArrowRight,
  Books,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getDistillSession } from "../../lib/distill-auth";
import { normalizePrivateSearchQuery } from "../../lib/distill-search";
import { listKnowledgeCards, listKnowledgeEntries } from "../../lib/distill";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "知识库",
  description: "从新闻、长文和后续视频中沉淀的私人知识卡片。",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getDistillSession();
  if (!session) redirect("/distill/access?next=/knowledge");
  const query = normalizePrivateSearchQuery((await searchParams).q);
  const [entries, cards] = process.env.DATABASE_URL
    ? await Promise.all([
        listKnowledgeEntries(session.ownerId, query ? 100 : 40, query),
        listKnowledgeCards(session.ownerId, query ? 120 : 60, query),
      ])
    : [[], []];

  return (
    <main className="knowledgePage">
      <header className="knowledgeHero">
        <Link href="/distill">
          <ArrowLeft aria-hidden="true" size={15} />
          脱水工作台
        </Link>
        <div>
          <Books aria-hidden="true" size={28} />
          <p>私人知识空间</p>
          <h1>读完之后，留下真正有用的部分。</h1>
          <span>
            当前先沉淀脱水内容。后续新闻收藏、视频知识和跨内容检索将汇入同一结构。
          </span>
        </div>
      </header>

      <form className="knowledgeSearch" action="/knowledge" method="get">
        <MagnifyingGlass aria-hidden="true" size={18} />
        <input
          type="search"
          name="q"
          defaultValue={query}
          maxLength={120}
          placeholder="搜索标题、导读、知识卡片或来源"
          aria-label="搜索私人知识库"
        />
        <button type="submit">搜索</button>
      </form>

      {query ? (
        <p className="knowledgeSearchResult">
          “{query}”找到 {cards.length} 张知识卡、{entries.length} 份完整文档
        </p>
      ) : null}

      {cards.length ? (
        <section
          className="knowledgeCardsCollection"
          aria-labelledby="cards-title"
        >
          <div className="knowledgeSectionTitle">
            <p>可复用判断</p>
            <h2 id="cards-title">知识卡片</h2>
          </div>
          <div>
            {cards.map((card, index) => (
              <article key={card.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{card.title}</h3>
                <p>{card.content}</p>
                <footer>
                  <small>
                    来自《{card.documentTitle || card.sourceTitle || "脱水内容"}
                    》
                  </small>
                  <Link href={`/distill/${card.documentId}`}>
                    回到原文
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {entries.length ? (
        <section className="knowledgeCollection" aria-label="知识条目">
          <div className="knowledgeSectionTitle">
            <p>完整文档</p>
            <h2>已保存的脱水内容</h2>
          </div>
          {entries.map((entry, index) => (
            <article key={entry.id}>
              <span className="knowledgeIndex">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p>
                  {entry.sourceType === "url" ? "网页脱水" : "正文脱水"}
                  <span>
                    {new Intl.DateTimeFormat("zh-CN", {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                    }).format(entry.createdAt)}
                  </span>
                </p>
                <Link href={`/distill/${entry.documentId}`}>
                  <h2>{entry.title}</h2>
                  <span>{entry.summary}</span>
                </Link>
              </div>
              <Link
                className="knowledgeOpen"
                href={`/distill/${entry.documentId}`}
                aria-label={`打开 ${entry.title}`}
              >
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </article>
          ))}
        </section>
      ) : !cards.length && query ? (
        <section className="knowledgeEmpty">
          <MagnifyingGlass aria-hidden="true" size={30} />
          <h2>没有找到匹配内容</h2>
          <p>试试标题中的产品名、技术词或你保存过的判断。</p>
          <Link href="/knowledge">清除搜索</Link>
        </section>
      ) : !cards.length ? (
        <section className="knowledgeEmpty">
          <Books aria-hidden="true" size={30} />
          <h2>知识库还是空的</h2>
          <p>完成一次脱水后，点击“存入知识库”即可沉淀到这里。</p>
          <Link href="/distill">
            开始第一次脱水
            <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>
      ) : null}
    </main>
  );
}
