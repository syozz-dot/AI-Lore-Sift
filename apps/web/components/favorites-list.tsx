"use client";

import { ArrowRight, BookmarkSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  FAVORITES_CHANGED_EVENT,
  FAVORITES_STORAGE_KEY,
  notifyFavoritesChanged,
  readFavorites,
  removeFavorite,
  writeFavorites,
  type FavoriteStory,
} from "../lib/favorites";
import { formatScore } from "../lib/presentation";
import { PrivateMemoryCandidate } from "./private-memory-candidate";

function formatStoredDate(value: string | null) {
  if (!value) return "时间未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function FavoritesList() {
  const [favorites, setFavorites] = useState<FavoriteStory[] | null>(null);
  const [query, setQuery] = useState("");

  const syncFavorites = useCallback(() => {
    setFavorites(readFavorites(window.localStorage));
  }, []);

  useEffect(() => {
    syncFavorites();

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === FAVORITES_STORAGE_KEY) syncFavorites();
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavorites);
    };
  }, [syncFavorites]);

  function remove(slug: string) {
    const next = removeFavorite(readFavorites(window.localStorage), slug);
    writeFavorites(window.localStorage, next);
    setFavorites(next);
    notifyFavoritesChanged();
  }

  if (favorites === null) {
    return (
      <div className="favoritesLoading" aria-label="正在读取收藏">
        <span />
        <span />
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <section className="favoritesEmpty">
        <BookmarkSimple aria-hidden="true" size={28} />
        <h2>还没有收藏内容</h2>
        <p>打开一篇 Story，点击标题上方的收藏按钮即可保存在这里。</p>
        <Link href="/">
          返回情报流
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </section>
    );
  }

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const visibleFavorites = normalizedQuery
    ? favorites.filter((story) =>
        [story.title, story.originalTitle, story.summary, story.sourceName]
          .filter(Boolean)
          .some((value) =>
            String(value).toLocaleLowerCase("zh-CN").includes(normalizedQuery),
          ),
      )
    : favorites;

  return (
    <section className="favoritesCollection" aria-label="已收藏 Story">
      <label className="favoritesSearch">
        <span>搜索收藏</span>
        <input
          type="search"
          value={query}
          maxLength={120}
          placeholder="标题、摘要或来源"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {visibleFavorites.map((story, index) => (
        <article className="favoriteRow" key={story.slug}>
          <div className="favoriteRowIndex" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="favoriteRowContent">
            <div className="favoriteRowMeta">
              <span>{story.contentType}</span>
              <span>{story.sourceName}</span>
              <span>{formatStoredDate(story.publishedAt)}</span>
            </div>
            <Link href={`/stories/${story.slug}`}>
              <h2>{story.title}</h2>
              {story.summary ? <p>{story.summary}</p> : null}
            </Link>
            <PrivateMemoryCandidate
              compact
              source="favorite"
              statement={
                story.summary
                  ? `${story.title}：${story.summary}`
                  : `我希望继续关注：${story.title}`
              }
            />
          </div>
          <div className="favoriteRowActions">
            <span className="favoriteRowScore">{formatScore(story.score)}</span>
            <button
              type="button"
              onClick={() => remove(story.slug)}
              aria-label={`取消收藏 ${story.title}`}
              title="取消收藏"
            >
              <BookmarkSimple aria-hidden="true" size={18} weight="fill" />
            </button>
          </div>
        </article>
      ))}
      {!visibleFavorites.length ? (
        <p className="favoritesNoMatch">没有找到匹配的收藏内容。</p>
      ) : null}
    </section>
  );
}
