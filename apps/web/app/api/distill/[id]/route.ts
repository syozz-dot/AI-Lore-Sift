import { getDistillSession } from "../../../../lib/distill-auth";
import { deleteDistillDocument } from "../../../../lib/distill";
import {
  privateJson,
  rejectUntrustedPrivateMutation,
} from "../../../../lib/private-request";

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
  const deleted = await deleteDistillDocument(session.ownerId, id);
  if (!deleted) {
    return privateJson({ error: "没有找到这条内容。" }, { status: 404 });
  }
  return privateJson({ ok: true });
}
