"use client";

import {
  ArrowRight,
  ArrowUp,
  ChatCircleDots,
  Sparkle,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { FormEvent } from "react";

import { distillMessageBlocks } from "../lib/distill-message";
import { PrivateMemoryCandidate } from "./private-memory-candidate";

interface FollowUpMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

function DistillMessageBody({ content }: { content: string }) {
  return (
    <div className="distillMessageBody">
      {distillMessageBlocks(content).map((block, index) =>
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
  sectionNumber,
  initialMessages,
  suggestedQuestions,
}: {
  documentId: string;
  sectionNumber: string;
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
        <div className="distillFollowUpTitle">
          <span>{sectionNumber}</span>
          <div>
            <h2 id="follow-up-title">继续追问</h2>
            <p>从这篇材料出发展开</p>
          </div>
        </div>
        <span>
          <Sparkle aria-hidden="true" size={14} />
          原文为锚点，可延伸
        </span>
      </header>

      <div className="distillSuggestedQuestions">
        <p>你可能还想问</p>
        <div>
          {suggestedQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void ask(suggestion)}
              disabled={pending}
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
              {message.role !== "user" ? (
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
        <label htmlFor="distill-follow-up">继续追问</label>
        <textarea
          id="distill-follow-up"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="追问机制、对比、应用或反例，也可以让助手结合你的场景继续推演"
          rows={2}
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
        回答会区分原文结论、延伸分析与待核验信息；不会假装已进行实时检索。
      </p>
      {error ? (
        <p className="distillFollowUpError" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
