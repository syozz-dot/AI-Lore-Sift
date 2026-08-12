import {
  DISTILL_PROMPT_VERSION,
  estimateOriginalReadingMinutes,
  generateDistillationResponse,
} from "../../../lib/distill-analysis";
import { getDistillSession } from "../../../lib/distill-auth";
import {
  completeDistillDocument,
  createDistillDocument,
  failDistillDocument,
} from "../../../lib/distill";
import { prepareDistillSource } from "../../../lib/distill-source";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../lib/private-request";
import type { DistillPersonalizationContext } from "../../../lib/distill-analysis";

export const runtime = "nodejs";
export const maxDuration = 300;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "脱水任务失败，请稍后重试。";
}

export async function POST(request: Request) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  const session = await getDistillSession();
  if (!session) {
    return privateJson(
      { error: "私人工作区登录已失效，请重新验证。" },
      { status: 401 },
    );
  }
  if (!process.env.DATABASE_URL) {
    return privateJson({ error: "数据库尚未配置。" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    input?: unknown;
    personalization?: unknown;
  } | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (!input) {
    return privateJson({ error: "请粘贴网页链接或正文。" }, { status: 400 });
  }
  if (input.length > 100_000) {
    return privateJson({ error: "单次输入最多 10 万字符。" }, { status: 413 });
  }

  const personalization = parsePersonalization(body?.personalization);

  let documentId: string | null = null;
  try {
    const source = await prepareDistillSource(input);
    documentId = await createDistillDocument({
      ownerId: session.ownerId,
      sourceType: source.sourceType,
      sourceUrl: source.sourceUrl,
      sourceTitle: source.sourceTitle,
      sourceAuthor: source.sourceAuthor,
      rawText: source.rawText,
      inputCharacters: source.rawText.length,
      status: "processing",
      accessMode: "private",
      billableUnits: 0,
    });
    const generated = await generateDistillationResponse({
      sourceTitle: source.sourceTitle,
      sourceUrl: source.sourceUrl,
      paragraphs: source.paragraphs,
      personalization,
    });
    const analysis = generated.persisted;
    await completeDistillDocument(documentId, {
      documentId,
      title: analysis.title,
      verdict: analysis.verdict,
      verdictReason: analysis.verdictReason,
      estimatedReadingMinutes: estimateOriginalReadingMinutes(
        source.rawText.length,
      ),
      summary: analysis.summary,
      keyPoints: analysis.keyPoints,
      claims: analysis.claims,
      transferableInsights: analysis.transferableInsights,
      cautions: analysis.cautions,
      followUpQuestions: analysis.followUpQuestions,
      provider: analysis.provider,
      model: analysis.model,
      promptVersion: DISTILL_PROMPT_VERSION,
      outputTokens: analysis.outputTokens,
    });
    return privateJson({
      id: documentId,
      personalizedInsights: generated.personalizedInsights,
      personalizationError: generated.personalizationError,
    });
  } catch (error) {
    const message = errorMessage(error);
    if (documentId) await failDistillDocument(documentId, message);
    return privateJson({ error: message }, { status: 422 });
  }
}

function parsePersonalization(
  value: unknown,
): DistillPersonalizationContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const context = value as Record<string, unknown>;
  const text = (field: string, limit: number) =>
    typeof context[field] === "string"
      ? context[field].trim().slice(0, limit)
      : "";
  const memories = Array.isArray(context.memories)
    ? context.memories
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 600))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const result = {
    purpose: text("purpose", 2_000),
    directions: text("directions", 2_000),
    currentContext: text("currentContext", 2_000),
    preferredHelp: text("preferredHelp", 2_000),
    boundaries: text("boundaries", 2_000),
    memories,
  };
  return Object.values(result).some((item) =>
    Array.isArray(item) ? item.length : item,
  )
    ? result
    : null;
}
