"use client";

import {
  ArrowLeft,
  ArrowSquareOut,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  localDistillAnalysis,
  localDistillParagraphs,
  paragraphReference,
  type LocalDistillAnalysis,
} from "../lib/distill-local";
import {
  PRIVATE_DISTILL_SESSION_PREFIX,
  readPrivateDistillRecord,
  readPrivateWorkspace,
  type PrivateDistillRecord,
} from "../lib/private-workspace";
import { DistillMarkdownButton } from "./distill-markdown-button";
import { DistillPersonalizationSection } from "./distill-personalization-section";
import { DistillProcessPanel } from "./distill-process-panel";
import { LocalDistillFollowUp } from "./local-distill-follow-up";
import {
  LocalDistillDeleteButton,
  LocalKnowledgeCardActions,
  LocalKnowledgeSaveButton,
} from "./local-knowledge-actions";

const verdictLabels: Record<string, string> = {
  skip: "可以跳过",
  skim: "读脱水版即可",
  read: "建议阅读原文",
};

function selectSourceQuote(
  paragraphs: string[],
  analysis: LocalDistillAnalysis,
) {
  const prioritizedNumbers = [
    ...analysis.claims
      .filter(
        (claim) => claim.type !== "inference" && claim.confidence !== "low",
      )
      .flatMap((claim) => claim.evidenceParagraphs),
    ...analysis.keyPoints.flatMap((point) => point.evidenceParagraphs),
  ];
  for (const number of [...new Set(prioritizedNumbers)]) {
    const paragraph = paragraphs[number - 1]?.trim();
    if (paragraph && paragraph.length >= 24) {
      return {
        number,
        text:
          paragraph.length > 520 ? `${paragraph.slice(0, 519)}…` : paragraph,
      };
    }
  }
  return null;
}

