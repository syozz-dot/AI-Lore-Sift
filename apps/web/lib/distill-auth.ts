import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const DISTILL_SESSION_COOKIE = "ann_distill_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

interface DistillSessionPayload {
  ownerId: string;
  expiresAt: number;
}

function sessionSecret() {
  return (
    process.env.DISTILL_SESSION_SECRET?.trim() ||
    process.env.DISTILL_ACCESS_KEY?.trim() ||
    ""
  );
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret())
    .update(value)
    .digest("base64url");
}

function equalStrings(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function isDistillWorkspaceConfigured() {
  return Boolean(
    process.env.DISTILL_ACCESS_KEY?.trim() && sessionSecret().length >= 12,
  );
}

export function getConfiguredDistillOwnerId() {
  return process.env.DISTILL_OWNER_ID?.trim() || "personal-owner";
}

export function verifyDistillAccessKey(candidate: string) {
  const expected = process.env.DISTILL_ACCESS_KEY?.trim();
  return Boolean(expected && equalStrings(candidate.trim(), expected));
}

export function createDistillSessionValue() {
  if (!isDistillWorkspaceConfigured()) {
    throw new Error("Distill workspace access is not configured");
  }

  const payload: DistillSessionPayload = {
    ownerId: getConfiguredDistillOwnerId(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1_000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyDistillSessionValue(value: string | undefined | null) {
  if (!value || !isDistillWorkspaceConfigured()) return null;
  const [encoded, signature, extra] = value.split(".");
  if (
    !encoded ||
    !signature ||
    extra ||
    !equalStrings(sign(encoded), signature)
  )
    return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<DistillSessionPayload>;
    if (
      typeof payload.ownerId !== "string" ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now()
    )
      return null;
    return payload as DistillSessionPayload;
  } catch {
    return null;
  }
}

export async function getDistillSession() {
  const cookieStore = await cookies();
  return verifyDistillSessionValue(
    cookieStore.get(DISTILL_SESSION_COOKIE)?.value,
  );
}

export const distillSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
