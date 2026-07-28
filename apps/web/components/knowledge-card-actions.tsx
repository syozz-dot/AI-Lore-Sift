"use client";

import { BookmarkSimple, Check, Copy } from "@phosphor-icons/react";
import { useState } from "react";

export function KnowledgeCardActions({
  documentId,
  insightIndex,
  title,
  content,
  initialSaved,
}: {
  documentId: string;
  insightIndex: number;
  title: string;
  content: string;
  initialSaved: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSaved() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/distill/${documentId}/insights/${insightIndex}`,
        { method: saved ? "DELETE" : "POST" },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "知识卡片操作失败。");
      setSaved(!saved);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "知识卡片操作失败。",
      );
    } finally {
      setPending(false);
    }
  }

  async function copyMarkdown() {
    await navigator.clipboard.writeText(`## ${title}\n\n${content}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_600);
  }

  return (
    <div className="knowledgeCardActions">
      <button
        type="button"
        onClick={toggleSaved}
        disabled={pending}
        aria-pressed={saved}
      >
        {saved ? (
          <Check aria-hidden="true" size={15} weight="bold" />
        ) : (
          <BookmarkSimple aria-hidden="true" size={15} />
        )}
        {pending ? "保存中" : saved ? "已保存" : "保存知识"}
      </button>
      <button type="button" onClick={copyMarkdown}>
        <Copy aria-hidden="true" size={15} />
        {copied ? "已复制" : "复制 Markdown"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
