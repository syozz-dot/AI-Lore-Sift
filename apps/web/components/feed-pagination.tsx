import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import type { ContentType } from "../lib/queries";

type PageToken = number | "start-ellipsis" | "end-ellipsis";

function pageTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const visible = [...pages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
  const tokens: PageToken[] = [];

  visible.forEach((page, index) => {
    const previous = visible[index - 1];
    if (previous && page - previous > 1) {
      tokens.push(previous === 1 ? "start-ellipsis" : "end-ellipsis");
    }
    tokens.push(page);
  });

  return tokens;
}

function pageHref(
  contentType: ContentType,
  page: number,
  searchQuery?: string,
) {
  const params = new URLSearchParams({ type: contentType });
  if (searchQuery) params.set("q", searchQuery);
  if (page > 1) params.set("page", String(page));
  return `/?${params.toString()}`;
}

export function FeedPagination({
  contentType,
  currentPage,
  totalPages,
  searchQuery,
}: {
  contentType: ContentType;
  currentPage: number;
  totalPages: number;
  searchQuery?: string | undefined;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav className="feedPagination" aria-label="情报分页">
      {currentPage > 1 ? (
        <Link
          className="paginationDirection"
          href={pageHref(contentType, currentPage - 1, searchQuery)}
          aria-label="上一页"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          <span>上一页</span>
        </Link>
      ) : (
        <span className="paginationDirection disabled" aria-hidden="true">
          <ArrowLeft size={16} />
          <span>上一页</span>
        </span>
      )}

      <div className="paginationPages">
        {pageTokens(currentPage, totalPages).map((token) =>
          typeof token === "number" ? (
            <Link
              key={token}
              href={pageHref(contentType, token, searchQuery)}
              aria-current={token === currentPage ? "page" : undefined}
              aria-label={`第 ${token} 页`}
            >
              {token}
            </Link>
          ) : (
            <span key={token} className="paginationEllipsis" aria-hidden="true">
              …
            </span>
          ),
        )}
      </div>

      {currentPage < totalPages ? (
        <Link
          className="paginationDirection"
          href={pageHref(contentType, currentPage + 1, searchQuery)}
          aria-label="下一页"
        >
          <span>下一页</span>
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ) : (
        <span className="paginationDirection disabled" aria-hidden="true">
          <span>下一页</span>
          <ArrowRight size={16} />
        </span>
      )}
    </nav>
  );
}
