import { generateDistillFollowUp } from "../../../../../lib/distill-analysis";
import { getDistillSession } from "../../../../../lib/distill-auth";
import {
  createDistillMessage,
  getDistillDocument,
  listDistillMessages,
} from "../../../../../lib/distill";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../../../lib/private-request";

export const runtime = "nodejs";
export const maxDuration = 120;

function messageFor(error: unknown) {
  return error instanceof Error ? error.message : "这次追问没有成功，请重试。";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    question?: unknown;
  } | null;
  const question =
    typeof body?.question === "string" ? body.question.trim() : "";
  if (!question) {
    return privateJson({ error: "请输入想继续追问的问题。" }, { status: 400 });
  }
  if (question.length > 2_000) {
    return privateJson({ error: "单次追问最多 2,000 字。" }, { status: 413 });
  }

  try {
    const document = await getDistillDocument(session.ownerId, id);
    if (!document?.analysis || document.status !== "ready") {
      return privateJson(
        { error: "这份内容还没有完成脱水，暂时不能追问。" },
        { status: 409 },
      );
    }
    const history = await listDistillMessages(session.ownerId, id);
    const userMessage = await createDistillMessage({
      ownerId: session.ownerId,
      documentId: id,
      role: "user",
      content: question,
    });
    const answer = await generateDistillFollowUp({
      sourceTitle: document.sourceTitle,
      rawText: document.rawText,
      summary: document.analysis.summary,
      keyPoints: document.analysis.keyPoints,
      messages: history,
      question,
    });
    const assistantMessage = await createDistillMessage({
      ownerId: session.ownerId,
      documentId: id,
      role: "assistant",
      content: answer,
    });
    return privateJson({
      messages: [userMessage, assistantMessage],
    });
  } catch (error) {
    return privateJson({ error: messageFor(error) }, { status: 422 });
  }
}
