"use client";

import { ArrowUp, ChatCircleDots } from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";

interface FollowUpMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface MessageBlock {
  kind: "paragraph" | "list";
  content: string | string[];
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .trim();
}

function messageBlocks(content: string): MessageBlock[] {
  const prepared = content
    .replace(/\r\n?/g, "\n")
    .replace(/\s*\*\*([^*\n]+)\*\*\s*([：:])/g, "\n\n$1$2 ")
    .replace(/([。！？!?])\s+(?=(?:[-•]|\d+[.、])\s)/g, "$1\n")
    .trim();
  const lines = prepared.split(/\n+/).map(cleanInlineMarkdown).filter(Boolean);
  const blocks: MessageBlock[] = [];

  for (const line of lines) {
    const listItem = line.match(/^(?:[-•]|\d+[.、])\s*(.+)$/);
    if (listItem?.[1]) {
      const last = blocks.at(-1);
      if (last?.kind === "list" && Array.isArray(last.content)) {
        last.content.push(listItem[1]);
      } else {
        blocks.push({ kind: "list", content: [listItem[1]] });
      }
      continue;
    }
    blocks.push({ kind: "paragraph", content: line });
  }

  return blocks;
}

function DistillMessageBody({ content }: { content: string }) {
  return (
    <div className="distillMessageBody">
      {messageBlocks(content).map((block, index) =>
        block.kind === "list" && Array.isArray(block.content) ? (
          <ol key={`list-${index}`}>
            {block.content.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        ) : (
          <p key={`paragraph-${index}`}>{String(block.content)}</p>
        ),
      )}
    </div>
  );
}

export function DistillFollowUp({
  documentId,
  initialMessages,
  suggestedQuestions,
}: {
  documentId: string;
  initialMessages: FollowUpMessage[];
  suggestedQuestions: string[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(value: string) {
    const normalized = value.trim();
    if (!normalized || pending) return;
    const optimistic: FollowUpMessage = {
      id: `optimistic-${Date.now()}`,
      role: "user",
      content: normalized,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [...current, optimistic]);
    setQuestion("");
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/distill/${documentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: normalized }),
      });
      const body = (await response.json()) as {
        messages?: Array<{
          id: string;
          role: string;
          content: string;
          createdAt: string;
        }>;
        error?: string;
      };
      if (!response.ok || !body.messages?.length) {
        throw new Error(body.error || "这次追问没有成功。");
      }
      setMessages((current) => [
        ...current.filter((message) => message.id !== optimistic.id),
        ...body.messages!,
      ]);
    } catch (askError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimistic.id),
      );
      setError(askError instanceof Error ? askError.message : "追问失败。");
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  return (
    <section className="distillFollowUp" aria-labelledby="follow-up-title">
      <header>
        <ChatCircleDots aria-hidden="true" size={21} />
        <div>
          <p>继续理解</p>
          <h2 id="follow-up-title">基于这篇材料继续追问</h2>
        </div>
      </header>

      {messages.length ? (
        <div className="distillMessageList" aria-live="polite">
          {messages.map((message) => (
            <article
              key={message.id}
              className={message.role === "user" ? "isUser" : "isAssistant"}
            >
              <small>{message.role === "user" ? "你" : "脱水助手"}</small>
              <DistillMessageBody content={message.content} />
            </article>
          ))}
          {pending ? (
            <article className="isAssistant isPending">
              <small>脱水助手</small>
              <p>正在回到原文核对并组织回答…</p>
            </article>
          ) : null}
        </div>
      ) : (
        <div className="distillSuggestedQuestions">
          <p>你可能还想问</p>
          {suggestedQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void ask(suggestion)}
              disabled={pending}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={submit}>
        <label htmlFor="distill-follow-up">继续追问</label>
        <textarea
          id="distill-follow-up"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="针对原文、方法或结论继续提问"
          rows={3}
          maxLength={2_000}
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className={pending ? "isPending" : undefined}
          aria-busy={pending}
          aria-label="发送追问"
        >
          <span>{pending ? "回答中" : "发送"}</span>
          <ArrowUp aria-hidden="true" size={17} weight="bold" />
        </button>
      </form>
      <p className="distillFollowUpBoundary">
        回答只使用当前原文和已生成分析；材料不足时会明确说明。
      </p>
      {error ? (
        <p className="distillFollowUpError" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
