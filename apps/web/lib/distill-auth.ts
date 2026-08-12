import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const DISTILL_SESSION_COOKIE = "ann_distill_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const MIN_ACCESS_KEY_LENGTH = 6;
const MIN_SESSION_SECRET_LENGTH = 32;

interface DistillSessionPayload {
  ownerId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}

function sessionSecret() {
  return process.env.DISTILL_SESSION_SECRET?.trim() || "";
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
  const accessKey = process.env.DISTILL_ACCESS_KEY?.trim() || "";
  const secret = sessionSecret();
  return Boolean(
    accessKey.length >= MIN_ACCESS_KEY_LENGTH &&
    secret.length >= MIN_SESSION_SECRET_LENGTH &&
    !equalStrings(accessKey, secret),
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
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1_000,
    nonce: randomBytes(18).toString("base64url"),
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
      payload.ownerId !== getConfiguredDistillOwnerId() ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      typeof payload.nonce !== "string" ||
      payload.nonce.length < 16 ||
      payload.issuedAt > Date.now() + 60_000 ||
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
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
  priority: "high" as const,
};
