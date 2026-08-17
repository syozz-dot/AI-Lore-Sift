import sanitizeHtml from "sanitize-html";

import {
  splitDistillParagraphs,
  type PreparedDistillSource,
} from "./distill-source";
import { getStoryDetail } from "./queries";

const MAX_SOURCE_CHARACTERS = 80_000;
const KNOWN_SITE_HOSTNAMES = new Set([
  "ailoresift.com",
  "www.ailoresift.com",
  "staging.ailoresift.com",
  "ai-news-navigator-web.vercel.app",
]);

interface InternalStoryRecord {
  title: string;
  translatedTitle: string | null;
  factualSummary: string | null;
  excerpt: string | null;
  contentType: string | null;
  sourceName: string | null;
  primaryAuthor: string | null;
  sourceContent: string | null;
  sourceContentFormat: "text" | "html";
  sourceAllowsFullText: boolean;
  analysis: {
    translatedTitle: string | null;
    factualSummary: string;
    whyItMatters: string | null;
    underlyingLogic: string | null;
    productImpact: string | null;
    productOpportunities: string[];
    openQuestions: string[];
  } | null;
  evidence: Array<{
    title: string;
    excerpt: string | null;
    sourceName: string;
    originalUrl: string;
  }>;
}

type LoadStory = (slug: string) => Promise<InternalStoryRecord | null>;

function configuredSiteHostname() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return null;
  try {
    return new URL(configured).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isInternalSiteUrl(url: URL) {
  const hostname = url.hostname.toLowerCase();
  return (
    KNOWN_SITE_HOSTNAMES.has(hostname) || hostname === configuredSiteHostname()
  );
}

function readableSourceContent(story: InternalStoryRecord) {
  if (!story.sourceAllowsFullText || !story.sourceContent) return null;
  if (story.sourceContentFormat === "text") return story.sourceContent.trim();
  return sanitizeHtml(story.sourceContent, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function section(title: string, values: Array<string | null | undefined>) {
  const content = values.filter((value): value is string =>
    Boolean(value?.trim()),
  );
  return content.length ? `${title}\n${content.join("\n")}` : null;
}

function buildStoryText(story: InternalStoryRecord) {
  const analysis = story.analysis;
  const displayTitle =
    analysis?.translatedTitle ?? story.translatedTitle ?? story.title;
  const evidence = story.evidence.map((item, index) =>
    [
      `${index + 1}. ${item.title}`,
      item.excerpt,
      `来源：${item.sourceName} · ${item.originalUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const blocks = [
    section("标题", [displayTitle]),
    displayTitle === story.title ? null : section("原文标题", [story.title]),
    section("内容信息", [
      story.contentType ? `类型：${story.contentType}` : null,
      story.sourceName ? `主要信源：${story.sourceName}` : null,
    ]),
    section("事实摘要", [
      analysis?.factualSummary,
      story.factualSummary,
      story.excerpt,
    ]),
    section("为什么重要", [analysis?.whyItMatters]),
    section("底层逻辑", [analysis?.underlyingLogic]),
    section("产品与商业影响", [analysis?.productImpact]),
    section("可迁移机会", analysis?.productOpportunities ?? []),
    section("仍待确认", analysis?.openQuestions ?? []),
    section("来源正文", [readableSourceContent(story)]),
    section("来源证据", evidence),
  ].filter((value): value is string => Boolean(value));

  return blocks.join("\n\n").slice(0, MAX_SOURCE_CHARACTERS);
}

export async function resolveInternalStorySource(
  url: URL,
  loadStory: LoadStory = getStoryDetail,
): Promise<PreparedDistillSource | null> {
  if (!isInternalSiteUrl(url)) return null;

  const match = url.pathname.match(/^\/stories\/([^/]+)\/?$/);
  if (!match?.[1]) {
    throw new Error(
      "站内链接目前仅支持 Story 详情页，请粘贴 /stories/ 开头的链接。",
    );
  }

  const slug = decodeURIComponent(match[1]);
  const story = await loadStory(slug);
  if (!story) throw new Error("没有找到该站内 Story，可能已下线或链接有误。");

  const rawText = buildStoryText(story);
  const paragraphs = splitDistillParagraphs(rawText);
  if (rawText.length < 120 || paragraphs.length === 0) {
    throw new Error("该站内 Story 当前没有足够内容可供脱水。");
  }

  return {
    sourceType: "url",
    sourceUrl: url.toString(),
    sourceTitle:
      story.analysis?.translatedTitle ?? story.translatedTitle ?? story.title,
    sourceAuthor: story.primaryAuthor ?? story.sourceName,
    rawText,
    paragraphs,
  };
}
