import { NextResponse } from "next/server";

import {
  createDistillSessionValue,
  DISTILL_SESSION_COOKIE,
  distillSessionCookieOptions,
  isDistillWorkspaceConfigured,
  verifyDistillAccessKey,
} from "../../../../lib/distill-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isDistillWorkspaceConfigured()) {
    return NextResponse.json(
      { error: "私人工作区尚未配置访问口令。" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    accessKey?: unknown;
  } | null;
  const accessKey =
    typeof body?.accessKey === "string" ? body.accessKey.trim() : "";

  if (!verifyDistillAccessKey(accessKey)) {
    return NextResponse.json({ error: "访问口令不正确。" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    DISTILL_SESSION_COOKIE,
    createDistillSessionValue(),
    distillSessionCookieOptions,
  );
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DISTILL_SESSION_COOKIE, "", {
    ...distillSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
