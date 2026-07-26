import { afterEach, describe, expect, it } from "vitest";

import {
  createMediaProxyUrl,
  isAllowedMediaUrl,
  verifyMediaProxyRequest,
} from "./media-proxy";

describe("media proxy signing", () => {
  const originalSecret = process.env.MEDIA_PROXY_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.MEDIA_PROXY_SECRET;
    else process.env.MEDIA_PROXY_SECRET = originalSecret;
  });

  it("signs only allowlisted media hosts", () => {
    process.env.MEDIA_PROXY_SECRET = "test-secret";
    const expiresAt = Math.floor(Date.now() / 1_000) + 600;
    const sourceUrl = "https://pbs.twimg.com/media/example.jpg";
    const proxyUrl = createMediaProxyUrl(sourceUrl, expiresAt);
    const params = new URL(proxyUrl, "https://navigator.example").searchParams;

    expect(proxyUrl.startsWith("/api/media?")).toBe(true);
    expect(
      verifyMediaProxyRequest({
        url: params.get("u") ?? "",
        expiresAt: Number(params.get("exp")),
        suppliedSignature: params.get("sig") ?? "",
      }),
    ).toBe(true);
    expect(
      createMediaProxyUrl("https://untrusted.example/image.jpg", expiresAt),
    ).toBe("https://untrusted.example/image.jpg");
    expect(
      isAllowedMediaUrl(
        "https://wechat2rss.xlab.app/img-proxy/example/image.jpg",
      ),
    ).toBe(true);
    expect(isAllowedMediaUrl("http://127.0.0.1/image.jpg")).toBe(false);
  });
});
