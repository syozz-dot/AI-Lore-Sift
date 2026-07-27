"use client";

import { BookmarkSimple, Check } from "@phosphor-icons/react";
import { useState } from "react";

export function KnowledgeSaveButton({
  documentId,
  initialSaved,
}: {
  documentId: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/distill/${documentId}/knowledge`, {
        method: saved ? "DELETE" : "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "知识库操作失败。");
      setSaved(!saved);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "知识库操作失败。",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="knowledgeSaveControl">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
      >
        {saved ? (
          <Check aria-hidden="true" size={17} weight="bold" />
        ) : (
          <BookmarkSimple aria-hidden="true" size={17} />
        )}
        {pending ? "正在保存" : saved ? "已存入知识库" : "存入知识库"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
