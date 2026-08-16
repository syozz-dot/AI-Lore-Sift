"use client";

import { BookmarkSimple, Check, Copy, Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deletePrivateDistillRecord,
  deletePrivateKnowledgeCard,
  PRIVATE_DISTILL_SESSION_PREFIX,
  savePrivateKnowledgeCard,
  setPrivateDistillKnowledgeSaved,
  type PrivateDistillRecord,
} from "../lib/private-workspace";
import { PrivateMemoryCandidate } from "./private-memory-candidate";

export function LocalKnowledgeSaveButton({
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
      await setPrivateDistillKnowledgeSaved(documentId, !saved);
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
        {pending ? "正在保存" : saved ? "已存入本机知识库" : "存入知识库"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

export function LocalKnowledgeCardActions({
  document,
  insightIndex,
  title,
  content,
  initialSaved,
}: {
  document: PrivateDistillRecord;
  insightIndex: number;
  title: string;
  content: string;
  initialSaved: boolean;
}) {
  const cardId = `${document.id}:insight:${insightIndex}`;
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleSaved() {
    setPending(true);
    setError(null);
    try {
      if (saved) {
        await deletePrivateKnowledgeCard(cardId);
      } else {
        const now = new Date().toISOString();
        await savePrivateKnowledgeCard({
          id: cardId,
          title,
          content,
          sourceDocumentId: document.id,
          sourceTitle: document.sourceTitle,
          sourceUrl: document.sourceUrl,
          createdAt: now,
          updatedAt: now,
        });
      }
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
      <PrivateMemoryCandidate compact source="favorite" statement={content} />
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}

export function LocalDistillDeleteButton({
  documentId,
}: {
  documentId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("删除当前浏览器里的这份脱水结果和关联知识卡？")) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await deletePrivateDistillRecord(documentId);
      window.sessionStorage.removeItem(
        `${PRIVATE_DISTILL_SESSION_PREFIX}${documentId}`,
      );
      router.push("/distill");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "删除失败。",
      );
      setPending(false);
    }
  }

  return (
    <div className="distillDeleteControl">
      <button
        className="distillUtilityButton distillDeleteButton"
        type="button"
        onClick={remove}
        disabled={pending}
      >
        <Trash aria-hidden="true" size={17} />
        {pending ? "删除中" : "删除本机记录"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
