"use client";

import { Trash } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DistillDeleteButton({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("删除后无法恢复，也会同步移出知识库。确认删除？")) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/distill/${documentId}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "删除失败。");
      router.replace("/distill");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "删除失败。",
      );
      setDeleting(false);
    }
  }

  return (
    <div className="distillDeleteControl">
      <button
        className="distillUtilityButton distillDeleteButton"
        type="button"
        onClick={remove}
        disabled={deleting}
      >
        <Trash aria-hidden="true" size={17} />
        {deleting ? "正在删除" : "删除"}
      </button>
      {error ? <span role="alert">{error}</span> : null}
    </div>
  );
}
