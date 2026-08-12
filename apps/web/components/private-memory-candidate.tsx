"use client";

import { Brain, Check, Plus, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import {
  hasPrivateMemory,
  savePrivateMemory,
  type PrivateMemory,
} from "../lib/private-workspace";

async function candidateMemoryId(statement: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(statement.slice(0, 600).trim()),
  );
  const fingerprint = Array.from(new Uint8Array(digest).slice(0, 12), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `candidate-${fingerprint}`;
}

export function PrivateMemoryCandidate({
  statement,
  source,
  compact = false,
}: {
  statement: string;
  source: Extract<PrivateMemory["source"], "favorite" | "question">;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(statement.slice(0, 600));
  const [kind, setKind] =
    useState<NonNullable<PrivateMemory["kind"]>>("knowledge");
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    candidateMemoryId(statement)
      .then(async (id) => {
        setSaved(await hasPrivateMemory(id));
      })
      .catch(() => undefined);
  }, [statement]);

  async function confirm() {
    const normalized = draft.trim();
    if (!normalized || pending) return;
    setPending(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await savePrivateMemory({
        id: await candidateMemoryId(statement),
        statement: normalized,
        source,
        kind,
        createdAt: now,
        updatedAt: now,
      });
      setSaved(true);
      setOpen(false);
    } catch {
      setError("本机记忆保存失败。");
    } finally {
      setPending(false);
    }
  }

  if (saved) {
    return (
      <span className="privateMemorySaved" role="status">
        <Check aria-hidden="true" size={14} weight="bold" />
        已内化到本机画像
      </span>
    );
  }

  return (
    <div
      className={`privateMemoryCandidate${compact ? " isCompact" : ""}${open ? " isOpen" : ""}`}
    >
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}>
          <Brain aria-hidden="true" size={15} />
          作为候选记忆
        </button>
      ) : (
        <div className="privateMemoryCandidateEditor">
          <header>
            <span>
              <Brain aria-hidden="true" size={15} />
              确认后才会进入本机画像
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭候选记忆"
            >
              <X aria-hidden="true" size={15} />
            </button>
          </header>
          <textarea
            value={draft}
            maxLength={600}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="编辑候选记忆"
          />
          <label>
            记忆类型
            <select
              value={kind}
              onChange={(event) =>
                setKind(
                  event.target.value as NonNullable<PrivateMemory["kind"]>,
                )
              }
            >
              <option value="knowledge">可复用知识</option>
              <option value="context">当前事项</option>
              <option value="preference">偏好与边界</option>
            </select>
          </label>
          <footer>
            <small>可先删改；原内容不会被自动写入。</small>
            <button
              type="button"
              disabled={pending || !draft.trim()}
              onClick={confirm}
            >
              <Plus aria-hidden="true" size={14} />
              {pending ? "保存中" : "确认内化"}
            </button>
          </footer>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      )}
    </div>
  );
}
