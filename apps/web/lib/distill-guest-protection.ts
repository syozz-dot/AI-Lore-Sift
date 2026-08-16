import { createHmac } from "node:crypto";

import { isTurnstileConfigured, verifyTurnstileToken } from "./turnstile";

export type GuestProtectionMode = "turnstile" | "rate-limit" | "disabled";
export type GuestModelAction = "preview" | "message";

const CLIENT_WINDOW_MS = 10 * 60 * 1_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_DAILY_MODEL_LIMIT = 200;
const CLIENT_LIMITS: Record<GuestModelAction, number> = {
  preview: 3,
  message: 8,
};

interface BudgetEntry {
  count: number;
  resetAt: number;
}

interface GuestProtectionState {
  budgets: Map<string, BudgetEntry>;
  operations: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __annDistillGuestProtection: GuestProtectionState | undefined;
}

const state =
  globalThis.__annDistillGuestProtection ??
  (globalThis.__annDistillGuestProtection = {
    budgets: new Map(),
    operations: 0,
  });

function pruneBudgets(now: number) {
  state.operations = (state.operations ?? 0) + 1;
  if (state.operations % 64 !== 0 && state.budgets.size < 4_096) return;
  for (const [key, entry] of state.budgets) {
    if (entry.resetAt <= now) state.budgets.delete(key);
  }
  while (state.budgets.size > 4_096) {
    const oldest = state.budgets.keys().next().value as string | undefined;
    if (!oldest) break;
    state.budgets.delete(oldest);
  }
}

function configuredMode() {
  return process.env.DISTILL_GUEST_PROTECTION_MODE?.trim().toLowerCase() || "";
}

export function getGuestProtectionMode(): GuestProtectionMode | null {
  const mode = configuredMode();
  if (mode === "turnstile" || mode === "rate-limit" || mode === "disabled") {
    return mode;
  }
  return process.env.NODE_ENV === "production" ? null : "disabled";
}

export function getGuestProtectionError() {
  const mode = getGuestProtectionMode();
  if (!mode) {
    return "公开体验保护模式尚未配置。";
  }
  if (process.env.NODE_ENV === "production" && mode === "disabled") {
    return "生产环境不能关闭公开体验保护。";
  }
  if (mode === "turnstile" && !isTurnstileConfigured()) {
    return "公开体验的人机验证尚未配置。";
  }
  return null;
}

export function isGuestChallengeRequired() {
  return getGuestProtectionMode() === "turnstile";
}

function dailyModelLimit() {
  const parsed = Number.parseInt(
    process.env.DISTILL_GUEST_DAILY_MODEL_LIMIT || "",
    10,
  );
  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : DEFAULT_DAILY_MODEL_LIMIT;
}

function consumeBudget(
  key: string,
  limit: number,
  resetAt: number,
  now = Date.now(),
) {
  const existing = state.budgets.get(key);
  const entry =
    !existing || existing.resetAt <= now ? { count: 0, resetAt } : existing;
  if (entry.count >= limit) {
    return {
      allowed: false as const,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
    };
  }
  entry.count += 1;
  state.budgets.set(key, entry);
  return { allowed: true as const, retryAfterSeconds: 0 };
}

function clientFingerprint(request: Request) {
  const forwarded =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const language = request.headers.get("accept-language") || "unknown";
  const secret = process.env.DISTILL_SESSION_SECRET?.trim() || "unconfigured";
  return createHmac("sha256", secret)
    .update(`${forwarded}\n${userAgent}\n${language}`)
    .digest("base64url");
}

export async function verifyGuestChallenge(token: unknown) {
  if (!isGuestChallengeRequired()) return true;
  return verifyTurnstileToken(token);
}

export function consumeGuestModelBudget(
  request: Request,
  action: GuestModelAction,
  now = Date.now(),
) {
  if (getGuestProtectionMode() === "disabled") {
    return { allowed: true as const, retryAfterSeconds: 0 };
  }

  pruneBudgets(now);

  const clientResetAt = now + CLIENT_WINDOW_MS;
  const client = consumeBudget(
    `client:${action}:${clientFingerprint(request)}`,
    CLIENT_LIMITS[action],
    clientResetAt,
    now,
  );
  if (!client.allowed) {
    return {
      ...client,
      error: "请求过于频繁，请稍后再试。",
    };
  }

  const dayStart = Math.floor(now / DAY_MS) * DAY_MS;
  const global = consumeBudget(
    `global:${dayStart}`,
    dailyModelLimit(),
    dayStart + DAY_MS,
    now,
  );
  if (!global.allowed) {
    return {
      ...global,
      error: "今日公开体验额度已用完，请明天再试。",
    };
  }
  return { allowed: true as const, retryAfterSeconds: 0 };
}

export function resetGuestProtectionForTests() {
  state.budgets.clear();
  state.operations = 0;
}
