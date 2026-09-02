import { afterEach, describe, expect, it } from "vitest";

import {
  checkPublicApiRateLimit,
  resetPublicApiRateLimit,
} from "./public-api-protection";

describe("public API protection", () => {
  afterEach(() => {
    resetPublicApiRateLimit();
    delete process.env.PUBLIC_API_REQUESTS_PER_MINUTE;
  });

  it("allows normal traffic and rejects a burst above the configured limit", () => {
    process.env.PUBLIC_API_REQUESTS_PER_MINUTE = "30";
    const request = new Request("https://ailoresift.com/api/stories", {
      headers: { "cf-connecting-ip": "203.0.113.10" },
    });

    for (let index = 0; index < 30; index += 1) {
      expect(checkPublicApiRateLimit(request, 1_000).allowed).toBe(true);
    }
    const blocked = checkPublicApiRateLimit(request, 1_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);
  });

  it("uses separate pseudonymous buckets and resets after one minute", () => {
    process.env.PUBLIC_API_REQUESTS_PER_MINUTE = "30";
    const first = new Request("https://ailoresift.com/api/stories", {
      headers: { "cf-connecting-ip": "203.0.113.10" },
    });
    const second = new Request("https://ailoresift.com/api/stories", {
      headers: { "cf-connecting-ip": "203.0.113.11" },
    });

    for (let index = 0; index < 30; index += 1) {
      checkPublicApiRateLimit(first, 1_000);
    }
    expect(checkPublicApiRateLimit(second, 1_000).allowed).toBe(true);
    expect(checkPublicApiRateLimit(first, 61_001).allowed).toBe(true);
  });
});
