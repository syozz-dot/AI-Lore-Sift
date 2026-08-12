import { afterEach, describe, expect, it } from "vitest";

import {
  createDistillSessionValue,
  isDistillWorkspaceConfigured,
  verifyDistillAccessKey,
  verifyDistillSessionValue,
} from "./distill-auth";

const originalAccessKey = process.env.DISTILL_ACCESS_KEY;
const originalSessionSecret = process.env.DISTILL_SESSION_SECRET;
const originalOwnerId = process.env.DISTILL_OWNER_ID;

afterEach(() => {
  const restoreEnvironmentVariable = (
    name: "DISTILL_ACCESS_KEY" | "DISTILL_SESSION_SECRET" | "DISTILL_OWNER_ID",
    value: string | undefined,
  ) => {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  };

  restoreEnvironmentVariable("DISTILL_ACCESS_KEY", originalAccessKey);
  restoreEnvironmentVariable("DISTILL_SESSION_SECRET", originalSessionSecret);
  restoreEnvironmentVariable("DISTILL_OWNER_ID", originalOwnerId);
});

describe("distill private session", () => {
  it("signs a session without storing the access key in the cookie", () => {
    process.env.DISTILL_ACCESS_KEY = "owner-access-key";
    process.env.DISTILL_SESSION_SECRET =
      "independent-session-secret-that-is-long-enough";
    process.env.DISTILL_OWNER_ID = "ethan";

    const value = createDistillSessionValue();
    expect(value).not.toContain("owner-access-key");
    expect(verifyDistillSessionValue(value)?.ownerId).toBe("ethan");
  });

  it("rejects incorrect access keys and modified sessions", () => {
    process.env.DISTILL_ACCESS_KEY = "owner-access-key";
    process.env.DISTILL_SESSION_SECRET =
      "independent-session-secret-that-is-long-enough";

    expect(verifyDistillAccessKey("wrong")).toBe(false);
    const value = createDistillSessionValue();
    expect(verifyDistillSessionValue(`${value}modified`)).toBeNull();
  });

  it("requires two independent, sufficiently long secrets", () => {
    process.env.DISTILL_ACCESS_KEY = "owner-access-key";
    delete process.env.DISTILL_SESSION_SECRET;
    expect(isDistillWorkspaceConfigured()).toBe(false);

    process.env.DISTILL_SESSION_SECRET = "owner-access-key";
    expect(isDistillWorkspaceConfigured()).toBe(false);

    process.env.DISTILL_SESSION_SECRET =
      "independent-session-secret-that-is-long-enough";
    expect(isDistillWorkspaceConfigured()).toBe(true);
  });

  it("invalidates sessions when the configured owner changes", () => {
    process.env.DISTILL_ACCESS_KEY = "owner-access-key";
    process.env.DISTILL_SESSION_SECRET =
      "independent-session-secret-that-is-long-enough";
    process.env.DISTILL_OWNER_ID = "owner-one";
    const value = createDistillSessionValue();

    process.env.DISTILL_OWNER_ID = "owner-two";
    expect(verifyDistillSessionValue(value)).toBeNull();
  });
});
