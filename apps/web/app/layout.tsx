import "@fontsource-variable/jetbrains-mono/index.css";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/noto-serif-sc/index.css";
import type { Metadata } from "next";

import { SiteShell } from "../components/site-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI News Navigator",
    template: "%s | AI News Navigator",
  },
  description: "把分散的 AI 新闻整理成可验证、可判断、可行动的 Story。",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <SiteShell
          footer={
            <footer className="siteFooter">
              <span>AI News Navigator</span>
              <span>事实、判断与机会，保持边界清晰。</span>
            </footer>
          }
        >
          {children}
        </SiteShell>
      </body>
    </html>
  );
}
