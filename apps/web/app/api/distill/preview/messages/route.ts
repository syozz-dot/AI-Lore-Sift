import { generateDistillFollowUp } from "../../../../../lib/distill-analysis";
import {
  createGuestUsageValue,
  DISTILL_GUEST_COOKIE,
  getGuestUsage,
  GUEST_FOLLOW_UP_LIMIT,
  guestUsageCookieOptions,
} from "../../../../../lib/distill-guest";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../../../lib/private-request";
import {
  consumeGuestModelBudget,
  getGuestProtectionError,
} from "../../../../../lib/distill-guest-protection";

export const runtime = "nodejs";
export const maxDuration = 120;

function text(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "这次追问没有成功，请重试。";
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  const protectionError = getGuestProtectionError();
  if (protectionError) {
    return privateJson({ error: protectionError }, { status: 503 });
  }
  const usage = await getGuestUsage();
  if (!usage) {
    return privateJson(
      { error: "请先完成一次公开脱水体验。" },
      { status: 401 },
    );
  }
  if (usage.followUps >= GUEST_FOLLOW_UP_LIMIT) {
    return privateJson(
      { error: `公开体验最多追问 ${GUEST_FOLLOW_UP_LIMIT} 次。` },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    question?: unknown;
    sourceTitle?: unknown;
    rawText?: unknown;
    summary?: unknown;
    keyPoints?: unknown;
    messages?: unknown;
  } | null;
  const question = text(body?.question, 2_000);
  const rawText = text(body?.rawText, 80_000);
  const summary = text(body?.summary, 1_200);
  if (!question || !rawText || !summary) {
    return privateJson({ error: "追问材料不完整。" }, { status: 400 });
  }
  const keyPoints = Array.isArray(body?.keyPoints)
    ? body.keyPoints
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && !Array.isArray(item)),
        )
        .map((item) => ({
          title: text(item.title, 100),
          detail: text(item.detail, 500),
          evidenceParagraphs: Array.isArray(item.evidenceParagraphs)
            ? item.evidenceParagraphs
                .filter(
                  (value): value is number =>
                    Number.isInteger(value) && value >= 1,
                )
                .slice(0, 6)
            : [],
        }))
        .filter((item) => item.title && item.detail)
        .slice(0, 6)
    : [];
  const messages = Array.isArray(body?.messages)
    ? body.messages
        .filter((item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && !Array.isArray(item)),
        )
        .map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: text(item.content, 2_000),
        }))
        .filter((item) => item.content)
        .slice(-8)
    : [];

  const budget = consumeGuestModelBudget(request, "message");
  if (!budget.allowed) {
    return privateJson(
      { error: budget.error },
      {
        status: 429,
        headers: { "Retry-After": String(budget.retryAfterSeconds) },
      },
    );
  }

  try {
    const answer = await generateDistillFollowUp({
      sourceTitle: text(body?.sourceTitle, 500) || null,
      rawText,
      summary,
      keyPoints,
      messages,
      question,
    });
    const response = privateJson({
      messages: [
        {
          id: crypto.randomUUID(),
          role: "user",
          content: question,
          createdAt: new Date().toISOString(),
        },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: answer,
          createdAt: new Date().toISOString(),
        },
      ],
      remaining: GUEST_FOLLOW_UP_LIMIT - usage.followUps - 1,
    });
    response.cookies.set(
      DISTILL_GUEST_COOKIE,
      createGuestUsageValue({
        usedAt: usage.usedAt,
        followUps: usage.followUps + 1,
      }),
      guestUsageCookieOptions,
    );
    return response;
  } catch (error) {
    return privateJson({ error: messageFor(error) }, { status: 422 });
  }
}
