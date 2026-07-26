import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_ALLOWED_HOSTS = [
  "pbs.twimg.com",
  "video.twimg.com",
  "mmbiz.qpic.cn",
  "mmbiz.qlogo.cn",
];

function proxySecret(): string | null {
  return (
    process.env.MEDIA_PROXY_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

export function mediaProxyAllowedHosts(): string[] {
  const configured = process.env.MEDIA_PROXY_ALLOWED_HOSTS?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...(configured ?? [])])];
}

export function isAllowedMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    const hostname = url.hostname.toLowerCase();
    return mediaProxyAllowedHosts().some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

function signature(url: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${url}\n${expiresAt}`)
    .digest("base64url");
}

export function createMediaProxyUrl(
  url: string,
  expiresAt = Math.floor(Date.now() / 1_000) + 7 * 24 * 60 * 60,
): string {
  const secret = proxySecret();
  if (!secret || !isAllowedMediaUrl(url)) return url;
  const params = new URLSearchParams({
    u: url,
    exp: String(expiresAt),
    sig: signature(url, expiresAt, secret),
  });
  return `/api/media?${params.toString()}`;
}

export function verifyMediaProxyRequest(input: {
  url: string;
  expiresAt: number;
  suppliedSignature: string;
}): boolean {
  const secret = proxySecret();
  if (
    !secret ||
    !isAllowedMediaUrl(input.url) ||
    input.expiresAt < Math.floor(Date.now() / 1_000)
  ) {
    return false;
  }
  const expected = Buffer.from(
    signature(input.url, input.expiresAt, secret),
    "utf8",
  );
  const supplied = Buffer.from(input.suppliedSignature, "utf8");
  return (
    expected.length === supplied.length && timingSafeEqual(expected, supplied)
  );
}
