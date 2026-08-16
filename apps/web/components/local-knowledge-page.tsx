"use client";

import {
  ArrowLeft,
  ArrowRight,
  Books,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { localDistillAnalysis } from "../lib/distill-local";
import {
  readPrivateWorkspace,
  type PrivateWorkspaceSnapshot,
} from "../lib/private-workspace";

export function LocalKnowledgePage({ query }: { query: string }) {
  const [snapshot, setSnapshot] = useState<PrivateWorkspaceSnapshot | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    readPrivateWorkspace()
      .then(setSnapshot)
      .catch(() => setFailed(true));
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const cards = useMemo(
    () =>
      (snapshot?.knowledgeCards ?? []).filter(
        (card) =>
          !normalizedQuery ||
          `${card.title} ${card.content} ${card.sourceTitle ?? ""}`
            .toLocaleLowerCase("zh-CN")
            .includes(normalizedQuery),
      ),
    [normalizedQuery, snapshot],
  );
  const documents = useMemo(
    () =>
      (snapshot?.distillRecords ?? [])
        .filter((record) => record.savedToKnowledge)
        .map((record) => ({ record, analysis: localDistillAnalysis(record) }))
        .filter((item) => item.analysis)
        .filter(
          ({ record, analysis }) =>
            !normalizedQuery ||
            `${analysis?.title ?? ""} ${analysis?.summary ?? ""} ${record.sourceTitle ?? ""}`
              .toLocaleLowerCase("zh-CN")
              .includes(normalizedQuery),
        ),
    [normalizedQuery, snapshot],
  );

  return (
    <main className="knowledgePage">
      <header className="knowledgeHero">
        <Link href="/distill">
          <ArrowLeft aria-hidden="true" size={15} />
          脱水工作台
        </Link>
        <div>
          <Books aria-hidden="true" size={28} />
          <p>当前浏览器的私人知识空间</p>
          <h1>读完之后，留下真正有用的部分。</h1>
          <span>
            匿名画像、脱水结果和知识卡只保存在当前浏览器，不会上传到站点数据库。建议在私人设置中定期导出加密备份。
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
          aria-label="搜索本机知识库"
        />
        <button type="submit">搜索</button>
      </form>

      {query ? (
        <p className="knowledgeSearchResult">
          “{query}”找到 {cards.length} 张知识卡、{documents.length} 份完整文档
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
                  <small>来自《{card.sourceTitle || "本机脱水内容"}》</small>
                  {card.sourceDocumentId ? (
                    <Link
                      href={`/distill?local=${encodeURIComponent(card.sourceDocumentId)}`}
                    >
                      回到原文
                      <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  ) : null}
                </footer>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {documents.length ? (
        <section className="knowledgeCollection" aria-label="本机知识条目">
          <div className="knowledgeSectionTitle">
            <p>完整文档</p>
            <h2>已保存的脱水内容</h2>
          </div>
          {documents.map(({ record, analysis }, index) => (
            <article key={record.id}>
              <span className="knowledgeIndex">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p>
                  {record.sourceType === "url" ? "网页脱水" : "正文脱水"}
                  <span>
                    {new Intl.DateTimeFormat("zh-CN", {
                      year: "numeric",
                      month: "numeric",
                      day: "numeric",
                    }).format(new Date(record.createdAt))}
                  </span>
                </p>
                <Link href={`/distill?local=${encodeURIComponent(record.id)}`}>
                  <h2>{analysis?.title}</h2>
                  <span>{analysis?.summary}</span>
                </Link>
              </div>
              <Link
                className="knowledgeOpen"
                href={`/distill?local=${encodeURIComponent(record.id)}`}
                aria-label={`打开 ${analysis?.title}`}
              >
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
            </article>
          ))}
        </section>
      ) : !cards.length ? (
        <section className="knowledgeEmpty">
          {failed ? (
            <MagnifyingGlass aria-hidden="true" size={30} />
          ) : (
            <Books aria-hidden="true" size={30} />
          )}
          <h2>{failed ? "无法读取本机知识库" : "知识库还是空的"}</h2>
          <p>
            {failed
              ? "请检查浏览器是否允许站点使用本地存储。"
              : "完成公开体验后，可以把整份内容或知识卡保存到这里。"}
          </p>
          <Link href="/distill">返回脱水工作台</Link>
        </section>
      ) : null}
    </main>
  );
}
