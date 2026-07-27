"use client";

import { ArrowRight, LockKey } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export function DistillAccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/distill/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessKey }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "验证失败。");
      const next = searchParams.get("next");
      const safeNext =
        next?.startsWith("/") && !next.startsWith("//") ? next : "/distill";
      router.replace(safeNext);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "验证失败。",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="distillAccessForm" onSubmit={submit}>
      <label htmlFor="distill-access-key">
        <span>私人访问口令</span>
        <div>
          <LockKey aria-hidden="true" size={18} />
          <input
            id="distill-access-key"
            type="password"
            value={accessKey}
            onChange={(event) => setAccessKey(event.target.value)}
            autoComplete="current-password"
            minLength={6}
            required
          />
        </div>
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "正在验证" : "进入工作区"}
        <ArrowRight aria-hidden="true" size={16} />
      </button>
    </form>
  );
}
