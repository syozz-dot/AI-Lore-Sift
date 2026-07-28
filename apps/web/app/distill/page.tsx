import { LockSimple } from "@phosphor-icons/react/dist/ssr";
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
      <div className="distillAgentCanvas distillNewTaskCanvas">
        <header className="distillConversationHeader">
          <div>
            <p>新建任务</p>
            <h1 id="distill-title">脱水助手</h1>
          </div>
          <span>
            <LockSimple aria-hidden="true" size={14} />
            仅你可见
          </span>
        </header>
        <DistillSubmitForm />
      </div>
    </main>
  );
}
