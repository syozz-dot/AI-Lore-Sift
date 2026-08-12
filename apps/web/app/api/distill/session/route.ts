import {
  createDistillSessionValue,
  DISTILL_SESSION_COOKIE,
  distillSessionCookieOptions,
  isDistillWorkspaceConfigured,
  verifyDistillAccessKey,
} from "../../../../lib/distill-auth";
import {
  canAttemptLogin,
  clearLoginFailures,
  loginRateLimitKey,
  recordLoginFailure,
} from "../../../../lib/login-rate-limit";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../../lib/private-request";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;

  if (!isDistillWorkspaceConfigured()) {
    return privateJson(
      { error: "私人工作区尚未配置访问口令。" },
      { status: 503 },
    );
  }

  const rateLimitKey = loginRateLimitKey(request);
  if (!canAttemptLogin(rateLimitKey)) {
    return privateJson(
      { error: "验证请求过多，请稍后再试。" },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    accessKey?: unknown;
  } | null;
  const accessKey =
    typeof body?.accessKey === "string" ? body.accessKey.trim() : "";

  if (!verifyDistillAccessKey(accessKey)) {
    recordLoginFailure(rateLimitKey);
    return privateJson({ error: "验证未通过。" }, { status: 401 });
  }

  clearLoginFailures(rateLimitKey);
  const response = privateJson({ ok: true });
  response.cookies.set(
    DISTILL_SESSION_COOKIE,
    createDistillSessionValue(),
    distillSessionCookieOptions,
  );
  return response;
}

export async function DELETE(request: Request) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  const response = privateJson({ ok: true });
  response.cookies.set(DISTILL_SESSION_COOKIE, "", {
    ...distillSessionCookieOptions,
    maxAge: 0,
  });
  return response;
}
