"use client";

import {
  BookmarkSimple,
  Books,
  CaretLeft,
  Drop,
  House,
  List,
  Newspaper,
  Tag,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  FAVORITES_CHANGED_EVENT,
  FAVORITES_STORAGE_KEY,
  readFavorites,
} from "../lib/favorites";
import { ThemeToggle } from "./theme-toggle";

const SIDEBAR_STORAGE_KEY = "ann-sidebar-collapsed";

type NavIcon = ComponentType<{
  "aria-hidden"?: boolean;
  size?: number;
  weight?: "regular" | "fill";
}>;

type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  description?: string;
  accent?: boolean;
};

const contentItems: NavItem[] = [
  { href: "/", label: "情报流", icon: House },
  { href: "/daily", label: "日报", icon: Newspaper },
  { href: "/topics", label: "主题", icon: Tag },
];

const workspaceItems: NavItem[] = [
  {
    href: "/distill",
    label: "脱水",
    icon: Drop,
    description: "提炼文章与视频",
    accent: true,
  },
];

const personalItems: NavItem[] = [
  { href: "/favorites", label: "收藏", icon: BookmarkSimple },
  { href: "/knowledge", label: "知识库", icon: Books },
];

function isRouteActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);

  const syncFavoriteCount = useCallback(() => {
    setFavoriteCount(readFavorites(window.localStorage).length);
  }, []);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true");
    syncFavoriteCount();

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === FAVORITES_STORAGE_KEY) {
        syncFavoriteCount();
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener(FAVORITES_CHANGED_EVENT, syncFavoriteCount);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FAVORITES_CHANGED_EVENT, syncFavoriteCount);
    };
  }, [syncFavoriteCount]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      return next;
    });
  }

  function renderNavItem(item: NavItem) {
    const active = isRouteActive(pathname, item.href);
    const Icon = item.icon;
    const count =
      item.href === "/favorites" && favoriteCount > 0
        ? favoriteCount
        : undefined;

    return (
      <Link
        key={item.href}
        className={`sidebarLink${active ? " active" : ""}${item.accent ? " sidebarLinkAccent" : ""}`}
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={collapsed ? item.label : undefined}
      >
        <Icon
          aria-hidden={true}
          size={19}
          weight={
            item.href === "/favorites" && favoriteCount > 0 ? "fill" : "regular"
          }
        />
        <span className="sidebarLinkCopy">
          <strong>{item.label}</strong>
          {item.description ? <small>{item.description}</small> : null}
        </span>
        {count ? (
          <span className="sidebarCount" aria-label={`${count} 条收藏`}>
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </Link>
    );
  }

  function renderDistillNavItem(item: NavItem) {
    const active = isRouteActive(pathname, item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        className={`distillGlobalNavLink${active ? " active" : ""}`}
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        title={item.label}
      >
        <Icon
          aria-hidden={true}
          size={20}
          weight={
            item.href === "/favorites" && favoriteCount > 0
              ? "fill"
              : "regular"
          }
        />
        {item.href === "/favorites" && favoriteCount > 0 ? (
          <span aria-label={`${favoriteCount} 条收藏`}>
            {favoriteCount > 9 ? "9+" : favoriteCount}
          </span>
        ) : null}
      </Link>
    );
  }

  if (pathname === "/distill" || pathname.startsWith("/distill/")) {
    return (
      <div className="distillStandaloneShell">
        <aside className="distillGlobalNav" aria-label="全局导航">
          <Link
            className="distillGlobalBrand"
            href="/"
            aria-label="AI News Navigator 首页"
            title="返回情报流"
          >
            N
          </Link>
          <nav>
            <div>{contentItems.map(renderDistillNavItem)}</div>
            <div>{workspaceItems.map(renderDistillNavItem)}</div>
            <div>{personalItems.map(renderDistillNavItem)}</div>
          </nav>
        </aside>
        <div className="distillStandaloneContent">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="siteShell"
      data-sidebar-collapsed={collapsed ? "true" : "false"}
      data-mobile-sidebar-open={mobileOpen ? "true" : "false"}
    >
      <header className="siteHeader">
        <button
          className="mobileMenuButton"
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          aria-label={mobileOpen ? "关闭导航" : "打开导航"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X aria-hidden="true" size={20} />
          ) : (
            <List aria-hidden="true" size={20} />
          )}
        </button>
        <Link className="brand" href="/" aria-label="AI News Navigator 首页">
          <span className="brandMark" aria-hidden="true">
            N
          </span>
          <span className="brandName">AI News Navigator</span>
        </Link>
        <div className="headerActions">
          <ThemeToggle />
        </div>
      </header>

      <button
        className="sidebarScrim"
        type="button"
        onClick={() => setMobileOpen(false)}
        aria-label="关闭导航"
        tabIndex={mobileOpen ? 0 : -1}
      />

      <aside className="siteSidebar" aria-label="主导航">
        <div className="sidebarScroll">
          <section className="sidebarGroup" aria-labelledby="sidebar-content">
            <h2 id="sidebar-content">内容</h2>
            <nav>{contentItems.map(renderNavItem)}</nav>
          </section>

          <section
            className="sidebarGroup sidebarWorkspace"
            aria-labelledby="sidebar-workspace"
          >
            <h2 id="sidebar-workspace">工作台</h2>
            <nav>{workspaceItems.map(renderNavItem)}</nav>
          </section>

          <section
            className="sidebarGroup sidebarPersonal"
            aria-labelledby="sidebar-personal"
          >
            <h2 id="sidebar-personal">我的</h2>
            <nav>{personalItems.map(renderNavItem)}</nav>
          </section>
        </div>

        <button
          className="sidebarCollapseButton"
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "展开导航" : "收起导航"}
          title={collapsed ? "展开导航" : "收起导航"}
        >
          <CaretLeft aria-hidden="true" size={18} />
          <span>收起导航</span>
        </button>
      </aside>

      <div className="siteBody">
        {children}
        {footer}
      </div>
    </div>
  );
}
