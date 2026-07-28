import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  FileText,
  LinkSimple,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DistillDeleteButton } from "../../../components/distill-delete-button";
import { DistillFollowUp } from "../../../components/distill-follow-up";
import { DistillMarkdownButton } from "../../../components/distill-markdown-button";
import { DistillProcessPanel } from "../../../components/distill-process-panel";
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

const claimTypeLabels: Record<string, string> = {
  fact: "可核对事实",
  author_view: "作者观点",
  inference: "谨慎推断",
};

const confidenceLabels: Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const session = await getDistillSession();
  if (!session || !process.env.DATABASE_URL) return { title: "脱水结果" };
  const { id } = await params;
  const document = await getDistillDocument(session.ownerId, id);
  return {
    title: document?.analysis?.title ?? document?.sourceTitle ?? "脱水结果",
    description: document?.analysis?.summary ?? "私人脱水结果。",
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
  const referencedParagraphs = [
    ...new Set([
      ...analysis.keyPoints.flatMap((point) => point.evidenceParagraphs),
      ...analysis.claims.flatMap((claim) => claim.evidenceParagraphs),
    ]),
  ]
    .sort((left, right) => left - right)
    .map((number) => ({ number, text: paragraphs[number - 1] }))
    .filter((paragraph) => paragraph.text);
  const [messages, savedInsightIndexes] = await Promise.all([
    listDistillMessages(session.ownerId, id),
    listSavedKnowledgeCardIndexes(session.ownerId, id),
  ]);
  const savedInsightIndexSet = new Set(savedInsightIndexes);

  return (
    <main className="distillAgentWorkspace distillAgentResult">
      <DistillTaskList documents={documents} currentId={id} />
      <div className="distillAgentCanvas">
        <nav className="distillResultBack" aria-label="返回">
          <Link href="/distill">
            <ArrowLeft aria-hidden="true" size={15} />
            新建脱水
          </Link>
        </nav>

        <section className="distillSourceMessage" aria-label="用户输入">
          <small>你提交的内容</small>
          <div>
            <LinkSimple aria-hidden="true" size={17} />
            <p>
              {document.sourceTitle ||
                document.sourceUrl ||
                `${document.rawText.slice(0, 180)}${document.rawText.length > 180 ? "…" : ""}`}
            </p>
          </div>
        </section>

        <DistillProcessPanel
          sourceType={document.sourceType}
          paragraphCount={paragraphs.length}
          evidenceCount={referencedParagraphs.length}
        />

        <article className="distillResultDocument">
          <header className="distillResultHero">
            <div className="distillResultMeta">
              <span>{document.sourceType === "url" ? "网页" : "粘贴正文"}</span>
              <span>
                {new Intl.DateTimeFormat("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }).format(document.createdAt)}
              </span>
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
                  className="distillUtilityButton"
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
              <dt>证据锚点</dt>
              <dd>{referencedParagraphs.length} 处</dd>
            </div>
          </dl>

          <div className="distillResultLayout">
            <div className="distillResultBody">
              <section>
                <p className="distillSectionEyebrow">READING GUIDE</p>
                <h2>导读</h2>
                <p className="distillLeadSummary">{analysis.summary}</p>
              </section>

              <section>
                <p className="distillSectionEyebrow">KEY ARGUMENTS</p>
                <h2>作者到底说了什么</h2>
                <div className="distillKeyPoints">
                  {analysis.keyPoints.map((point, index) => (
                    <article key={`${point.title}-${point.detail}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <h3>{point.title}</h3>
                      <p>{point.detail}</p>
                      {point.evidenceParagraphs.length ? (
                        <small>
                          证据{" "}
                          {point.evidenceParagraphs
                            .map((number) => `P${number}`)
                            .join("、")}
                        </small>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>

              {analysis.transferableInsights.length ? (
                <section>
                  <p className="distillSectionEyebrow">KNOWLEDGE CARDS</p>
                  <h2>干货提炼</h2>
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
                </section>
              ) : null}

              {analysis.cautions.length ? (
                <section>
                  <p className="distillSectionEyebrow">BOUNDARIES</p>
                  <h2>哪些表达需要谨慎</h2>
                  <ul className="distillCautions">
                    {analysis.cautions.map((caution) => (
                      <li key={caution}>
                        <WarningCircle aria-hidden="true" size={17} />
                        {caution}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>

            <aside className="distillEvidenceRail" aria-label="证据与来源">
              <section>
                <div className="distillRailHeading">
                  <h2>主张与证据</h2>
                  <span>{analysis.claims.length} 条</span>
                </div>
                <div className="distillClaimList">
                  {analysis.claims.map((claim) => (
                    <article key={`${claim.type}-${claim.claim}`}>
                      <div>
                        <span>{claimTypeLabels[claim.type] ?? claim.type}</span>
                        <span>
                          置信度{" "}
                          {confidenceLabels[claim.confidence] ??
                            claim.confidence}
                        </span>
                      </div>
                      <p>{claim.claim}</p>
                      <small>
                        {claim.evidenceParagraphs.length
                          ? claim.evidenceParagraphs
                              .map((number) => `P${number}`)
                              .join("、")
                          : "未标注原文段落"}
                      </small>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <div className="distillRailHeading">
                  <h2>原文锚点</h2>
                  <span>{referencedParagraphs.length} 处</span>
                </div>
                <div className="distillParagraphs">
                  {referencedParagraphs.map((paragraph) => (
                    <blockquote key={paragraph.number}>
                      <span>P{paragraph.number}</span>
                      <p>{paragraph.text}</p>
                    </blockquote>
                  ))}
                </div>
              </section>

              <section className="distillProvenance">
                <div className="distillRailHeading">
                  <h2>回答边界</h2>
                  <CheckCircle aria-hidden="true" size={16} weight="fill" />
                </div>
                <p>当前仅使用导入正文生成，不假装调用外部搜索补写结论。</p>
                <span>
                  {analysis.provider} / {analysis.model}
                </span>
              </section>
            </aside>
          </div>
        </article>

        <DistillFollowUp
          documentId={document.id}
          initialMessages={messages.map((message) => ({
            ...message,
            createdAt: message.createdAt.toISOString(),
          }))}
          suggestedQuestions={analysis.followUpQuestions}
        />
      </div>
    </main>
  );
}
