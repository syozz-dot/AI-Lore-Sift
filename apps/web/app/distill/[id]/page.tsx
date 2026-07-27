import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  FileText,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DistillMarkdownButton } from "../../../components/distill-markdown-button";
import { KnowledgeSaveButton } from "../../../components/knowledge-save-button";
import { getDistillSession } from "../../../lib/distill-auth";
import { getDistillDocument } from "../../../lib/distill";
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
  const document = await getDistillDocument(session.ownerId, id);
  if (!document) notFound();

  if (document.status !== "ready" || !document.analysis) {
    return (
      <main className="distillResultState">
        {document.status === "failed" ? (
          <WarningCircle aria-hidden="true" size={30} />
        ) : (
          <FileText aria-hidden="true" size={30} />
        )}
        <p>{document.status === "failed" ? "本次处理失败" : "正在处理"}</p>
        <h1>
          {document.status === "failed"
            ? "没有生成可用的脱水内容。"
            : "正在建立原文与证据的对应关系。"}
        </h1>
        <span>
          {document.errorMessage ||
            "完成后会自动出现在最近脱水中，请稍后刷新。"}
        </span>
        <Link href="/distill">
          <ArrowLeft aria-hidden="true" size={16} />
          返回脱水工作台
        </Link>
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

  return (
    <main className="distillResultPage">
      <div className="distillResultShell">
        <nav className="distillResultBack" aria-label="返回">
          <Link href="/distill">
            <ArrowLeft aria-hidden="true" size={15} />
            脱水工作台
          </Link>
        </nav>

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
            <p className="distillOriginalTitle">原文：{document.sourceTitle}</p>
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
          <article className="distillResultBody">
            <section>
              <h2>三分钟脱水</h2>
              <p className="distillLeadSummary">{analysis.summary}</p>
            </section>

            <section>
              <h2>核心要点</h2>
              <div className="distillKeyPoints">
                {analysis.keyPoints.map((point) => (
                  <article key={`${point.title}-${point.detail}`}>
                    <h3>{point.title}</h3>
                    <p>{point.detail}</p>
                    {point.evidenceParagraphs.length ? (
                      <span>
                        证据{" "}
                        {point.evidenceParagraphs
                          .map((number) => `P${number}`)
                          .join("、")}
                      </span>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            {analysis.transferableInsights.length ? (
              <section>
                <h2>值得带走</h2>
                <ul className="distillTakeaways">
                  {analysis.transferableInsights.map((insight) => (
                    <li key={insight}>{insight}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {analysis.cautions.length ? (
              <section>
                <h2>阅读边界</h2>
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

            <section>
              <h2>继续追问</h2>
              <ul className="distillQuestions">
                {analysis.followUpQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
            </section>
          </article>

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
                        {confidenceLabels[claim.confidence] ?? claim.confidence}
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
                <h2>生成边界</h2>
                <CheckCircle aria-hidden="true" size={16} weight="fill" />
              </div>
              <p>仅使用当前导入正文生成，不调用外部知识补写结论。</p>
              <span>
                {analysis.provider} / {analysis.model}
              </span>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
