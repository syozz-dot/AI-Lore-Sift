"use client";

import {
  ArrowRight,
  ArrowUp,
  ChatCircleDots,
  Sparkle,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";

import type { LocalDistillAnalysis } from "../lib/distill-local";
import {
  PRIVATE_DISTILL_SESSION_PREFIX,
  updatePrivateDistillRecord,
  type PrivateDistillMessage,
  type PrivateDistillRecord,
} from "../lib/private-workspace";
import { DistillMessageBody } from "./distill-follow-up";
import { PrivateMemoryCandidate } from "./private-memory-candidate";

export function LocalDistillFollowUp({
  document,
  analysis,
  sectionNumber,
  initialRemaining,
}: {
  document: PrivateDistillRecord;
  analysis: LocalDistillAnalysis;
  sectionNumber: string;
  initialRemaining: number;
}) {
  const [messages, setMessages] = useState(document.messages);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [remaining, setRemaining] = useState(initialRemaining);
  const [error, setError] = useState<string | null>(null);

  async function ask(value: string) {
    const normalized = value.trim();
    if (!normalized || pending) return;
    const optimistic: PrivateDistillMessage = {
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
      const response = await fetch("/api/distill/preview/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: normalized,
          sourceTitle: document.sourceTitle,
          rawText: document.rawText,
          summary: analysis.summary,
          keyPoints: analysis.keyPoints,
          messages,
        }),
      });
      const body = (await response.json()) as {
        messages?: PrivateDistillMessage[];
        remaining?: number;
        error?: string;
      };
      if (!response.ok || !body.messages?.length) {
        throw new Error(body.error || "这次追问没有成功。");
      }
      const nextMessages = [
        ...messages.filter((message) => message.id !== optimistic.id),
        ...body.messages,
      ];
      setMessages(nextMessages);
      setRemaining(
        typeof body.remaining === "number" ? body.remaining : remaining,
      );
      const updatedAt = new Date().toISOString();
      try {
        await updatePrivateDistillRecord(document.id, (record) => ({
          ...record,
          messages: nextMessages,
          updatedAt,
        }));
      } catch {
        window.sessionStorage.setItem(
          `${PRIVATE_DISTILL_SESSION_PREFIX}${document.id}`,
          JSON.stringify({ ...document, messages: nextMessages, updatedAt }),
        );
      }
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
    <section
      className="distillFollowUp"
      aria-labelledby="local-follow-up-title"
    >
      <header>
        <div className="distillFollowUpTitle">
          <span>{sectionNumber}</span>
          <div>
            <h2 id="local-follow-up-title">继续追问</h2>
            <p>从这篇材料出发展开</p>
          </div>
        </div>
        <span>
          <Sparkle aria-hidden="true" size={14} />
          {`还可追问 ${remaining} 次`}
        </span>
      </header>

      <div className="distillSuggestedQuestions">
        <p>你可能还想问</p>
        <div>
          {analysis.followUpQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void ask(suggestion)}
              disabled={pending || remaining === 0}
            >
              <ChatCircleDots aria-hidden="true" size={18} />
              <strong>{suggestion}</strong>
              <ArrowRight aria-hidden="true" size={16} />
            </button>
          ))}
        </div>
      </div>

      {messages.length ? (
        <div className="distillMessageList" aria-live="polite">
          {messages.map((message) => (
            <article
              key={message.id}
              className={message.role === "user" ? "isUser" : "isAssistant"}
            >
              <small>{message.role === "user" ? "你" : "脱水助手"}</small>
              <DistillMessageBody content={message.content} />
              {message.role === "assistant" ? (
                <PrivateMemoryCandidate
                  source="question"
                  statement={message.content}
                />
              ) : null}
            </article>
          ))}
          {pending ? (
            <article className="isAssistant isPending">
              <small>脱水助手</small>
              <p>正在结合原文与通用知识组织回答…</p>
            </article>
          ) : null}
        </div>
      ) : null}

      <form onSubmit={submit}>
        <label htmlFor="local-distill-follow-up">继续追问</label>
        <textarea
          id="local-distill-follow-up"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="追问机制、对比、应用或反例，也可以结合你的场景继续推演"
          rows={2}
          maxLength={2_000}
          disabled={remaining === 0}
        />
        <button
          type="submit"
          disabled={pending || remaining === 0 || !question.trim()}
          className={pending ? "isPending" : undefined}
          aria-busy={pending}
          aria-label="发送追问"
        >
          <span>{pending ? "回答中" : "发送"}</span>
          <ArrowUp aria-hidden="true" size={17} weight="bold" />
        </button>
      </form>
      <p className="distillFollowUpBoundary">
        追问不会保存在服务器；回答只写入当前浏览器，并区分原文、延伸分析与待核验信息。
      </p>
      {error ? (
        <p className="distillFollowUpError" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
