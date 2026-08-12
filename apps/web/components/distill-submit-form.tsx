"use client";

import {
  ArrowUp,
  CheckCircle,
  CircleNotch,
  FileMagnifyingGlass,
  LinkSimple,
  SlidersHorizontal,
  Sparkle,
  TextAlignLeft,
  WarningCircle,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

import {
  readPrivateWorkspace,
  savePrivatePersonalizedInsights,
  type PrivatePersonalizedInsight,
  type PrivateWorkspaceSnapshot,
} from "../lib/private-workspace";

export function DistillSubmitForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [privateWorkspace, setPrivateWorkspace] =
    useState<PrivateWorkspaceSnapshot | null>(null);
  const [usePersonalization, setUsePersonalization] = useState(false);

  useEffect(() => {
    readPrivateWorkspace()
      .then(setPrivateWorkspace)
      .catch(() => setPrivateWorkspace(null));
  }, []);

  useEffect(() => {
    if (!submitting) {
      setActiveStage(0);
      return;
    }
    const timers = [
      window.setTimeout(() => setActiveStage(1), 900),
      window.setTimeout(() => setActiveStage(2), 2_800),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [submitting]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const selectedMemories =
        privateWorkspace?.memories
          .slice(0, 20)
          .map(
            (memory) =>
              `[${memory.kind === "knowledge" ? "可复用知识" : memory.kind === "preference" ? "偏好与边界" : "当前事项"}] ${memory.statement}`,
          ) ?? [];
      const personalization =
        usePersonalization && privateWorkspace
          ? {
              purpose: privateWorkspace.profile.purpose,
              directions: privateWorkspace.profile.directions,
              currentContext: privateWorkspace.profile.currentContext,
              preferredHelp: privateWorkspace.profile.preferredHelp,
              boundaries: privateWorkspace.profile.boundaries,
              memories: selectedMemories,
            }
          : null;
      const response = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, personalization }),
      });
      const body = (await response.json()) as {
        id?: string;
        error?: string;
        personalizedInsights?: PrivatePersonalizedInsight[];
        personalizationError?: string | null;
      };
      if (!response.ok || !body.id) {
        throw new Error(body.error || "脱水任务没有成功创建。");
      }
      if (usePersonalization) {
        try {
          await savePrivatePersonalizedInsights(
            body.id,
            body.personalizedInsights ?? [],
            body.personalizationError ?? null,
          );
          window.sessionStorage.removeItem(
            `ann-personalization-status:${body.id}`,
          );
        } catch {
          window.sessionStorage.setItem(
            `ann-personalization-status:${body.id}`,
            "本机未能保存个性化结果；通用脱水仍可正常阅读。",
          );
        }
      }
      router.push(`/distill/${body.id}`);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "脱水任务失败，请稍后重试。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      if (!submitting && input.trim()) formRef.current?.requestSubmit();
    }
  }

  const hasThread = submitting || Boolean(error);
  const hasPrivateContext = Boolean(
    privateWorkspace &&
    (privateWorkspace.memories.length ||
      privateWorkspace.profile.purpose.trim() ||
      privateWorkspace.profile.directions.trim() ||
      privateWorkspace.profile.currentContext.trim() ||
      privateWorkspace.profile.preferredHelp.trim() ||
      privateWorkspace.profile.boundaries.trim()),
  );
  const steps = [
    {
      icon: FileMagnifyingGlass,
      title: "读取并清洗正文",
      detail: "识别网页主体，去除导航、脚本和重复内容。",
    },
    {
      icon: Sparkle,
      title: "判断信息密度",
      detail: "区分事实、作者观点与推断，确定是否值得细读。",
    },
    {
      icon: TextAlignLeft,
      title: "组织知识文档",
      detail: "生成导读、核心论点、证据边界和可保存知识。",
    },
  ];

  return (
    <div className={`distillNewConversation${hasThread ? " hasThread" : ""}`}>
      <section className="distillConversationBody" aria-live="polite">
        {hasThread ? (
          <div className="distillProcessingThread">
            <article className="distillConversationUser">
              <small>你</small>
              <p>{input}</p>
            </article>
            <article className="distillConversationAssistant">
              <div className="distillAssistantIdentity">
                {error ? (
                  <WarningCircle aria-hidden="true" size={18} />
                ) : (
                  <CircleNotch
                    aria-hidden="true"
                    className="isSpinning"
                    size={18}
                  />
                )}
                <div>
                  <strong>脱水助手</strong>
                  <span>{error ? "处理未完成" : "正在处理这份材料"}</span>
                </div>
              </div>
              {error ? (
                <div className="distillConversationError" role="alert">
                  <p>{error}</p>
                  <span>你可以修改输入后重新发送。</span>
                </div>
              ) : (
                <ol className="distillLiveSteps">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const complete = activeStage > index;
                    const active = activeStage === index;
                    return (
                      <li
                        key={step.title}
                        className={
                          complete ? "isComplete" : active ? "isActive" : ""
                        }
                      >
                        <Icon aria-hidden="true" size={17} />
                        <span>
                          <strong>{step.title}</strong>
                          <small>{step.detail}</small>
                        </span>
                        {complete ? (
                          <CheckCircle
                            aria-hidden="true"
                            size={16}
                            weight="fill"
                          />
                        ) : (
                          <i aria-hidden="true" />
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </article>
          </div>
        ) : (
          <div className="distillConversationEmpty">
            <div className="distillAssistantMark" aria-hidden="true">
              <Sparkle size={22} />
            </div>
            <p>一次只处理一份材料</p>
            <h2>今天想读懂什么？</h2>
            <span>
              粘贴网页链接或正文。我会先判断值不值得读，再把真正有用的部分整理成可追问、可保存的知识文档。
            </span>
            <div
              className="distillConversationPrompts"
              aria-label="适合处理的内容"
            >
              <span>长文与访谈</span>
              <span>论文与技术博客</span>
              <span>产品与行业分析</span>
            </div>
          </div>
        )}
      </section>

      <form
        ref={formRef}
        className="distillConversationComposer"
        onSubmit={submit}
      >
        <label htmlFor="distill-input">网页链接或正文</label>
        <textarea
          id="distill-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="粘贴网页链接或正文，按 Enter 开始脱水"
          rows={4}
          minLength={8}
          maxLength={100_000}
          disabled={submitting}
          required
        />
        <div className="distillPersonalizationConsent">
          <label>
            <input
              type="checkbox"
              checked={usePersonalization}
              disabled={submitting || !hasPrivateContext}
              onChange={(event) => setUsePersonalization(event.target.checked)}
            />
            <SlidersHorizontal aria-hidden="true" size={15} />
            <span>
              <strong>本次使用私人画像</strong>
              <small>
                {hasPrivateContext
                  ? `额外调用一次模型；发送画像字段与 ${Math.min(privateWorkspace?.memories.length ?? 0, 20)} 条确认记忆，仅生成“与你有关”部分`
                  : "尚未设置画像；默认只分析原文"}
              </small>
            </span>
          </label>
          <a href="/settings">查看与编辑</a>
        </div>
        <footer>
          <div aria-label="当前支持的输入">
            <span>
              <LinkSimple aria-hidden="true" size={15} />
              网页
            </span>
            <span>
              <TextAlignLeft aria-hidden="true" size={15} />
              正文
            </span>
          </div>
          <small>Enter 发送 · Shift + Enter 换行</small>
          <button type="submit" disabled={submitting || !input.trim()}>
            <ArrowUp aria-hidden="true" size={17} weight="bold" />
            <span>{submitting ? "处理中" : "发送"}</span>
          </button>
        </footer>
      </form>
    </div>
  );
}
