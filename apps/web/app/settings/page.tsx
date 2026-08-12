import type { Metadata } from "next";

import { PrivateWorkspaceSettings } from "../../components/private-workspace-settings";

export const metadata: Metadata = {
  title: "私人设置",
  description: "只保存在当前浏览器中的阅读画像、记忆与加密备份。",
  robots: { index: false, follow: false },
};

export default function SettingsPage() {
  return (
    <main className="privateSettingsPage">
      <header className="privateSettingsIntro">
        <p>本机私人工作区</p>
        <h1>先告诉平台，你想用它解决什么。</h1>
        <p>
          不按岗位贴标签。由你描述目的、方向与当前问题，之后只有你明确确认的知识，才会进入个人记忆。
        </p>
      </header>
      <PrivateWorkspaceSettings />
    </main>
  );
}
