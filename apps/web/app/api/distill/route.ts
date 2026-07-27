import { NextResponse } from "next/server";

import {
  DISTILL_PROMPT_VERSION,
  estimateOriginalReadingMinutes,
  generateDistillation,
} from "../../../lib/distill-analysis";
import { getDistillSession } from "../../../lib/distill-auth";
import {
  completeDistillDocument,
  createDistillDocument,
  failDistillDocument,
} from "../../../lib/distill";
import { prepareDistillSource } from "../../../lib/distill-source";

export const runtime = "nodejs";
export const maxDuration = 300;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "脱水任务失败，请稍后重试。";
}

export async function POST(request: Request) {
  const session = await getDistillSession();
  if (!session) {
    return NextResponse.json(
      { error: "私人工作区登录已失效，请重新验证。" },
      { status: 401 },
    );
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "数据库尚未配置。" }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    input?: unknown;
  } | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (!input) {
    return NextResponse.json(
      { error: "请粘贴网页链接或正文。" },
      { status: 400 },
    );
  }
  if (input.length > 100_000) {
    return NextResponse.json(
      { error: "单次输入最多 10 万字符。" },
      { status: 413 },
    );
  }

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
    const analysis = await generateDistillation({
      sourceTitle: source.sourceTitle,
      sourceUrl: source.sourceUrl,
      paragraphs: source.paragraphs,
    });
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
    return NextResponse.json({ id: documentId });
  } catch (error) {
    const message = errorMessage(error);
    if (documentId) await failDistillDocument(documentId, message);
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
