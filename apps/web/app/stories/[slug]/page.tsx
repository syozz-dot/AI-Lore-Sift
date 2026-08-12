import {
  ArrowLeft,
  ArrowUpRight,
  Circle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FavoriteButton } from "../../../components/favorite-button";
import { MarkdownExportButton } from "../../../components/markdown-export-button";
import {
  categoryScoreLabel,
  contentTypeLabels,
  formatFullDateTime,
  formatScore,
  signalLabel,
  storyStatusLabels,
} from "../../../lib/presentation";
import { getStoryDetail } from "../../../lib/queries";
import { createMediaProxyUrl } from "../../../lib/media-proxy";
import { decodeRouteSegment } from "../../../lib/route-params";
import { sanitizeSourceHtml } from "../../../lib/source-content";
import {
  selectPromotedStoryMedia,
  type PresentableStoryMedia,
} from "../../../lib/story-media";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSegment(rawSlug);
  const story = await getStoryDetail(slug);
  return story
    ? {
        title: story.translatedTitle ?? story.title,
        description: story.factualSummary ?? story.excerpt,
      }
    : { title: "Story 不存在" };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeRouteSegment(rawSlug);
  const story = await getStoryDetail(slug);
  if (!story) notFound();

  const relevanceScore = story.overallScore ?? story.relevanceScore;
  const score = story.categoryScore;
  const factualSummary =
    story.analysis?.factualSummary ??
    story.factualSummary ??
    (story.contentType === "product" ? story.excerpt : null);
  const displayTitle = story.analysis?.translatedTitle ?? story.title;
  const showSourceContent =
    story.sourceAllowsFullText && Boolean(story.sourceContent);
  const sourceHtml =
    showSourceContent &&
    story.sourceContentFormat === "html" &&
    story.sourceContent
      ? sanitizeSourceHtml(story.sourceContent)
      : null;
  const promotedMedia = selectPromotedStoryMedia(story.sourceMediaAssets, {
    contentType: story.contentType,
    sourceName: story.sourceName,
  });
  const promotedUrls = new Set(promotedMedia.map((asset) => asset.imageUrl));
  const standaloneMedia = (
    showSourceContent && story.sourceContentFormat === "html"
      ? []
      : story.sourceMediaAssets
  ).filter((asset) => {
    const imageUrl = asset.type === "image" ? asset.url : asset.previewUrl;
    return !imageUrl || !promotedUrls.has(imageUrl);
  });
  const [leadMedia, ...inlineMedia] = promotedMedia;
  const isProduct = story.contentType === "product";
  const readingMinutes = estimateReadingMinutes(
    story.sourceContent ??
      [
        factualSummary,
        story.analysis?.whyItMatters,
        story.analysis?.underlyingLogic,
        story.analysis?.productImpact,
        ...(story.analysis?.productOpportunities ?? []),
        ...(story.analysis?.openQuestions ?? []),
      ]
        .filter(Boolean)
        .join("\n"),
  );
  const topicLabels = Array.from(
    new Set([
      ...story.topics,
      ...story.matchedSignals.map((signal) => signalLabel(signal)),
    ]),
  );
  const sectionLabels = isProduct
    ? ([
        "产品速览",
        "为什么值得试",
        "核心能力",
        "适合谁与使用场景",
        "上手前待确认",
      ] as const)
    : ([
        "发生了什么",
        "为什么重要",
        "底层逻辑",
        "产品与商业机会",
        "仍待确认",
      ] as const);

  return (
    <main className="storyPage storyPageV2">
      <div className="storyDetailShell storyDetailShellV2">
        <Link className="backLink storyBackLink" href="/">
          <ArrowLeft size={15} />
          返回情报流
        </Link>

        <header className="storyHeaderV2">
          <div className="storyHeaderMain">
            <div className="storyKicker">
              <span className="storyTypeBadge">
                {story.contentType
                  ? contentTypeLabels[story.contentType]
                  : "情报"}
              </span>
              <span>{story.sourceName ?? "未知信源"}</span>
              <i aria-hidden="true">/</i>
              <span>{formatFullDateTime(story.lastPublishedAt)}</span>
              <i aria-hidden="true">/</i>
              <span>阅读约 {readingMinutes} 分钟</span>
            </div>

            <h1 lang={story.analysis?.translatedTitle ? undefined : "en"}>
              {displayTitle}
            </h1>
            {story.analysis?.translatedTitle ? (
              <p className="storyOriginalTitle" lang="en">
                原文：{story.title}
              </p>
            ) : null}
            {factualSummary ? (
              <p className="storyDeck">{factualSummary}</p>
            ) : (
              <p className="storyDeck storyDeckMuted">
                中文事实摘要尚未生成，当前仅展示原文索引与可验证信息。
              </p>
            )}
          </div>

          <div className="storyHeaderActions">
            <MarkdownExportButton
              story={{
                slug: story.slug,
                title: displayTitle,
                originalTitle: story.analysis?.translatedTitle
                  ? story.title
                  : null,
                contentType: story.contentType
                  ? contentTypeLabels[story.contentType]
                  : "情报",
                sourceName: story.sourceName ?? "未知信源",
                publishedAt: formatFullDateTime(story.lastPublishedAt),
                relevanceScore: formatScore(relevanceScore),
                sourceCount: story.independentSourceCount,
                status: storyStatusLabels[story.status],
                factualSummary,
                whyItMatters: story.analysis?.whyItMatters ?? null,
                underlyingLogic: story.analysis?.underlyingLogic ?? null,
                productImpact: story.analysis?.productImpact ?? null,
                productOpportunities:
                  story.analysis?.productOpportunities ?? [],
                openQuestions: story.analysis?.openQuestions ?? [],
                matchedSignals: story.matchedSignals.map(signalLabel),
                analysisProvider: story.analysis?.provider ?? null,
                analysisModel: story.analysis?.model ?? null,
                evidence: story.evidence.map((item) => ({
                  sourceName: item.sourceName,
                  title: item.title,
                  url: item.originalUrl,
                  publishedAt: formatFullDateTime(
                    item.sourcePublishedAt ?? item.discoveredAt,
                  ),
                  contentType: contentTypeLabels[item.contentType],
                  relevanceScore: formatScore(item.relevanceScore),
                  excerpt: item.excerpt,
                })),
              }}
            />
            <FavoriteButton
              story={{
                slug: story.slug,
                title: displayTitle,
                originalTitle:
                  displayTitle === story.title ? null : story.title,
                summary: story.analysis?.whyItMatters ?? factualSummary,
                contentType: story.contentType
                  ? contentTypeLabels[story.contentType]
                  : "情报",
                sourceName: story.sourceName ?? "未知信源",
                publishedAt: story.lastPublishedAt?.toISOString() ?? null,
                score,
              }}
            />
          </div>
        </header>

        <div className="storySignalBar">
          <div className="storyRelevance">
            <span>{categoryScoreLabel(story.contentType)}</span>
            <strong>{formatScore(score)}</strong>
            <i aria-hidden="true">
              <b
                style={{
                  width: `${Math.min(100, Math.max(4, (score ?? 0) * 100))}%`,
                }}
              />
            </i>
          </div>
          <span className="storySourceStatus">
            信源 {story.independentSourceCount} 条 ·{" "}
            {storyStatusLabels[story.status]}
          </span>
          {story.originalUrl ? (
            <a
              className="storyOriginalLink"
              href={story.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              原文：{story.title}
              <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          ) : null}
        </div>

        <div className="storyReadingLayout">
          <article className="storyReadingCard">
            <dl className="storyFactStrip">
              <div>
                <dt>类型</dt>
                <dd>
                  {story.contentType
                    ? contentTypeLabels[story.contentType]
                    : "情报"}
                </dd>
              </div>
              <div>
                <dt>来源</dt>
                <dd>{story.sourceName ?? "未知信源"}</dd>
              </div>
              <div>
                <dt>发布</dt>
                <dd>{formatFullDateTime(story.lastPublishedAt)}</dd>
              </div>
              <div>
                <dt>状态</dt>
                <dd>{storyStatusLabels[story.status]}</dd>
              </div>
            </dl>

            {leadMedia ? (
              <StoryEvidenceMedia
                asset={leadMedia}
                title={displayTitle}
                sourceName={story.sourceName}
                originalUrl={story.originalUrl}
                eager
              />
            ) : null}

            <StorySection index="01" id="section-1" title={sectionLabels[0]}>
              {factualSummary ? (
                <p>{factualSummary}</p>
              ) : (
                <MissingAnalysis label={isProduct ? "产品速览" : "事实摘要"} />
              )}
            </StorySection>

            <StorySection index="02" id="section-2" title={sectionLabels[1]}>
              {story.analysis?.whyItMatters ? (
                <p>{story.analysis.whyItMatters}</p>
              ) : (
                <MissingAnalysis label={isProduct ? "产品判断" : "影响分析"} />
              )}
            </StorySection>

            {inlineMedia.length ? (
              <div className="storyInlineMediaGrid">
                {inlineMedia.map((asset, index) => (
                  <StoryEvidenceMedia
                    asset={asset}
                    title={displayTitle}
                    sourceName={story.sourceName}
                    originalUrl={story.originalUrl}
                    key={`${asset.imageUrl}-${index}`}
                  />
                ))}
              </div>
            ) : null}

            <StorySection index="03" id="section-3" title={sectionLabels[2]}>
              {story.analysis?.underlyingLogic ? (
                <p>{story.analysis.underlyingLogic}</p>
              ) : (
                <MissingAnalysis label={isProduct ? "核心能力" : "底层逻辑"} />
              )}
            </StorySection>

            <StorySection index="04" id="section-4" title={sectionLabels[3]}>
              {story.analysis?.productImpact ? (
                <p>{story.analysis.productImpact}</p>
              ) : null}
              {story.analysis?.productOpportunities.length ? (
                <ul className="opportunityList storyNumberedList">
                  {story.analysis.productOpportunities.map((opportunity) => (
                    <li key={opportunity}>{opportunity}</li>
                  ))}
                </ul>
              ) : (
                <MissingAnalysis
                  label={isProduct ? "使用场景判断" : "机会分析"}
                />
              )}
            </StorySection>

            <StorySection index="05" id="section-5" title={sectionLabels[4]}>
              {story.analysis?.openQuestions.length ? (
                <ul className="storyOpenQuestions">
                  {story.analysis.openQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              ) : (
                <MissingAnalysis label="待确认问题" />
              )}
            </StorySection>

            {showSourceContent || standaloneMedia.length ? (
              <details className="sourceMaterial storySourceMaterial">
                <summary>
                  <span>原文与媒体</span>
                  <span>展开查看</span>
                </summary>
                {story.primaryAuthor ? (
                  <p className="sourceByline">{story.primaryAuthor}</p>
                ) : null}
                {standaloneMedia.length ? (
                  <div className="sourceMediaGrid">
                    {standaloneMedia.map((asset, index) => {
                      const imageUrl =
                        asset.type === "image" ? asset.url : asset.previewUrl;
                      return imageUrl ? (
                        <figure key={`${asset.url}-${index}`}>
                          <img
                            src={createMediaProxyUrl(imageUrl)}
                            alt={
                              asset.alt ?? `${displayTitle} 配图 ${index + 1}`
                            }
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        </figure>
                      ) : null;
                    })}
                  </div>
                ) : null}
                {showSourceContent && story.sourceContent ? (
                  sourceHtml ? (
                    <div
                      className="sourceRichText"
                      dangerouslySetInnerHTML={{ __html: sourceHtml }}
                    />
                  ) : (
                    <p className="sourcePlainText">{story.sourceContent}</p>
                  )
                ) : null}
              </details>
            ) : null}
          </article>

          <aside className="storyContextRail">
            <nav aria-label="本篇结构">
              <p>本篇结构</p>
              {sectionLabels.map((label, index) => (
                <a href={`#section-${index + 1}`} key={label}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {label}
                </a>
              ))}
            </nav>

            <section className="storyEvidenceSection">
              <div className="storyRailHeading">
                <p>来源证据</p>
                <span>{story.evidence.length}</span>
              </div>
              <div className="storyEvidenceCards">
                {story.evidence.map((item) => (
                  <a
                    href={item.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    key={item.id}
                  >
                    <div>
                      <span>{item.sourceName}</span>
                      <strong>{formatScore(item.relevanceScore)}</strong>
                    </div>
                    <h3>{item.title}</h3>
                    <small>
                      {formatFullDateTime(
                        item.sourcePublishedAt ?? item.discoveredAt,
                      )}
                    </small>
                  </a>
                ))}
              </div>
            </section>

            <section className="storyTopicSection">
              <p>主要信号</p>
              <div>
                {topicLabels.length ? (
                  topicLabels.map((label) => <span key={label}>{label}</span>)
                ) : (
                  <span>暂无标签</span>
                )}
              </div>
            </section>

            {story.analysis ? (
              <section className="storyModelSection">
                <p>
                  脱水模型 {story.analysis.provider} / {story.analysis.model}
                </p>
                <span>置信度 {formatScore(story.analysis.confidence)}</span>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

function StorySection({
  index,
  id,
  title,
  children,
}: {
  index: string;
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="storyReadingSection" id={id}>
      <div className="storySectionTitle">
        <span>{index}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StoryEvidenceMedia({
  asset,
  title,
  sourceName,
  originalUrl,
  eager = false,
}: {
  asset: PresentableStoryMedia;
  title: string;
  sourceName: string | null;
  originalUrl: string | null;
  eager?: boolean;
}) {
  const targetUrl = originalUrl ?? asset.imageUrl;

  return (
    <figure className="storyEvidenceMedia">
      <a href={targetUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={createMediaProxyUrl(asset.imageUrl)}
          alt={asset.alt ?? `${title} 原文配图`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      </a>
      <figcaption>
        <span>{asset.alt ?? `${title} 原文配图`}</span>
        <span>
          来源：{sourceName ?? "原文"}
          <ArrowUpRight aria-hidden="true" size={12} />
        </span>
      </figcaption>
    </figure>
  );
}

function MissingAnalysis({ label }: { label: string }) {
  return (
    <div className="missingAnalysis">
      <Circle aria-hidden="true" size={16} />
      <div>
        <strong>{label}尚未生成</strong>
        <span>当前仅展示原文证据与规则信号，不用规则补写影响结论。</span>
      </div>
    </div>
  );
}

function estimateReadingMinutes(content: string | null) {
  if (!content) return 1;
  const plainText = content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  return Math.max(1, Math.ceil(plainText.length / 450));
}
