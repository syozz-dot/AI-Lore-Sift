import { NextResponse } from "next/server";

import { getDistillSession } from "../../../../lib/distill-auth";
import { deleteDistillDocument } from "../../../../lib/distill";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getDistillSession();
  if (!session) {
    return NextResponse.json(
      { error: "请重新验证访问权限。" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const deleted = await deleteDistillDocument(session.ownerId, id);
  if (!deleted) {
    return NextResponse.json({ error: "没有找到这条内容。" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
