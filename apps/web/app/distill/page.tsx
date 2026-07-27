import {
  ArrowRight,
  CheckCircle,
  FileText,
  LockSimple,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DistillSubmitForm } from "../../components/distill-submit-form";
import { getDistillSession } from "../../lib/distill-auth";
import { listDistillDocuments } from "../../lib/distill";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "脱水工作台",
  description: "把网页与长文变成有来源、有证据、可沉淀的结构化知识。",
};

const verdictLabels: Record<string, string> = {
  skip: "可以跳过",
  skim: "读脱水版即可",
  read: "建议阅读原文",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function DistillPage() {
  const session = await getDistillSession();
  if (!session) redirect("/distill/access?next=/distill");
  const documents = process.env.DATABASE_URL
    ? await listDistillDocuments(session.ownerId)
    : [];

  return (
    <main className="distillWorkspace">
      <section className="distillHero" aria-labelledby="distill-title">
        <div className="distillHeroCopy">
          <p>
            <LockSimple aria-hidden="true" size={14} />
            私人工作区
          </p>
          <h1 id="distill-title">把长内容，变成可复用的知识。</h1>
          <p>
            先判断值不值得读，再还原论点与证据，最后留下能够继续使用的知识。
          </p>
        </div>
        <DistillSubmitForm />
      </section>

      <section className="distillPrinciples" aria-label="脱水输出结构">
        <div>
          <strong>读前判断</strong>
          <span>直接告诉你该跳过、略读，还是值得完整阅读。</span>
        </div>
        <div>
          <strong>三分钟脱水</strong>
          <span>保留核心论点、方法和重要细节，不只生成一段摘要。</span>
        </div>
        <div>
          <strong>证据锚点</strong>
          <span>事实、作者观点和推断分开，并回到原文段落核查。</span>
        </div>
        <div>
          <strong>知识沉淀</strong>
          <span>值得带走的内容可以进入知识库，后续继续检索与追问。</span>
        </div>
      </section>

      <section
        className="distillHistory"
        aria-labelledby="distill-history-title"
      >
        <div className="distillSectionHeading">
          <div>
            <p>只显示当前私人空间</p>
            <h2 id="distill-history-title">最近脱水</h2>
          </div>
          <Link href="/knowledge">
            打开知识库
            <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>

        {documents.length ? (
          <div className="distillHistoryList">
            {documents.map((document) => (
              <article key={document.id}>
                <div className="distillHistoryState">
                  {document.status === "ready" ? (
                    <CheckCircle aria-hidden="true" size={17} weight="fill" />
                  ) : (
                    <FileText aria-hidden="true" size={17} />
                  )}
                  <span>
                    {document.status === "ready"
                      ? verdictLabels[document.verdict ?? ""] || "已完成"
                      : document.status === "failed"
                        ? "处理失败"
                        : "正在处理"}
                  </span>
                </div>
                <Link href={`/distill/${document.id}`}>
                  <h3>
                    {document.title ||
                      document.sourceTitle ||
                      "尚未生成标题的内容"}
                  </h3>
                  <p>
                    {document.summary ||
                      document.errorMessage ||
                      "正在读取原文并建立证据锚点。"}
                  </p>
                </Link>
                <div className="distillHistoryMeta">
                  <span>{document.sourceType === "url" ? "网页" : "正文"}</span>
                  <span>{formatDate(document.createdAt)}</span>
                  <span>{document.savedAt ? "已存入知识库" : ""}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="distillHistoryEmpty">
            <FileText aria-hidden="true" size={25} />
            <h3>还没有脱水记录</h3>
            <p>上方粘贴第一篇网页或正文，完整结果会保存在这里。</p>
          </div>
        )}
      </section>
    </main>
  );
}
