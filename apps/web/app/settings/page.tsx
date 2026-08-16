import type { Metadata } from "next";
import { ShieldCheck } from "@phosphor-icons/react/dist/ssr";

import { PrivateWorkspaceSettings } from "../../components/private-workspace-settings";

export const metadata: Metadata = {
  title: "私人设置",
  description: "管理当前浏览器中的阅读偏好、个人记忆与加密备份。",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <main className="privateSettingsPage">
      <header className="privateSettingsIntro">
        <div className="privateSettingsKicker">
          <p>Private workspace</p>
          <span>
            <ShieldCheck aria-hidden="true" size={16} />
            仅本机存储
          </span>
        </div>
        <h1>私人设置</h1>
        <p>
          管理你的阅读偏好、个人记忆与本地备份，让内容筛选和脱水结果更贴近你的需求。
        </p>
      </header>
      <PrivateWorkspaceSettings />
    </main>
  );
}
