import { NextResponse } from "next/server";

import { getDistillSession } from "../../../../../../lib/distill-auth";
import {
  removeKnowledgeCard,
  saveKnowledgeCard,
} from "../../../../../../lib/distill";

function parseIndex(value: string) {
  const index = Number(value);
  return Number.isInteger(index) && index >= 0 && index < 20 ? index : null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const session = await getDistillSession();
  if (!session) {
    return NextResponse.json(
      { error: "请重新验证私人工作区。" },
      { status: 401 },
    );
  }
  const { id, index: indexValue } = await params;
  const index = parseIndex(indexValue);
  if (index === null) {
    return NextResponse.json({ error: "知识卡片编号无效。" }, { status: 400 });
  }
  try {
    const cardId = await saveKnowledgeCard(session.ownerId, id, index);
    return NextResponse.json({ cardId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "保存失败。" },
      { status: 422 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const session = await getDistillSession();
  if (!session) {
    return NextResponse.json(
      { error: "请重新验证私人工作区。" },
      { status: 401 },
    );
  }
  const { id, index: indexValue } = await params;
  const index = parseIndex(indexValue);
  if (index === null) {
    return NextResponse.json({ error: "知识卡片编号无效。" }, { status: 400 });
  }
  await removeKnowledgeCard(session.ownerId, id, index);
  return NextResponse.json({ ok: true });
}
