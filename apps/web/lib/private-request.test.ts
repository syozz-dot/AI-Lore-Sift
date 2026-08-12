import { describe, expect, it } from "vitest";

import { privateJson, rejectUntrustedPrivateMutation } from "./private-request";

describe("private workspace request boundary", () => {
  it("rejects cross-origin browser mutations", async () => {
    const request = new Request("https://example.com/api/distill", {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
    });
    const response = rejectUntrustedPrivateMutation(request);
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({
      error: "请求来源无效。",
    });
  });

  it("accepts same-origin browser mutations", () => {
    const request = new Request("https://example.com/api/distill", {
      method: "POST",
      headers: {
        origin: "https://example.com",
        "sec-fetch-site": "same-origin",
      },
    });
    expect(rejectUntrustedPrivateMutation(request)).toBeNull();
  });

  it("marks JSON responses private and non-cacheable", () => {
    const response = privateJson({ ok: true });
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
  });
});
