import {
  Books,
  Drop,
  GithubLogo,
  Newspaper,
  Tag,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { FavoritesHeaderLink } from "./favorites-header-link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="siteHeader">
      <div className="headerInner">
        <Link className="brand" href="/" aria-label="AI News Navigator 首页">
          <span className="brandMark" aria-hidden="true">
            N
          </span>
          <span className="brandName">AI News Navigator</span>
        </Link>
        <div className="headerActions">
          <Link
            className="iconButton distillHeaderLink"
            href="/distill"
            aria-label="打开私人脱水工作台"
            title="脱水工作台"
          >
            <Drop aria-hidden="true" size={19} weight="regular" />
          </Link>
          <Link
            className="iconButton knowledgeHeaderLink"
            href="/knowledge"
            aria-label="打开私人知识库"
            title="知识库"
          >
            <Books aria-hidden="true" size={19} weight="regular" />
          </Link>
          <Link
            className="iconButton dailyHeaderLink"
            href="/daily"
            aria-label="阅读 AI 情报简报"
            title="情报简报"
          >
            <Newspaper aria-hidden="true" size={19} weight="regular" />
          </Link>
          <Link
            className="iconButton topicsHeaderLink"
            href="/topics"
            aria-label="按主题浏览 AI 情报"
            title="主题地图"
          >
            <Tag aria-hidden="true" size={19} weight="regular" />
          </Link>
          <FavoritesHeaderLink />
          <ThemeToggle />
          <a
            className="iconButton githubIconLink"
            href="https://github.com/syozz-dot/ai-news-navigator"
            target="_blank"
            rel="noreferrer"
            aria-label="在 GitHub 查看项目"
            title="GitHub"
          >
            <GithubLogo aria-hidden="true" size={19} weight="regular" />
          </a>
        </div>
      </div>
    </header>
  );
}
