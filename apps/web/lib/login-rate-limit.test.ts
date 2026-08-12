import { beforeEach, describe, expect, it } from "vitest";

import {
  canAttemptLogin,
  clearLoginFailures,
  loginRateLimitKey,
  recordLoginFailure,
  resetLoginRateLimitForTests,
} from "./login-rate-limit";

beforeEach(() => resetLoginRateLimitForTests());

describe("distill login rate limit", () => {
  it("blocks a client after five failures and clears on success", () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(canAttemptLogin("client", 1_000)).toBe(true);
      recordLoginFailure("client", 1_000);
    }
    expect(canAttemptLogin("client", 1_000)).toBe(false);
    clearLoginFailures("client");
    expect(canAttemptLogin("client", 1_000)).toBe(true);
  });

  it("uses the first proxy-provided address", () => {
    const request = new Request("https://example.com/api/distill/session", {
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" },
    });
    expect(loginRateLimitKey(request)).toBe("203.0.113.8");
  });
});
