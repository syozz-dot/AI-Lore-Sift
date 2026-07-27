"use client";

import { ArrowRight, LinkSimple, TextAlignLeft } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export function DistillSubmitForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/distill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const body = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !body.id) {
        throw new Error(body.error || "脱水任务没有成功创建。");
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

  return (
    <form className="distillComposer" onSubmit={submit}>
      <label htmlFor="distill-input">网页链接或正文</label>
      <div className="distillInputFrame">
        <textarea
          id="distill-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="粘贴一篇网页链接，或直接粘贴需要脱水的正文"
          rows={7}
          minLength={8}
          maxLength={100_000}
          required
        />
        <div className="distillComposerFooter">
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
          <button type="submit" disabled={submitting || !input.trim()}>
            {submitting ? "正在读取与脱水" : "开始脱水"}
            <ArrowRight aria-hidden="true" size={17} />
          </button>
        </div>
      </div>
      <p className="distillComposerHelper">
        当前为私人能力。平台视频、音频与文件将通过独立适配器接入，不会影响现有知识结构。
      </p>
      {error ? (
        <p className="distillComposerError" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
