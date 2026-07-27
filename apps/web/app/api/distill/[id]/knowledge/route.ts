import { NextResponse } from "next/server";

import { getDistillSession } from "../../../../../lib/distill-auth";
import {
  removeDistillFromKnowledge,
  saveDistillToKnowledge,
} from "../../../../../lib/distill";

export async function POST(
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
  try {
    const entryId = await saveDistillToKnowledge(session.ownerId, id);
    return NextResponse.json({ ok: true, entryId });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "保存到知识库时发生错误。",
      },
      { status: 422 },
    );
  }
}

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
  await removeDistillFromKnowledge(session.ownerId, id);
  return NextResponse.json({ ok: true });
}
