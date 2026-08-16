import {
  DISTILL_PROMPT_VERSION,
  estimateOriginalReadingMinutes,
  generateDistillationResponse,
} from "../../../../lib/distill-analysis";
import {
  createGuestUsageValue,
  DISTILL_GUEST_COOKIE,
  getGuestUsage,
  guestUsageCookieOptions,
  isGuestDistillConfigured,
} from "../../../../lib/distill-guest";
import {
  attachLocalKnowledge,
  parseDistillPersonalization,
  parseLocalKnowledge,
} from "../../../../lib/distill-request";
import { prepareDistillSource } from "../../../../lib/distill-source";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../../lib/private-request";
import {
  consumeGuestModelBudget,
  getGuestProtectionError,
  verifyGuestChallenge,
} from "../../../../lib/distill-guest-protection";

export const runtime = "nodejs";
export const maxDuration = 300;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "脱水任务失败，请稍后重试。";
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  if (!isGuestDistillConfigured()) {
    return privateJson({ error: "匿名体验保护尚未配置。" }, { status: 503 });
  }
  const protectionError = getGuestProtectionError();
  if (protectionError) {
    return privateJson({ error: protectionError }, { status: 503 });
  }
  if (await getGuestUsage()) {
    return privateJson(
      { error: "当前浏览器已经使用过一次公开体验。" },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    input?: unknown;
    personalization?: unknown;
    localKnowledge?: unknown;
    turnstileToken?: unknown;
  } | null;
  if (!(await verifyGuestChallenge(body?.turnstileToken))) {
    return privateJson(
      { error: "人机验证未通过，请刷新后重试。" },
      { status: 403 },
    );
  }
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (!input) {
    return privateJson({ error: "请粘贴网页链接或正文。" }, { status: 400 });
  }
  if (input.length > 100_000) {
    return privateJson({ error: "单次输入最多 10 万字符。" }, { status: 413 });
  }

  const budget = consumeGuestModelBudget(request, "preview");
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
    const source = await prepareDistillSource(input);
    const personalization = attachLocalKnowledge({
      personalization: parseDistillPersonalization(body?.personalization),
      localKnowledge: parseLocalKnowledge(body?.localKnowledge),
      sourceTitle: source.sourceTitle,
      paragraphs: source.paragraphs,
    });
    const generated = await generateDistillationResponse({
      sourceTitle: source.sourceTitle,
      sourceUrl: source.sourceUrl,
      paragraphs: source.paragraphs,
      personalization,
    });
    const createdAt = new Date().toISOString();
    const id = crypto.randomUUID();
    const response = privateJson({
      document: {
        id,
        sourceType: source.sourceType,
        sourceUrl: source.sourceUrl,
        sourceTitle: source.sourceTitle,
        sourceAuthor: source.sourceAuthor,
        rawText: source.rawText,
        inputCharacters: source.rawText.length,
        analysis: {
          ...generated.persisted,
          promptVersion: DISTILL_PROMPT_VERSION,
          estimatedReadingMinutes: estimateOriginalReadingMinutes(
            source.rawText.length,
          ),
        },
        messages: [],
        personalizedInsights: generated.personalizedInsights,
        personalizationRequested: Boolean(personalization),
        personalizationError: generated.personalizationError,
        savedToKnowledge: false,
        createdAt,
        updatedAt: createdAt,
      },
    });
    response.cookies.set(
      DISTILL_GUEST_COOKIE,
      createGuestUsageValue(),
      guestUsageCookieOptions,
    );
    return response;
  } catch (error) {
    return privateJson({ error: errorMessage(error) }, { status: 422 });
  }
}
