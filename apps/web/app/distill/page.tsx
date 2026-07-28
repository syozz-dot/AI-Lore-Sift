import {
  Brain,
  FileMagnifyingGlass,
  LockSimple,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DistillSubmitForm } from "../../components/distill-submit-form";
import { DistillTaskList } from "../../components/distill-task-list";
import { getDistillSession } from "../../lib/distill-auth";
import { listDistillDocuments } from "../../lib/distill";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "脱水工作台",
  description: "把网页与长文变成有来源、有证据、可沉淀的结构化知识。",
};

export default async function DistillPage() {
  const session = await getDistillSession();
  if (!session) redirect("/distill/access?next=/distill");
  const documents = process.env.DATABASE_URL
    ? await listDistillDocuments(session.ownerId)
    : [];

  return (
    <main className="distillAgentWorkspace">
      <DistillTaskList documents={documents} />
      <div className="distillAgentCanvas">
        <section className="distillAgentIntro" aria-labelledby="distill-title">
          <p>
            <LockSimple aria-hidden="true" size={14} />
            私人知识工作台
          </p>
          <h1 id="distill-title">丢一篇内容进来，留下真正有用的部分。</h1>
          <span>
            先替你做读前判断，再把论点、证据和可复用知识整理成一份稳定文档。
            处理完成后还可以围绕原文继续追问。
          </span>
        </section>
        <DistillSubmitForm />
        <section className="distillAgentCapabilities" aria-label="脱水能力">
          <article>
            <FileMagnifyingGlass aria-hidden="true" size={21} />
            <div>
              <strong>判断值不值得读</strong>
              <span>给出阅读建议与理由，避免为了摘要而摘要。</span>
            </div>
          </article>
          <article>
            <Brain aria-hidden="true" size={21} />
            <div>
              <strong>形成稳定知识文档</strong>
              <span>导读、核心要点、证据边界与原文锚点一次整理。</span>
            </div>
          </article>
          <article>
            <Sparkle aria-hidden="true" size={21} />
            <div>
              <strong>继续追问与沉淀</strong>
              <span>围绕当前材料连续追问，单独保存真正值得带走的判断。</span>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
