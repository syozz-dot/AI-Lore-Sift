import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  consumeGuestModelBudget,
  getGuestProtectionError,
  getGuestProtectionMode,
  resetGuestProtectionForTests,
} from "./distill-guest-protection";

const original = {
  mode: process.env.DISTILL_GUEST_PROTECTION_MODE,
  daily: process.env.DISTILL_GUEST_DAILY_MODEL_LIMIT,
  siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  secretKey: process.env.TURNSTILE_SECRET_KEY,
};

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function request(ip: string) {
  return new Request("https://example.com/api/distill/preview", {
    headers: {
      "cf-connecting-ip": ip,
      "user-agent": "guest-protection-test",
      "accept-language": "zh-CN",
    },
  });
}

beforeEach(() => {
  resetGuestProtectionForTests();
  process.env.DISTILL_GUEST_PROTECTION_MODE = "rate-limit";
  process.env.DISTILL_GUEST_DAILY_MODEL_LIMIT = "200";
});

afterEach(() => {
  resetGuestProtectionForTests();
  restore("DISTILL_GUEST_PROTECTION_MODE", original.mode);
  restore("DISTILL_GUEST_DAILY_MODEL_LIMIT", original.daily);
  restore("NEXT_PUBLIC_TURNSTILE_SITE_KEY", original.siteKey);
  restore("TURNSTILE_SECRET_KEY", original.secretKey);
});

describe("public Distill guest protection", () => {
  it("enforces the per-client preview window without persisting raw IPs", () => {
    const now = 1_700_000_000_000;
    expect(
      consumeGuestModelBudget(request("203.0.113.7"), "preview", now).allowed,
    ).toBe(true);
    expect(
      consumeGuestModelBudget(request("203.0.113.7"), "preview", now).allowed,
    ).toBe(true);
    expect(
      consumeGuestModelBudget(request("203.0.113.7"), "preview", now).allowed,
    ).toBe(true);
    expect(
      consumeGuestModelBudget(request("203.0.113.7"), "preview", now),
    ).toMatchObject({
      allowed: false,
      error: "请求过于频繁，请稍后再试。",
    });
    expect(
      consumeGuestModelBudget(request("203.0.113.8"), "preview", now).allowed,
    ).toBe(true);
  });

  it("applies the emergency daily model-call circuit breaker", () => {
    process.env.DISTILL_GUEST_DAILY_MODEL_LIMIT = "2";
    const now = 1_700_000_000_000;
    expect(
      consumeGuestModelBudget(request("203.0.113.10"), "message", now).allowed,
    ).toBe(true);
    expect(
      consumeGuestModelBudget(request("203.0.113.11"), "message", now).allowed,
    ).toBe(true);
    expect(
      consumeGuestModelBudget(request("203.0.113.12"), "message", now),
    ).toMatchObject({
      allowed: false,
      error: "今日公开体验额度已用完，请明天再试。",
    });
  });

  it("requires an explicit valid production protection configuration", () => {
    process.env.DISTILL_GUEST_PROTECTION_MODE = "turnstile";
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.TURNSTILE_SECRET_KEY;
    expect(getGuestProtectionMode()).toBe("turnstile");
    expect(getGuestProtectionError()).toBe("公开体验的人机验证尚未配置。");
  });
});
