import { getDistillSession } from "../../../../../lib/distill-auth";
import {
  removeDistillFromKnowledge,
  saveDistillToKnowledge,
} from "../../../../../lib/distill";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../../../lib/private-request";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  const session = await getDistillSession();
  if (!session) {
    return privateJson({ error: "请重新验证访问权限。" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const entryId = await saveDistillToKnowledge(session.ownerId, id);
    return privateJson({ ok: true, entryId });
  } catch (error) {
    return privateJson(
      {
        error:
          error instanceof Error ? error.message : "保存到知识库时发生错误。",
      },
      { status: 422 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rejected = rejectUntrustedPrivateMutation(request);
  if (rejected) return rejected;
  const session = await getDistillSession();
  if (!session) {
    return privateJson({ error: "请重新验证访问权限。" }, { status: 401 });
  }
  const { id } = await params;
  await removeDistillFromKnowledge(session.ownerId, id);
  return privateJson({ ok: true });
}
