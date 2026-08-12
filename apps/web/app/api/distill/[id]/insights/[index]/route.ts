import { getDistillSession } from "../../../../../../lib/distill-auth";
import {
  removeKnowledgeCard,
  saveKnowledgeCard,
} from "../../../../../../lib/distill";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../../../../lib/private-request";

function parseIndex(value: string) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < 20 ? index : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  const session = await getDistillSession();
  if (!session) {
    return privateJson({ error: "请重新验证私人工作区。" }, { status: 401 });
  }
  const { id, index: indexValue } = await params;
  const index = parseIndex(indexValue);
  if (index === null) {
    return privateJson({ error: "知识卡片编号无效。" }, { status: 400 });
  }
  try {
    const cardId = await saveKnowledgeCard(session.ownerId, id, index);
    return privateJson({ cardId });
  } catch (error) {
    return privateJson(
      { error: error instanceof Error ? error.message : "保存失败。" },
      { status: 422 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  const session = await getDistillSession();
  if (!session) {
    return privateJson({ error: "请重新验证私人工作区。" }, { status: 401 });
  }
  const { id, index: indexValue } = await params;
  const index = parseIndex(indexValue);
  if (index === null) {
    return privateJson({ error: "知识卡片编号无效。" }, { status: 400 });
  }
  await removeKnowledgeCard(session.ownerId, id, index);
  return privateJson({ ok: true });
}
