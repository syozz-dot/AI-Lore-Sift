import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const DISTILL_GUEST_COOKIE = "ann_distill_guest";
const GUEST_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const GUEST_FOLLOW_UP_LIMIT = 3;

interface GuestUsagePayload {
  usedAt: number;
  followUps: number;
  nonce: string;
}

function secret() {
  return process.env.DISTILL_SESSION_SECRET?.trim() || "";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function equal(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function isGuestDistillConfigured() {
  return secret().length >= 32;
}

export function createGuestUsageValue(
  input: Pick<GuestUsagePayload, "usedAt" | "followUps"> = {
    usedAt: Date.now(),
    followUps: 0,
  },
) {
  if (!isGuestDistillConfigured()) {
    throw new Error("匿名体验保护尚未配置。");
  }
  const payload: GuestUsagePayload = {
    ...input,
    nonce: randomBytes(18).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyGuestUsageValue(value: string | undefined | null) {
  if (!value || !isGuestDistillConfigured()) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra || !equal(sign(encoded), signature)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<GuestUsagePayload>;
    if (
      typeof payload.usedAt !== "number" ||
      payload.usedAt > Date.now() + 60_000 ||
      typeof payload.followUps !== "number" ||
      !Number.isInteger(payload.followUps) ||
      payload.followUps < 0 ||
      typeof payload.nonce !== "string" ||
      payload.nonce.length < 16
    ) {
      return null;
    }
    return payload as GuestUsagePayload;
  } catch {
    return null;
  }
}

export async function getGuestUsage() {
  const cookieStore = await cookies();
  return verifyGuestUsageValue(cookieStore.get(DISTILL_GUEST_COOKIE)?.value);
}

export const guestUsageCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: GUEST_MAX_AGE_SECONDS,
  priority: "high" as const,
};
