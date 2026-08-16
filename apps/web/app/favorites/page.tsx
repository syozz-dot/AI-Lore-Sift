import type { Metadata } from "next";

import { FavoritesList } from "../../components/favorites-list";

export const metadata: Metadata = {
  title: "我的收藏",
  description: "保存在当前浏览器中的 AILore Sift Story。",
};

export default function FavoritesPage() {
  return (
    <main className="favoritesPage">
      <header className="favoritesIntro">
        <div>
          <p>个人阅读清单</p>
          <h1>我的收藏</h1>
        </div>
        <p>
          收藏保存在当前浏览器中，无需登录。清理浏览器数据后，收藏内容也会被移除。
        </p>
      </header>
      <FavoritesList />
    </main>
  );
}
