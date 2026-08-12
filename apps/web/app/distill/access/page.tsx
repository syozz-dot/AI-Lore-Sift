import { LockKeyOpen } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DistillAccessForm } from "../../../components/distill-access-form";
import {
  getDistillSession,
  isDistillWorkspaceConfigured,
} from "../../../lib/distill-auth";

export const metadata: Metadata = {
  title: "私人脱水工作区",
  description: "AI News Navigator 私人脱水工作区访问验证。",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function DistillAccessPage() {
  const session = await getDistillSession();
  if (session) redirect("/distill");
  const configured = isDistillWorkspaceConfigured();

  return (
    <main className="distillAccessPage">
      <section>
        <LockKeyOpen aria-hidden="true" size={28} />
        <p className="distillAccessLabel">私人能力</p>
        <h1>先验证，再开始脱水。</h1>
        <p className="distillAccessDescription">
          当前工作区只向站点所有者开放。内容不会进入公开情报流；现阶段原文、分析、追问和知识卡会保存在站点数据库中。
        </p>
        {configured ? (
          <DistillAccessForm />
        ) : (
          <div className="distillNotConfigured">
            <strong>工作区尚未启用</strong>
            <span>
              请在 Vercel 配置 DISTILL_ACCESS_KEY 和 独立的
              DISTILL_SESSION_SECRET，然后重新部署。
            </span>
          </div>
        )}
      </section>
    </main>
  );
}