export function LocalDistillResult({
  documentId,
  followUpsRemaining,
}: {
  documentId: string;
  followUpsRemaining: number;
}) {
  const [document, setDocument] = useState<PrivateDistillRecord | null>(null);
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      readPrivateDistillRecord(documentId).catch(() => null),
      readPrivateWorkspace().catch(() => null),
    ])
      .then(([record, workspace]) => {
        if (record) {
          setDocument(record);
        } else {
          const fallback = window.sessionStorage.getItem(
            `${PRIVATE_DISTILL_SESSION_PREFIX}${documentId}`,
          );
          if (fallback) {
            const parsed = JSON.parse(fallback) as PrivateDistillRecord;
            setDocument(parsed.id === documentId ? parsed : null);
          }
        }
        setSavedCardIds(
          new Set((workspace?.knowledgeCards ?? []).map((card) => card.id)),
        );
      })
      .finally(() => setLoading(false));
  }, [documentId]);

  if (loading) {
    return (
      <main className="distillAgentResult">
        <section className="distillResultState">
          <FileText aria-hidden="true" size={28} />
          <p>正在读取当前浏览器</p>
          <h1>加载这次脱水结果…</h1>
        </section>
      </main>
    );
  }
  const analysis = document ? localDistillAnalysis(document) : null;
  if (!document || !analysis) {
    return (
      <main className="distillAgentResult">
        <section className="distillResultState">
          <WarningCircle aria-hidden="true" size={28} />
          <p>没有找到本机结果</p>
          <h1>这份记录可能已被浏览器清理。</h1>
          <span>匿名内容从未保存在服务器，清理站点数据后无法恢复。</span>
          <Link href="/distill">
            <ArrowLeft aria-hidden="true" size={16} />
            返回脱水工作台
          </Link>
        </section>
      </main>
    );
  }

  const paragraphs = localDistillParagraphs(document.rawText);
  const sourceQuote = selectSourceQuote(paragraphs, analysis);
  let nextSectionNumber = 3;
  const cautionSectionNumber = analysis.cautions.length
    ? String(nextSectionNumber++).padStart(2, "0")
    : null;
  const quoteSectionNumber = sourceQuote
    ? String(nextSectionNumber++).padStart(2, "0")
    : null;
  const followUpSectionNumber = String(nextSectionNumber).padStart(2, "0");

  return (
    <main className="distillAgentResult">
      <article className="distillResultDocument">
        <div className="distillDocumentInner">
          <header className="distillResultHero">
            <div className="distillResultMetaBar">
              <div className="distillResultMeta">
                <span>
                  <FileText aria-hidden="true" size={16} />
                  {document.sourceType === "url" ? "网页" : "粘贴正文"}
                </span>
                <span>
                  {new Intl.DateTimeFormat("zh-CN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }).format(new Date(document.createdAt))}
                </span>
                <span>仅保存在当前浏览器</span>
              </div>
              <div className="distillResultUtilities">
                <Link href="/distill">
                  <ArrowLeft aria-hidden="true" size={15} />
                  脱水工作台
                </Link>
                <DistillProcessPanel
                  sourceType={document.sourceType}
                  paragraphCount={paragraphs.length}
                  compact
                />
              </div>
            </div>
            <h1>{analysis.title}</h1>
            {document.sourceTitle && document.sourceTitle !== analysis.title ? (
              <p className="distillOriginalTitle">
                原文：{document.sourceTitle}
              </p>
            ) : null}
            <div className="distillVerdict">
              <strong>{verdictLabels[analysis.verdict] ?? "阅读建议"}</strong>
              <p>{analysis.verdictReason}</p>
            </div>
          </header>

          <dl className="distillResultMetrics">
            <div>
              <dt>原文预计阅读</dt>
              <dd>{analysis.estimatedReadingMinutes} 分钟</dd>
            </div>
            <div>
              <dt>正文规模</dt>
              <dd>
                {document.rawText?.length.toLocaleString("zh-CN") ?? 0} 字符
              </dd>
            </div>
            <div>
              <dt>可保存卡片</dt>
              <dd>
                {analysis.transferableInsights.length ? (
                  <a href="#distill-knowledge-cards">
                    {analysis.transferableInsights.length} 张
                  </a>
                ) : (
                  "0 张"
                )}
              </dd>
            </div>
          </dl>

          <div className="distillResultActions">
            <LocalKnowledgeSaveButton
              documentId={document.id}
              initialSaved={Boolean(document.savedToKnowledge)}
            />
            <DistillMarkdownButton
              document={{
                id: document.id,
                title: analysis.title,
                sourceTitle: document.sourceTitle,
                sourceUrl: document.sourceUrl,
                sourceAuthor: document.sourceAuthor,
                verdict: analysis.verdict,
                verdictReason: analysis.verdictReason,
                estimatedReadingMinutes: analysis.estimatedReadingMinutes,
                summary: analysis.summary,
                keyPoints: analysis.keyPoints,
                claims: analysis.claims,
                transferableInsights: analysis.transferableInsights,
                cautions: analysis.cautions,
                followUpQuestions: analysis.followUpQuestions,
                createdAt: document.createdAt,
              }}
            />
            {document.sourceUrl ? (
              <a
                className="distillUtilityButton distillSourceLink"
                href={document.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ArrowSquareOut aria-hidden="true" size={17} />
                打开原文
              </a>
            ) : null}
            <LocalDistillDeleteButton documentId={document.id} />
          </div>

          <div className="distillResultLayout">
            <div className="distillResultBody">
              <section className="distillResultModule distillLeadModule">
                <header className="distillModuleHeading">
                  <span>01</span>
                  <h2>导读</h2>
                  <p>先判断是否值得投入时间</p>
                </header>
                <div className="distillModuleContent">
                  <p className="distillLeadSummary">{analysis.summary}</p>
                  {analysis.keyPoints.some(
                    (point) => point.evidenceParagraphs.length,
                  ) ? (
                    <nav
                      className="distillEvidenceIndex"
                      aria-label="导读证据索引"
                    >
                      {analysis.keyPoints.slice(0, 4).map((point, index) => (
                        <a
                          href={`#distill-author-point-${index + 1}`}
                          key={`${point.title}-${index}`}
                        >
                          <span>
                            {paragraphReference(point.evidenceParagraphs)}
                          </span>
                          {point.title}
                        </a>
                      ))}
                    </nav>
                  ) : null}
                </div>
              </section>

              <section className="distillResultModule">
                <header className="distillModuleHeading">
                  <span>02</span>
                  <h2>作者观点</h2>
                  <p>还原作者真正提出的判断</p>
                </header>
                <div className="distillModuleContent">
                  <div className="distillKeyPoints">
                    {analysis.keyPoints.map((point, index) => (
                      <article
                        id={`distill-author-point-${index + 1}`}
                        key={`${point.title}-${point.detail}`}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <div>
                          <h3>{point.title}</h3>
                          <p>{point.detail}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                  {analysis.transferableInsights.length ? (
                    <details
                      className="distillKnowledgeDrawer"
                      id="distill-knowledge-cards"
                    >
                      <summary>
                        查看 {analysis.transferableInsights.length} 张可保存卡片
                      </summary>
                      <div className="distillTakeawayCards">
                        {analysis.transferableInsights.map((insight, index) => {
                          const firstSentence =
                            insight.split(/[。！？!?；;]/, 1)[0] ||
                            `知识 ${index + 1}`;
                          const title =
                            firstSentence.length > 42
                              ? `${firstSentence.slice(0, 41)}…`
                              : firstSentence;
                          return (
                            <article key={`${index}-${insight}`}>
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <h3>{title}</h3>
                              <p>{insight}</p>
                              <LocalKnowledgeCardActions
                                document={document}
                                insightIndex={index}
                                title={title}
                                content={insight}
                                initialSaved={savedCardIds.has(
                                  `${document.id}:insight:${index}`,
                                )}
                              />
                            </article>
                          );
                        })}
                      </div>
                    </details>
                  ) : null}
                </div>
              </section>

              <DistillPersonalizationSection
                documentId={document.id}
                local
                initialPersonalization={{
                  requested: document.personalizationRequested ?? false,
                  insights: document.personalizedInsights ?? [],
                  error: document.personalizationError ?? null,
                }}
              />

              {analysis.cautions.length && cautionSectionNumber ? (
                <section className="distillResultModule distillCautionModule">
                  <header className="distillModuleHeading">
                    <span>{cautionSectionNumber}</span>
                    <h2>谨慎判断</h2>
                    <p>证据还不足以支持的部分</p>
                  </header>
                  <div className="distillModuleContent">
                    <ul className="distillCautions">
                      {analysis.cautions.map((caution) => (
                        <li key={caution}>
                          <WarningCircle aria-hidden="true" size={17} />
                          {caution}
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ) : null}

              {sourceQuote && quoteSectionNumber ? (
                <section className="distillResultModule distillQuoteModule">
                  <header className="distillModuleHeading">
                    <span>{quoteSectionNumber}</span>
                    <h2>原文引用</h2>
                    <p>保留作者原话，便于回溯</p>
                  </header>
                  <div className="distillModuleContent">
                    <blockquote cite={document.sourceUrl ?? undefined}>
                      <p>{sourceQuote.text}</p>
                      <footer>P{sourceQuote.number}</footer>
                    </blockquote>
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <LocalDistillFollowUp
            document={document}
            analysis={analysis}
            sectionNumber={followUpSectionNumber}
            initialRemaining={followUpsRemaining}
          />
        </div>
      </article>
    </main>
  );
}
