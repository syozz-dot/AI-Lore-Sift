import { afterEach, describe, expect, it } from "vitest";

import {
  createGuestUsageValue,
  GUEST_FOLLOW_UP_LIMIT,
  isGuestDistillConfigured,
  verifyGuestUsageValue,
} from "./distill-guest";

const originalSecret = process.env.DISTILL_SESSION_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.DISTILL_SESSION_SECRET;
  else process.env.DISTILL_SESSION_SECRET = originalSecret;
});

describe("public distill guest usage", () => {
  it("signs the one-time usage marker without exposing the secret", () => {
    process.env.DISTILL_SESSION_SECRET =
      "independent-session-secret-that-is-long-enough";
    const value = createGuestUsageValue({
      usedAt: 1_700_000_000_000,
      followUps: 2,
    });

    expect(value).not.toContain(process.env.DISTILL_SESSION_SECRET);
    expect(verifyGuestUsageValue(value)).toMatchObject({
      usedAt: 1_700_000_000_000,
      followUps: 2,
    });
    expect(GUEST_FOLLOW_UP_LIMIT).toBe(3);
  });

  it("rejects tampered markers and short secrets", () => {
    process.env.DISTILL_SESSION_SECRET = "too-short";
    expect(isGuestDistillConfigured()).toBe(false);

    process.env.DISTILL_SESSION_SECRET =
      "independent-session-secret-that-is-long-enough";
    const value = createGuestUsageValue();
    expect(verifyGuestUsageValue(`${value}changed`)).toBeNull();
  });
});
