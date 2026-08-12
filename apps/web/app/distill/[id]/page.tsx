import {
  ArrowLeft,
  ArrowSquareOut,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DistillDeleteButton } from "../../../components/distill-delete-button";
import { DistillFollowUp } from "../../../components/distill-follow-up";
import { DistillMarkdownButton } from "../../../components/distill-markdown-button";
import { DistillProcessPanel } from "../../../components/distill-process-panel";
import { DistillPersonalizationSection } from "../../../components/distill-personalization-section";
import { DistillTaskList } from "../../../components/distill-task-list";
import { KnowledgeCardActions } from "../../../components/knowledge-card-actions";
import { KnowledgeSaveButton } from "../../../components/knowledge-save-button";
import { getDistillSession } from "../../../lib/distill-auth";
import {
  getDistillDocument,
  listDistillDocuments,
  listDistillMessages,
  listSavedKnowledgeCardIndexes,
} from "../../../lib/distill";
import { splitDistillParagraphs } from "../../../lib/distill-source";

export const dynamic = "force-dynamic";

const verdictLabels: Record<string, string> = {
  skip: "可以跳过",
  skim: "读脱水版即可",
  read: "建议阅读原文",
};

function paragraphReference(numbers: number[]) {
  const sorted = [...new Set(numbers)].sort((left, right) => left - right);
  if (!sorted.length) return "原文证据";

  const groups: Array<[number, number]> = [];
  for (const number of sorted) {
    const current = groups.at(-1);
    if (current && number === current[1] + 1) {
      current[1] = number;
    } else {
      groups.push([number, number]);
    }
  }

  return groups
    .map(([start, end]) => (start === end ? `P${start}` : `P${start}–P${end}`))
    .join("、");
}

function selectSourceQuote(
  paragraphs: string[],
  claims: Array<{
    type: "fact" | "author_view" | "inference";
    confidence: "high" | "medium" | "low";
    evidenceParagraphs: number[];
  }>,
  keyPoints: Array<{ evidenceParagraphs: number[] }>,
) {
  const prioritizedNumbers = [
    ...claims
      .filter(
        (claim) => claim.type !== "inference" && claim.confidence !== "low",
      )
      .flatMap((claim) => claim.evidenceParagraphs),
    ...keyPoints.flatMap((point) => point.evidenceParagraphs),
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

export async function generateMetadata({
  params: _params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return {
    title: "脱水结果",
    description: "私人脱水结果。",
    robots: { index: false, follow: false, noarchive: true },
  };
}

export default async function DistillResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getDistillSession();
  const { id } = await params;
  if (!session) redirect(`/distill/access?next=/distill/${id}`);
  const [document, documents] = await Promise.all([
    getDistillDocument(session.ownerId, id),
    listDistillDocuments(session.ownerId),
  ]);
  if (!document) notFound();

  if (document.status !== "ready" || !document.analysis) {
    return (
      <main className="distillAgentWorkspace">
        <DistillTaskList documents={documents} currentId={id} />
        <div className="distillAgentCanvas distillTaskStateCanvas">
          <header className="distillConversationHeader">
            <div>
              <p>任务状态</p>
              <h1>
                {document.status === "failed" ? "处理未完成" : "正在脱水"}
              </h1>
            </div>
          </header>
          <section className="distillTaskState">
            {document.status === "failed" ? (
              <WarningCircle aria-hidden="true" size={28} />
            ) : (
              <FileText aria-hidden="true" size={28} />
            )}
            <p>{document.status === "failed" ? "本次处理失败" : "正在处理"}</p>
            <h2>
              {document.status === "failed"
                ? "没有生成可用的脱水内容。"
                : "正在建立原文与证据的对应关系。"}
            </h2>
            <span>
              {document.errorMessage ||
                "完成后会自动出现在任务记录中，请稍后刷新。"}
            </span>
            <Link href="/distill">
              <ArrowLeft aria-hidden="true" size={16} />
              新建任务
            </Link>
          </section>
        </div>
      </main>
    );
  }

  const analysis = document.analysis;
  const paragraphs = splitDistillParagraphs(document.rawText);
  const [messages, savedInsightIndexes] = await Promise.all([
    listDistillMessages(session.ownerId, id),
    listSavedKnowledgeCardIndexes(session.ownerId, id),
  ]);
  const savedInsightIndexSet = new Set(savedInsightIndexes);
  const sourceQuote = selectSourceQuote(
    paragraphs,
    analysis.claims,
    analysis.keyPoints,
  );
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
                  }).format(document.createdAt)}
                </span>
              </div>
              <div className="distillResultUtilities">
                <Link href="/distill">
                  <ArrowLeft aria-hidden="true" size={15} />
                  新建脱水
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
              <dd>{document.inputCharacters.toLocaleString("zh-CN")} 字符</dd>
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
            <KnowledgeSaveButton
              documentId={document.id}
              initialSaved={Boolean(document.knowledgeEntryId)}
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
                createdAt: document.createdAt.toISOString(),
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
            <DistillDeleteButton documentId={document.id} />
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
                              <KnowledgeCardActions
                                documentId={document.id}
                                insightIndex={index}
                                title={title}
                                content={insight}
                                initialSaved={savedInsightIndexSet.has(index)}
                              />
                            </article>
                          );
                        })}
                      </div>
                    </details>
                  ) : null}
                </div>
              </section>

              <DistillPersonalizationSection documentId={document.id} />

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

          <DistillFollowUp
            documentId={document.id}
            sectionNumber={followUpSectionNumber}
            initialMessages={messages.map((message) => ({
              ...message,
              createdAt: message.createdAt.toISOString(),
            }))}
            suggestedQuestions={analysis.followUpQuestions}
          />
        </div>
      </article>
    </main>
  );
}
