import type { NextConfig } from "next";

const privateWorkspaceHeaders = [
  { key: "Cache-Control", value: "private, no-store, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value:
      "base-uri 'self'; frame-ancestors 'none'; object-src 'none'; form-action 'self'",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const publicContentHeaders = [
  {
    key: "Cache-Control",
    value: "public, max-age=300, stale-while-revalidate=600",
  },
];

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ai-news-navigator/database",
    "@ai-news-navigator/intelligence",
    "@ai-news-navigator/jobs",
    "@ai-news-navigator/pipeline",
    "@ai-news-navigator/sources",
  ],
  webpack(config) {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
      ".cjs": [".cts", ".cjs"],
    };
    return config;
  },
  async headers() {
    return [
      { source: "/", headers: publicContentHeaders },
      { source: "/stories/:path*", headers: publicContentHeaders },
      { source: "/daily", headers: publicContentHeaders },
      { source: "/topics", headers: publicContentHeaders },
      { source: "/topics/:path*", headers: publicContentHeaders },
      { source: "/distill/:path*", headers: privateWorkspaceHeaders },
      { source: "/knowledge", headers: privateWorkspaceHeaders },
      { source: "/settings", headers: privateWorkspaceHeaders },
      { source: "/api/distill/:path*", headers: privateWorkspaceHeaders },
    ];
  },
};

export default nextConfig;
